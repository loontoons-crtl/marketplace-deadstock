import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { SellerProfile } from '../models/SellerProfile.js';
import { Locality } from '../models/Locality.js';
import { Listing } from '../models/Listing.js';
import { Report } from '../models/Report.js';
import { ContactEvent } from '../models/ContactEvent.js';
import { PhoneOtp } from '../models/PhoneOtp.js';
import { Subscription } from '../models/Subscription.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { storage } from '../lib/storage.js';
import { userSelf } from '../lib/serialize.js';
import { profileUpdateSchema } from '../lib/validation.js';

const r = Router();
r.use(requireAuth);

r.get('/', async (req, res) => {
  const profile = await SellerProfile.findOne({ user: req.user._id });
  res.json({ user: userSelf(req.user, profile) });
});

r.patch('/', async (req, res) => {
  const data = profileUpdateSchema.parse(req.body);
  const profile = await SellerProfile.findOne({ user: req.user._id });
  if (!profile) throw new HttpError(404, 'Seller profile not found.');
  if (data.locality) {
    const ok = await Locality.exists({ city: profile.city, name: data.locality, active: true });
    if (!ok) throw new HttpError(400, 'Choose a locality from the list.', { locality: 'Choose a locality from the list.' });
  }
  if (data.showContact === true && !profile.showContact) profile.showContactConsentAt = new Date();
  if (data.showContact === false) profile.showContactConsentAt = null;
  // Only whitelisted fields reach the document; verification flags cannot be set here.
  Object.assign(profile, data);
  await profile.save();
  res.json({ user: userSelf(req.user, profile) });
});

r.delete('/', async (req, res, next) => {
  const userId = req.user._id;

  // Protect against deleting the only admin account
  if (req.user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      throw new HttpError(400, 'Cannot delete the only administrator account.');
    }
  }

  // 1. Remove all photo files from storage for this seller's listings
  const listings = await Listing.find({ seller: userId }, 'images');
  for (const l of listings) {
    if (l.images && l.images.length) {
      await Promise.allSettled(l.images.map((img) => storage.remove(img.key)));
    }
  }
  const listingIds = listings.map((l) => l._id);

  // 2. Cascade delete listings, reports, analytics events, OTPs, subscriptions and profiles
  await Promise.all([
    Listing.deleteMany({ seller: userId }),
    Report.deleteMany({ $or: [{ listing: { $in: listingIds } }, { reporterUser: userId }] }),
    ContactEvent.deleteMany({ seller: userId }),
    PhoneOtp.deleteMany({ user: userId }),
    Subscription.deleteMany({ user: userId }),
    Notification.deleteMany({ user: userId }),
    SellerProfile.deleteOne({ user: userId }),
    User.deleteOne({ _id: userId }),
  ]);

  // 3. Clear session and cookie
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('ds.sid');
    res.json({ ok: true });
  });
});

export default r;
