import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Category } from '../src/models/Category.js';
import { Locality } from '../src/models/Locality.js';
import { Listing } from '../src/models/Listing.js';
import { SellerProfile } from '../src/models/SellerProfile.js';
import { User } from '../src/models/User.js';
import { nextSeq } from '../src/models/Counter.js';
import { StorageProduct } from '../src/models/StorageProduct.js';
import { CATEGORIES, LOCALITIES, SAMPLE_LISTINGS, SAMPLE_SELLERS } from './seedData.js';

const DAY = 864e5;

// Safe to run repeatedly: reference data is upserted, sample data is replaced.
export async function seedReference() {
  for (const [i, c] of CATEGORIES.entries()) {
    await Category.updateOne({ slug: c.slug }, { $set: { ...c, order: i }, $setOnInsert: { active: true } }, { upsert: true });
  }
  for (const [city, points] of Object.entries(LOCALITIES)) {
    for (const [name, coordinates] of Object.entries(points)) {
      await Locality.updateOne({ city, name }, { $setOnInsert: { city, name, active: true } }, { upsert: true });
      // Fill a centre point only where none exists, so admin corrections are never overwritten.
      await Locality.updateOne({ city, name, 'location.coordinates': { $exists: false } }, { $set: { location: { type: 'Point', coordinates } } });
    }
  }
}

// Creates the Starter plan: ₹5,000/year with 500 MB of photo storage (both agreed defaults).
// Admins change prices and allowances, and add bigger plans or extra-storage packs, in Admin → Plans.
// If a Starter plan already exists without an allowance (from an earlier version), it gets 500 MB.
export async function seedPricing() {
  const MB = 1024 * 1024;
  await StorageProduct.updateOne({ kind: 'plan', name: 'Starter', storageBytes: 0 }, { $set: { storageBytes: 500 * MB, active: true } });
  if (await StorageProduct.exists({ kind: 'plan' })) return false;
  await StorageProduct.create({ kind: 'plan', name: 'Starter', description: 'Annual plan. Unlimited listings within your storage.', storageBytes: 500 * MB, annualPrice: 5000, durationDays: 365, active: true, order: 0 });
  return true;
}

// Gives older listings (saved before locality coordinates existed) their locality's centre point.
export async function backfillListingLocations() {
  const localities = await Locality.find({ 'location.coordinates': { $exists: true } });
  let n = 0;
  for (const loc of localities) {
    const r = await Listing.updateMany(
      { city: loc.city, locality: loc.name, 'location.coordinates': { $exists: false } },
      { $set: { location: { type: 'Point', coordinates: loc.location.coordinates } } }
    );
    n += r.modifiedCount;
  }
  return n;
}

export async function seedSamples() {
  const oldUsers = await User.find({ email: /@sample\.invalid$/ }, '_id');
  const ids = oldUsers.map((u) => u._id);
  await Listing.deleteMany({ $or: [{ isSample: true }, { seller: { $in: ids } }] });
  await SellerProfile.deleteMany({ user: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });

  // Unusable random password: sample accounts cannot be logged into.
  const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const sellers = {};
  for (const [i, s] of SAMPLE_SELLERS.entries()) {
    const user = await User.create({
      name: s.name, email: `seller-${s.key}@sample.invalid`, phone: `+9150000000${String(i).padStart(2, '0')}`.slice(0, 13),
      passwordHash: hash, phoneVerifiedAt: null,
    });
    await SellerProfile.create({
      user: user._id, displayName: s.name, sellerType: s.type, showContact: false,
      identityVerifiedAt: s.id ? new Date() : null, businessVerifiedAt: s.biz ? new Date() : null,
    });
    sellers[s.key] = user._id;
  }
  const cats = Object.fromEntries((await Category.find()).map((c) => [c.slug, c._id]));
  const locs = Object.fromEntries((await Locality.find({ city: 'Bengaluru' })).map((l) => [l.name, l.location]));
  for (const l of SAMPLE_LISTINGS) {
    const activatedAt = new Date(Date.now() - l.daysAgo * DAY);
    const { seller, daysAgo, cat, ...fields } = l;
    await Listing.create({
      ...fields, listingNo: `DS-${await nextSeq('listing')}`, seller: sellers[seller], category: cats[cat], city: 'Bengaluru',
      location: locs[fields.locality]?.coordinates?.length ? { type: 'Point', coordinates: locs[fields.locality].coordinates } : undefined,
      status: 'active', submittedAt: activatedAt, activatedAt, approvedAt: activatedAt, sellerAccessUntil: new Date('2099-12-31T00:00:00Z'), isSample: true,
    });
  }
  return SAMPLE_LISTINGS.length;
}
