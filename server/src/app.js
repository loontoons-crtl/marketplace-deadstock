import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import { loadUser } from './middleware/auth.js';
import { checkOrigin } from './middleware/origin.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import sellerListingRoutes from './routes/sellerListings.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import billingRoutes, { razorpayWebhook } from './routes/billing.js';
import { LOCAL_DIR } from './lib/storage.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', Number(config.trustProxy) || config.trustProxy);

  app.use(helmet());
  // Razorpay webhook needs the exact raw body to check its signature, so it is mounted before the JSON parser.
  app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '200kb' }), razorpayWebhook);
  app.use(express.json({ limit: '100kb' }));

  app.use(
    session({
      name: 'ds.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false, // no cookie for anonymous buyers
      rolling: true,
      store: MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'sessions', ttl: 7 * 24 * 60 * 60 }),
      cookie: { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
  );

  // Development photo storage. In production photos are served by Cloudinary.
  if (config.storageDriver === 'local') {
    app.use('/uploads', helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }), express.static(LOCAL_DIR, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));
  }

  app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

  app.use('/api', checkOrigin, loadUser);
  app.use('/api/auth', authRoutes);
  app.use('/api/seller/profile', profileRoutes);
  app.use('/api/seller/listings', sellerListingRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', publicRoutes);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
