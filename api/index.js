import { config } from '../server/src/config.js';
import { connectDb } from '../server/src/db.js';
import { createApp } from '../server/src/app.js';
import { Category } from '../server/src/models/Category.js';
import { seedPricing, seedReference, seedSamples } from '../server/scripts/seedLib.js';

let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      await connectDb(config.mongoUri);
      // Auto-seed reference data and sample listings if starting with an empty database
      if ((await Category.countDocuments()) === 0) {
        await seedReference();
        await seedPricing();
        await seedSamples();
      }
      return createApp();
    })().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('Vercel API handler error:', err);
    res.status(500).json({
      error: 'Database or server configuration error. Check MONGODB_URI and SESSION_SECRET in Vercel Environment Variables.',
      details: err.message
    });
  }
}
