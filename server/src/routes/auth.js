import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { SellerProfile } from '../models/SellerProfile.js';
import { PhoneOtp } from '../models/PhoneOtp.js';
import { normalizeIndianMobile } from '../lib/phone.js';
import { sendOtpSms } from '../lib/sms.js';
import { userSelf } from '../lib/serialize.js';
import { startTrialIfEligible } from '../lib/entitlement.js';
import { loginSchema, otpVerifySchema, registerSchema } from '../lib/validation.js';

const r = Router();
const BCRYPT_ROUNDS = 12;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
// Used to keep login timing similar whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
  skip: () => config.isTest,
  keyGenerator: (req) => String(req.user?._id),
  message: { error: 'Too many codes requested. Please try again in an hour.' },
});

const hashOtp = (userId, code) => crypto.createHmac('sha256', config.sessionSecret).update(`${userId}:${code}`).digest('hex');

// Regenerate the session ID on login to prevent session fixation.
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = String(user._id);
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

r.post('/register', authLimiter, async (req, res) => {
  const data = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await User.create({ name: data.name, email: data.email, phone: data.phone, passwordHash });
  let profile;
  try {
    profile = await SellerProfile.create({
      user: user._id,
      displayName: data.businessName || data.name,
      businessName: data.businessName,
      sellerType: data.sellerType,
    });
  } catch (e) {
    await User.deleteOne({ _id: user._id }); // keep user and profile consistent
    throw e;
  }
  await startSession(req, user);
  res.status(201).json({ user: userSelf(user, profile) });
});

r.post('/login', authLimiter, async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);
  const phone = normalizeIndianMobile(identifier);
  const query = phone ? { phone } : { email: identifier.toLowerCase() };
  const user = await User.findOne(query).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Email/phone or password is incorrect.');
  if (user.status !== 'active') throw new HttpError(403, 'This account is suspended. Contact support.');
  user.lastLoginAt = new Date();
  await user.save();
  await startSession(req, user);
  const profile = await SellerProfile.findOne({ user: user._id });
  res.json({ user: userSelf(user, profile) });
});

r.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('ds.sid');
    res.json({ ok: true });
  });
});

r.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const profile = await SellerProfile.findOne({ user: req.user._id });
  res.json({ user: userSelf(req.user, profile) });
});

r.post('/phone/send-otp', requireAuth, otpLimiter, async (req, res) => {
  if (req.user.phoneVerifiedAt) return res.json({ ok: true, alreadyVerified: true });
  if (!req.user.phone) throw new HttpError(400, 'Add a mobile number to your profile first.');
  const existing = await PhoneOtp.findOne({ user: req.user._id });
  if (existing && Date.now() - existing.createdAt.getTime() < OTP_RESEND_MS) {
    throw new HttpError(429, 'Please wait a minute before requesting another code.');
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await PhoneOtp.deleteMany({ user: req.user._id });
  await PhoneOtp.create({ user: req.user._id, phone: req.user.phone, codeHash: hashOtp(req.user._id, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  await sendOtpSms(req.user.phone, code);
  res.json({ ok: true, ...(config.smsProvider === 'console' ? { devNote: 'Development mode: the code is printed in the API terminal, not sent by SMS.' } : {}) });
});

r.post('/phone/verify', requireAuth, async (req, res) => {
  const { code } = otpVerifySchema.parse(req.body);
  const otp = await PhoneOtp.findOne({ user: req.user._id });
  if (!otp || otp.expiresAt < new Date() || otp.phone !== req.user.phone) throw new HttpError(400, 'This code has expired. Request a new one.', { code: 'This code has expired. Request a new one.' });
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong attempts. Request a new code.', { code: 'Too many wrong attempts. Request a new code.' });
  const a = Buffer.from(otp.codeHash, 'hex');
  const b = Buffer.from(hashOtp(req.user._id, code), 'hex');
  if (!crypto.timingSafeEqual(a, b)) {
    otp.attempts += 1;
    await otp.save();
    throw new HttpError(400, 'That code is not correct.', { code: 'That code is not correct.' });
  }
  req.user.phoneVerifiedAt = new Date();
  await req.user.save();
  await startTrialIfEligible(req.user); // the free trial starts once the phone is verified
  await PhoneOtp.deleteMany({ user: req.user._id });
  const profile = await SellerProfile.findOne({ user: req.user._id });
  res.json({ user: userSelf(req.user, profile) });
});

// ---------- Google OAuth 2.0 ----------
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard');
const googleRedirectUri = (req) => `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}/api/auth/google/callback`;

r.get('/google', (req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.redirect('/login?oauth_error=' + encodeURIComponent('Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.'));
  }
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;
  req.session.oauthNext = safeNext(req.query.next);
  req.session.save(() => {
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: googleRedirectUri(req),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });
});

r.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/login?oauth_error=' + encodeURIComponent('Google Sign-In was cancelled.'));
  if (!code || !state || state !== req.session.oauthState) {
    return res.redirect('/login?oauth_error=' + encodeURIComponent('Invalid or expired Google Sign-In session. Please try again.'));
  }
  const nextUrl = safeNext(req.session.oauthNext);
  delete req.session.oauthState;
  delete req.session.oauthNext;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: googleRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) throw new Error('Token exchange failed');

    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const info = await infoRes.json();
    if (!info.email || !info.sub) throw new Error('Missing Google profile email');

    const email = info.email.toLowerCase();
    let user = await User.findOne({ $or: [{ googleId: info.sub }, { email }] });
    let isNew = false;

    if (!user) {
      isNew = true;
      user = await User.create({
        name: (info.name || email.split('@')[0]).slice(0, 80),
        email,
        googleId: info.sub,
        role: 'seller',
        status: 'active',
        lastLoginAt: new Date(),
      });
      await SellerProfile.create({
        user: user._id,
        displayName: user.name,
        sellerType: 'Dealer',
        city: 'Bengaluru',
      });
    } else {
      if (user.status !== 'active') {
        return res.redirect('/login?oauth_error=' + encodeURIComponent('This account is suspended. Contact support.'));
      }
      if (!user.googleId) user.googleId = info.sub;
      user.lastLoginAt = new Date();
      await user.save();
    }

    await startSession(req, user);
    res.redirect(isNew ? '/dashboard/profile?welcome=1' : nextUrl);
  } catch (err) {
    console.error('[google-oauth]', err.message);
    res.redirect('/login?oauth_error=' + encodeURIComponent('Could not complete Google Sign-In. Please try again.'));
  }
});

export default r;
