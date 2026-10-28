// Loads and checks environment variables once, at startup.
// Fails fast with a clear message instead of running half-configured.
try { process.loadEnvFile(); } catch { /* no .env file: rely on real environment variables */ }

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

function required(name) {
  const v = env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy server/.env.example to server/.env and fill it in.`);
  return v;
}

export const config = {
  isProd,
  isTest,
  port: Number(env.PORT) || 4000,
  mongoUri: isTest ? env.MONGODB_URI || '' : required('MONGODB_URI'),
  sessionSecret: isTest ? 'test-secret-test-secret-test-secret' : required('SESSION_SECRET'),
  // Origins allowed to make state-changing requests (comma-separated).
  clientOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  // 'console' prints OTPs to the server log. Development only.
  smsProvider: env.SMS_PROVIDER || 'console',
  trustProxy: env.TRUST_PROXY || (isProd ? '1' : ''),
  // Where listing photos are stored: 'cloudinary' (production) or 'local' (development only).
  storageDriver: env.STORAGE_DRIVER || (env.CLOUDINARY_URL ? 'cloudinary' : 'local'),
  cloudinaryUrl: env.CLOUDINARY_URL || '',
  // Razorpay. Without the key id + secret, online payment is switched off (admins can still record offline payments).
  razorpayKeyId: env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
  // 'console' prints emails (renewal reminders etc.) to the server log. Development only.
  emailProvider: env.EMAIL_PROVIDER || 'console',
  // Background jobs (renewal reminders). Off in tests, which call the job directly.
  runJobs: !isTest && env.RUN_JOBS !== 'false',
};

if (!isTest && config.sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
}
if (isProd && config.smsProvider === 'console') {
  throw new Error('SMS_PROVIDER=console prints OTPs to logs and is not allowed in production. Configure a real SMS provider first.');
}
if (config.storageDriver === 'cloudinary' && !config.cloudinaryUrl) {
  throw new Error('STORAGE_DRIVER=cloudinary needs CLOUDINARY_URL (Cloudinary dashboard → API Keys → API environment variable).');
}
if (isProd && (!config.razorpayKeyId || !config.razorpayKeySecret || !config.razorpayWebhookSecret)) {
  console.warn('[config] Razorpay keys or webhook secret missing: online payments are disabled.');
}
if (isProd && config.emailProvider === 'console') {
  console.warn('[config] EMAIL_PROVIDER=console: renewal reminders are only printed to the log, not emailed.');
}
export const paymentsEnabled = () => Boolean(config.razorpayKeyId && config.razorpayKeySecret);

if (isProd && config.storageDriver === 'local') {
  throw new Error('STORAGE_DRIVER=local keeps photos on the server disk, which most hosts wipe on redeploy. Use Cloudinary in production.');
}
