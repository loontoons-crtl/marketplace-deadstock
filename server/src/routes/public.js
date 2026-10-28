import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../middleware/errors.js';
import { Category } from '../models/Category.js';
import { ContactEvent } from '../models/ContactEvent.js';
import { Listing } from '../models/Listing.js';
import { Locality } from '../models/Locality.js';
import { Report } from '../models/Report.js';
import { SellerProfile } from '../models/SellerProfile.js';
import { User } from '../models/User.js';
import { StorageProduct } from '../models/StorageProduct.js';
import { getSettings } from '../models/Settings.js';
import { CONDITIONS, PUBLIC_STATUSES, REPORT_REASONS, SELLER_TYPES, UNITS } from '../lib/constants.js';
import { haversineKm } from '../lib/geo.js';
import { listingPublic } from '../lib/serialize.js';
import { publicSearchSchema } from '../lib/validation.js';
import { visitorHash } from '../lib/visitor.js';

const r = Router();
const CATEGORY_FIELDS = 'slug name pattern colors specFields';
const NEAR_CANDIDATE_CAP = 1000; // listings considered for distance sorting per search

// Subscription lapse and seller suspension are enforced here, in the query, not just hidden in the UI.
// sellerAccessUntil = the end of the seller's grace period (see lib/entitlement.js).
export const visible = () => ({ status: { $in: PUBLIC_STATUSES }, sellerAccessUntil: { $gt: new Date() }, sellerSuspended: { $ne: true } });

async function attachSellers(listings, { withContact }) {
  const ids = [...new Set(listings.map((l) => String(l.seller)))];
  const [profiles, users] = await Promise.all([
    SellerProfile.find({ user: { $in: ids } }),
    withContact ? User.find({ _id: { $in: ids }, status: 'active' }) : [],
  ]);
  const pBy = new Map(profiles.map((p) => [String(p.user), p]));
  const uBy = new Map(users.map((u) => [String(u._id), u]));
  return listings.map((l) => listingPublic(l, { category: l.category, profile: pBy.get(String(l.seller)), user: uBy.get(String(l.seller)), withContact }));
}

r.get('/meta', async (req, res) => {
  const city = typeof req.query.city === 'string' ? req.query.city : 'Bengaluru';
  const [categories, localities, cities, brands, plans, settings] = await Promise.all([
    Category.find({ active: true }).sort({ order: 1, name: 1 }),
    Locality.find({ city, active: true }).sort({ name: 1 }),
    Locality.distinct('city', { active: true }),
    Listing.distinct('brand', { ...visible(), city, brand: { $ne: '' } }),
    StorageProduct.find({ kind: 'plan', active: true }).sort({ annualPrice: 1 }),
    getSettings(),
  ]);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, pattern: c.pattern, c: c.colors, subcategories: c.subcategories, specFields: c.specFields })),
    cities: cities.length ? cities.sort() : ['Bengaluru'],
    city,
    localities: localities.map((l) => l.name),
    // Localities that have a centre point, so "near" sorting can be offered for them.
    nearLocalities: localities.filter((l) => l.location?.coordinates?.length === 2).map((l) => l.name),
    conditions: CONDITIONS,
    units: UNITS,
    sellerTypes: SELLER_TYPES,
    reportReasons: REPORT_REASONS,
    brands: brands.sort((a, b) => a.localeCompare(b)),
    pricing: { trialDays: settings.trialDays, fromPrice: plans[0]?.annualPrice ?? null, plans: plans.map((p) => ({ name: p.name, storageBytes: p.storageBytes, annualPrice: p.annualPrice })), gstNote: settings.gstNote },
  });
});

