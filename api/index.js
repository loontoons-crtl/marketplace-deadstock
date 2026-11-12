let appPromise;

async function ensureDefaultAdmin() {
  const { User } = await import('../server/src/models/User.js');
  const { SellerProfile } = await import('../server/src/models/SellerProfile.js');
  const bcrypt = (await import('bcryptjs')).default;

  const existing = await User.findOne({ role: 'admin' });
  if (existing) return;

  const passwordHash = await bcrypt.hash('password123', 12);
  let user = await User.findOne({ email: 'tmtanmay11@gmail.com' });
  if (user) {
    user.role = 'admin';
    user.status = 'active';
    user.passwordHash = passwordHash;
    await user.save();
  } else {
    user = await User.create({
      name: 'Admin',
      email: 'tmtanmay11@gmail.com',
      phone: '+918088107520',
      passwordHash,
      role: 'admin',
      status: 'active',
      phoneVerifiedAt: new Date(),
    });
    await SellerProfile.create({
      user: user._id,
      displayName: 'Admin',
      sellerType: 'Individual',
      city: 'Bengaluru',
    });
  }
}

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
      const { seedPricing, seedReference, seedSamples } = await import('../server/scripts/seedLib.js');

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
