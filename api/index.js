let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      if (!process.env.MONGODB_URI) {
        throw new Error('Missing MONGODB_URI environment variable in Vercel Project Settings.');
      }
      if (!process.env.SESSION_SECRET) {
        process.env.SESSION_SECRET = 'vercel-fallback-session-secret-change-in-production-32chars';
      }

      const { config } = await import('../server/src/config.js');
      const { connectDb } = await import('../server/src/db.js');
      const { createApp } = await import('../server/src/app.js');
      const { Category } = await import('../server/src/models/Category.js');
      const { ensureDefaultAdmin, seedPricing, seedReference, seedSamples } = await import('../server/scripts/seedLib.js');

      await connectDb(config.mongoUri);
      if ((await Category.countDocuments()) === 0) {
        await seedReference();
        await seedPricing();
        await seedSamples();
      }
      await ensureDefaultAdmin();
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
      error: err.message || 'Server initialization failed.',
      hint: 'Ensure MONGODB_URI is set in Vercel Settings -> Environment Variables and Network Access allows 0.0.0.0/0 on MongoDB Atlas.'
    });
  }
}