r.get('/listings', async (req, res) => {
  const p = publicSearchSchema.parse(req.query);
  const city = p.city || 'Bengaluru';
  const filter = { ...visible(), city };
  if (p.cat) {
    const cat = await Category.findOne({ slug: p.cat });
    if (!cat) return res.json({ items: [], total: 0, page: 1, pages: 0 });
    filter.category = cat._id;
  }
  if (p.locality) filter.locality = p.locality;
  if (p.cond) filter.condition = p.cond;
  if (p.brand) filter.brand = p.brand;
  if (p.min != null || p.max != null) {
    filter.totalPrice = {};
    if (p.min != null) filter.totalPrice.$gte = p.min;
    if (p.max != null) filter.totalPrice.$lte = p.max;
  }
  if (p.exclude) filter.listingNo = { $ne: p.exclude };
  if (p.q) filter.$text = { $search: p.q };

  const page = p.page || 1;
  const limit = p.limit || 12;

  // Distance sort: from the chosen locality's approximate centre. Listings without coordinates
  // are placed last with no distance shown; a distance is never guessed.
  if (p.sort === 'near') {
    const origin = p.near ? await Locality.findOne({ city, name: p.near, active: true }) : null;
    if (!origin?.location?.coordinates?.length) throw new HttpError(400, 'Choose a locality to sort by distance.', { near: 'Choose a locality.' });
    const candidates = await Listing.find(filter, { location: 1, activatedAt: 1 }).limit(NEAR_CANDIDATE_CAP).lean();
    const scored = candidates.map((c) => ({
      id: c._id,
      d: c.location?.coordinates?.length === 2 ? haversineKm(origin.location.coordinates, c.location.coordinates) : null,
      t: c.activatedAt?.getTime() || 0,
    }));
    scored.sort((a, b) => (a.d == null) - (b.d == null) || (a.d ?? 0) - (b.d ?? 0) || b.t - a.t);
    const slice = scored.slice((page - 1) * limit, page * limit);
    const docs = await Listing.find({ _id: { $in: slice.map((s) => s.id) } }).populate('category', CATEGORY_FIELDS);
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const ordered = slice.map((s) => { const d = byId.get(String(s.id)); if (d && s.d != null) d.distanceKm = Math.round(s.d * 10) / 10; return d; }).filter(Boolean);
    const items = await attachSellers(ordered, { withContact: false });
    return res.json({ items, total: scored.length, page, pages: Math.ceil(scored.length / limit), near: origin.name });
  }

  let sort;
  let projection;
  if (p.q && (!p.sort || p.sort === 'relevance')) { projection = { score: { $meta: 'textScore' } }; sort = { score: { $meta: 'textScore' }, _id: -1 }; }
  if (!sort) sort = p.sort === 'low' ? { totalPrice: 1, _id: -1 } : p.sort === 'high' ? { totalPrice: -1, _id: -1 } : { activatedAt: -1, _id: -1 };

  const [docs, total] = await Promise.all([
    Listing.find(filter, projection).sort(sort).skip((page - 1) * limit).limit(limit).populate('category', CATEGORY_FIELDS),
    Listing.countDocuments(filter),
  ]);
  const items = await attachSellers(docs, { withContact: false }); // no phone numbers in bulk results
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

r.get('/listings/:listingNo', async (req, res) => {
  const l = await Listing.findOne({ ...visible(), listingNo: req.params.listingNo }).populate('category', CATEGORY_FIELDS);
  if (!l) throw new HttpError(404, 'This listing is not available. It may have sold or been removed.');
  Listing.updateOne({ _id: l._id }, { $inc: { views: 1 } }).catch(() => {}); // best-effort counter
  const [item] = await attachSellers([l], { withContact: true });
  res.json({ listing: item });
});

const contactLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, skip: () => config.isTest, standardHeaders: 'draft-8', legacyHeaders: false });
const contactSchema = z.object({ channel: z.enum(['call', 'whatsapp']) });
const CONTACT_DEDUPE_MS = 30 * 60 * 1000;

// Counts contact-button clicks for seller analytics. Repeat taps by the same visitor within
// 30 minutes count once. A click never marks a listing sold.
r.post('/listings/:listingNo/contact', contactLimiter, async (req, res) => {
  const { channel } = contactSchema.parse(req.body);
  const l = await Listing.findOne({ ...visible(), listingNo: req.params.listingNo }, { _id: 1, seller: 1 });
  if (!l) throw new HttpError(404, 'Listing not found.');
  const vh = visitorHash(req);
  const recent = await ContactEvent.exists({ listing: l._id, visitorHash: vh, channel, createdAt: { $gt: new Date(Date.now() - CONTACT_DEDUPE_MS) } });
  if (!recent) {
    await ContactEvent.create({ listing: l._id, seller: l.seller, channel, visitorHash: vh });
    await Listing.updateOne({ _id: l._id }, { $inc: { [`contactClicks.${channel}`]: 1 } });
  }
  res.json({ ok: true });
});

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 5, skip: () => config.isTest, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many reports from this connection. Please try again later.' },
});
const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { errorMap: () => ({ message: 'Choose a reason.' }) }),
  details: z.string().trim().max(1000).optional().default(''),
  contact: z.string().trim().max(120).optional().default(''),
});

// Anyone can report a live listing without logging in. Admins review reports; nothing is hidden automatically.
r.post('/listings/:listingNo/report', reportLimiter, async (req, res) => {
  const data = reportSchema.parse(req.body);
  if (data.reason === 'Other' && data.details.length < 10) throw new HttpError(400, 'Tell us what is wrong (at least 10 characters).', { details: 'Tell us what is wrong.' });
  const l = await Listing.findOne({ ...visible(), listingNo: req.params.listingNo }, { _id: 1 });
  if (!l) throw new HttpError(404, 'Listing not found.');
  const vh = visitorHash(req);
  if (await Report.exists({ listing: l._id, visitorHash: vh, status: 'open' })) {
    return res.json({ ok: true, duplicate: true }); // already reported; don't create noise
  }
  await Report.create({ listing: l._id, reason: data.reason, details: data.details, reporterContact: data.contact, reporterUser: req.user?._id || null, visitorHash: vh });
  res.status(201).json({ ok: true });
});

export default r;
