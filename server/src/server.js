import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { runMigrations } from './lib/migrate.js';
import { runSubscriptionJobs } from './lib/jobs.js';

try {
  await connectDb(config.mongoUri);
  console.log('MongoDB connected');
} catch (e) {
  console.error('Could not connect to MongoDB:', e.message);
  console.error('Check MONGODB_URI in server/.env and, on Atlas, that your IP address is allowed under Network Access.');
  process.exit(1);
}

await runMigrations();

const app = createApp();
app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));

// Renewal reminders: shortly after start, then every hour. Safe to run on several servers (each message goes once).
if (config.runJobs) {
  const tick = () => runSubscriptionJobs().catch((e) => console.error('[jobs]', e.message));
  setTimeout(tick, 10_000);
  setInterval(tick, 60 * 60 * 1000).unref();
}
