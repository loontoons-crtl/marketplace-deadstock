import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { SellerProfile } from '../models/SellerProfile.js';
import { Locality } from '../models/Locality.js';
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

export default r;
