import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { Category } from '../models/Category.js';
import { Listing } from '../models/Listing.js';
import { Locality } from '../models/Locality.js';
import { SellerProfile } from '../models/SellerProfile.js';
import { nextSeq } from '../models/Counter.js';
import { DELETABLE_STATUSES, LISTING_STATUSES, LIVE_STATUSES, SELLER_AVAILABILITY_TRANSITIONS } from '../lib/constants.js';
import { getEntitlement } from '../lib/entitlement.js';
import { formatBytes } from '../lib/format.js';
import { releaseStorage, reserveStorage } from '../lib/quota.js';
import { getSettings } from '../models/Settings.js';
import { listingOwner } from '../lib/serialize.js';
import { MAX_IMAGES_PER_LISTING, MAX_UPLOAD_BYTES, processListingImage } from '../lib/images.js';
import { storage } from '../lib/storage.js';
import { runListingChecks } from '../lib/moderation.js';
import { availabilitySchema, listingInputSchema, listingUpdateSchema } from '../lib/validation.js';

const r = Router();
r.use(requireAuth);

const FULLY_EDITABLE = ['draft', 'rejected'];
const NO_EDIT = ['sold', 'expired', 'removed'];
const UPLOAD_KEY = /^[A-Za-z0-9_-]{8,64}$/;

const subscriptionError = (ent) => ent.state === 'none'
  ? new HttpError(403, 'Verify your phone number to start your free trial.', undefined, 'subscription_required')
  : new HttpError(403, ent.state === 'grace' || ent.state === 'expired'
    ? 'Your subscription has ended. Renew it to add photos or publish listings.'
    : 'An active subscription is needed for this.', undefined, 'subscription_required');

// Ownership is enforced in the query itself: another seller's listing simply "does not exist".
// Content checks on a live listing that was just edited. A flagged edit takes it out of search until an admin looks.
async function recheckLive(l) {
  const flags = await runListingChecks(l, await getSettings(), { full: false });
  l.checkedAt = new Date();
  if (flags.length) Object.assign(l, { status: 'pending_review', moderationFlags: flags, submittedAt: new Date() });
}

async function ownListing(req) {
  const l = await Listing.findOne({ _id: req.params.id, seller: req.user._id });
  if (!l) throw new HttpError(404, 'Listing not found.');
  return l;
}

// Checks category, locality and spec keys against the database and returns cleaned values.
async function resolveRefs(data, current) {
  const out = { ...data };
  let category = null;
  if (data.categorySlug !== undefined) {
    category = await Category.findOne({ slug: data.categorySlug, active: true });
    if (!category) throw new HttpError(400, 'Choose a category from the list.', { categorySlug: 'Choose a category from the list.' });
    out.category = category._id;
  } else if (current) {
    category = await Category.findById(current.category);
  }
  delete out.categorySlug;

  if (data.locality !== undefined || data.city !== undefined) {
    const city = data.city ?? current?.city ?? 'Bengaluru';
    const locality = data.locality ?? current?.locality;
    const loc = await Locality.findOne({ city, name: locality, active: true });
    if (!loc) throw new HttpError(400, 'Choose a locality from the list.', { locality: 'Choose a locality from the list.' });
    out.city = city;
    // Approximate locality centre only, for "near" sorting. Never the seller's address.
    out.location = loc.location?.coordinates?.length === 2 ? { type: 'Point', coordinates: loc.location.coordinates } : undefined;
  }

  if (data.specs !== undefined) {
    const allowed = new Set((category?.specFields || []).map((f) => f.key));
    out.specs = Object.fromEntries(Object.entries(data.specs).filter(([k, v]) => allowed.has(k) && v !== ''));
  }
  // MRP is optional, but when given it must be above the asking price for the same quantity.
  const mrp = data.mrp !== undefined ? data.mrp : current?.mrp;
  const total = data.totalPrice ?? current?.totalPrice;
  if (mrp != null && total != null && mrp <= total) {
    throw new HttpError(400, 'MRP must be higher than your asking price.', { mrp: 'Enter the MRP for the same quantity, higher than your asking price, or leave it blank.' });
  }
  const unit = data.unit ?? current?.unit;
  if (unit === 'lot') out.quantity = 1; // a stock lot is sold as one unit
  return { out, category };
}

r.get('/', async (req, res) => {
  const filter = { seller: req.user._id };
  if (req.query.status && LISTING_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const listings = await Listing.find(filter).sort({ createdAt: -1 }).limit(200).populate('category', 'slug name specFields');
  res.json({ items: listings.map((l) => listingOwner(l, l.category)) });
});

r.post('/', async (req, res) => {
  const data = listingInputSchema.parse(req.body);
  const { out, category } = await resolveRefs(data, null);
  const listingNo = `DS-${await nextSeq('listing')}`;
  const l = await Listing.create({ ...out, listingNo, seller: req.user._id, status: 'draft' });
  res.status(201).json({ listing: listingOwner(l, category) });
});

r.get('/:id', async (req, res) => {
  const l = await ownListing(req);
  const category = await Category.findById(l.category);
  res.json({ listing: listingOwner(l, category) });
});

r.patch('/:id', async (req, res) => {
  const l = await ownListing(req);
  if (NO_EDIT.includes(l.status)) throw new HttpError(409, `A ${l.status} listing cannot be edited.`);
  const data = listingUpdateSchema.parse(req.body);

  if (!FULLY_EDITABLE.includes(l.status)) {
    // After submission the category is fixed: specs, review and (later) payment all depend on it.
    const current = await Category.findById(l.category);
    if (data.categorySlug && data.categorySlug !== current?.slug) throw new HttpError(409, 'The category cannot be changed after the listing is submitted.', { categorySlug: 'Locked after submission.' });
    // A paid listing cannot be turned into a different product.
    if (LIVE_STATUSES.includes(l.status) && data.title !== undefined && data.title !== l.title) {
      throw new HttpError(409, 'The title cannot be changed once a listing is approved.', { title: 'Locked after approval.' });
    }
    delete data.categorySlug;
  }

  const { out, category } = await resolveRefs(data, l);
  l.set(out);
  if (LIVE_STATUSES.includes(l.status) && l.isModified()) {
    l.editedAfterApprovalAt = new Date();
    await recheckLive(l);
  }
  await l.save();
  res.json({ listing: listingOwner(l, category) });
});

r.post('/:id/submit', async (req, res) => {
  const l = await ownListing(req);
  if (!FULLY_EDITABLE.includes(l.status)) throw new HttpError(409, 'Only drafts or rejected listings can be submitted for review.');
  // Listing problems first (fixable on the form), then account prerequisites.
  const category = await Category.findById(l.category);
  const specs = l.specs instanceof Map ? Object.fromEntries(l.specs) : l.specs || {};
  const missing = {};
  for (const f of category?.specFields || []) if (f.required && !specs[f.key]) missing[`specs.${f.key}`] = `${f.label} is required.`;
  if (l.description.length < 20) missing.description = 'Add a description of at least 20 characters.';
  if (!l.images.length) missing.images = 'Add at least one photo of the actual stock.';
  if (Object.keys(missing).length) throw new HttpError(400, 'Complete the required fields before submitting.', missing);

  if (!req.user.phoneVerifiedAt) throw new HttpError(403, 'Verify your phone number before submitting a listing.');
  const profile = await SellerProfile.findOne({ user: req.user._id });
  if (!profile?.showContact) throw new HttpError(403, 'Allow buyers to see your verified phone number (in your profile) before submitting. Buyers contact you by call or WhatsApp.');
  const { ent } = await getEntitlement(req.user);
  if (!ent.canSubmit) throw subscriptionError(ent);

  // Automatic checks decide: a clean listing goes live at once; anything flagged waits for an admin.
  // Settings can also require review for everything (manual mode) or for each seller's first N listings.
  const settings = await getSettings();
  const now = new Date();
  const flags = await runListingChecks(l, settings, { full: true, now });
  const approved = await Listing.countDocuments({ seller: req.user._id, approvedAt: { $ne: null } });
  const reviewFirst = approved < (settings.reviewFirstListings || 0);
  l.submittedAt = now;
  l.rejectionReason = '';
  l.moderationFlags = flags;
  l.checkedAt = now;
  if (!flags.length && !reviewFirst && settings.moderationMode !== 'manual') {
    Object.assign(l, { status: 'active', autoPublishedAt: now, activatedAt: l.activatedAt || now, sellerAccessUntil: ent.listingsVisibleUntil });
  } else {
    l.status = 'pending_review';
  }
  await l.save();
  res.json({ listing: listingOwner(l, category), reviewRequired: l.status === 'pending_review' });
});

r.post('/:id/availability', async (req, res) => {
  const l = await ownListing(req);
  const { status } = availabilitySchema.parse(req.body);
  const allowed = SELLER_AVAILABILITY_TRANSITIONS[l.status] || [];
  if (!allowed.includes(status)) throw new HttpError(409, `Cannot change a ${l.status.replace('_', ' ')} listing to ${status}.`);
  l.status = status;
  await l.save();
  const category = await Category.findById(l.category);
  res.json({ listing: listingOwner(l, category) });
});

r.delete('/:id', async (req, res) => {
  const l = await ownListing(req);
  if (!DELETABLE_STATUSES.includes(l.status)) {
    throw new HttpError(409, 'A listing removed by our team is kept as a record and cannot be deleted. Contact support if you think this is a mistake.');
  }
  // findOneAndDelete returns the document only to the request that actually deleted it, so storage is released once.
  const gone = await Listing.findOneAndDelete({ _id: l._id, seller: req.user._id });
  if (gone) {
    await releaseStorage(req.user._id, gone.images.reduce((s, i) => s + (i.bytes || 0), 0));
    await Promise.allSettled(gone.images.map((img) => storage.remove(img.key)));
  }
  res.json({ ok: true });
});

// ---- Photos ----
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 } });

r.post('/:id/images', upload.single('photo'), async (req, res) => {
  const l = await ownListing(req);
  if (NO_EDIT.includes(l.status)) throw new HttpError(409, `Photos of a ${l.status} listing cannot be changed.`);
  if (!req.file) throw new HttpError(400, 'Choose a photo to upload.');
  const uploadKey = UPLOAD_KEY.test(req.get('idempotency-key') || '') ? req.get('idempotency-key') : undefined;
  const category = await Category.findById(l.category);
  // A retried request (same key) returns the photo already saved, without storing or counting it again.
  if (uploadKey && l.images.some((i) => i.uploadKey === uploadKey)) return res.json({ listing: listingOwner(l, category), duplicate: true });
  if (l.images.length >= MAX_IMAGES_PER_LISTING) throw new HttpError(409, `A listing can have up to ${MAX_IMAGES_PER_LISTING} photos.`);

  const { ent } = await getEntitlement(req.user);
  if (!['trial', 'active'].includes(ent.state)) throw subscriptionError(ent);

  const processed = await processListingImage(req.file.buffer);
  const bytes = processed.full.length + processed.thumb.length; // what we actually store
  if (!(await reserveStorage(req.user._id, bytes, ent.allowanceBytes))) {
    throw new HttpError(413, `Not enough storage for this photo (${formatBytes(bytes)}). You have ${formatBytes(Math.max(0, ent.allowanceBytes - req.user.storageUsedBytes))} left of ${formatBytes(ent.allowanceBytes)}. Add storage or remove photos you no longer need.`, { images: 'Storage full.' }, 'storage_full');
  }
  let saved;
  try {
    saved = await storage.save(processed);
  } catch (e) {
    await releaseStorage(req.user._id, bytes); // a failed upload never uses storage
    throw e;
  }
  const image = { ...saved, width: processed.width, height: processed.height, bytes, phash: processed.phash, phashParts: processed.phashParts, ...(uploadKey ? { uploadKey } : {}) };
  // Atomic: under the photo limit and not a duplicate of a concurrent retry.
  const updated = await Listing.findOneAndUpdate(
    { _id: l._id, seller: req.user._id, [`images.${MAX_IMAGES_PER_LISTING - 1}`]: { $exists: false }, ...(uploadKey ? { 'images.uploadKey': { $ne: uploadKey } } : {}) },
    { $push: { images: image }, ...(LIVE_STATUSES.includes(l.status) ? { $set: { editedAfterApprovalAt: new Date() } } : {}) },
    { new: true }
  );
  if (!updated) {
    await releaseStorage(req.user._id, bytes);
    await storage.remove(saved.key).catch(() => {});
    const now = await Listing.findById(l._id);
    if (uploadKey && now?.images.some((i) => i.uploadKey === uploadKey)) return res.json({ listing: listingOwner(now, category), duplicate: true });
    throw new HttpError(409, `A listing can have up to ${MAX_IMAGES_PER_LISTING} photos.`);
  }
  if (LIVE_STATUSES.includes(updated.status)) {
    await recheckLive(updated);
    await updated.save();
  }
  res.status(201).json({ listing: listingOwner(updated, category) });
});

r.delete('/:id/images/:imageId', async (req, res) => {
  const l = await ownListing(req);
  if (NO_EDIT.includes(l.status)) throw new HttpError(409, `Photos of a ${l.status} listing cannot be changed.`);
  const img = l.images.id(req.params.imageId);
  if (!img) throw new HttpError(404, 'Photo not found.');
  if (l.images.length === 1 && !['draft', 'rejected'].includes(l.status)) throw new HttpError(409, 'A submitted listing needs at least one photo. Add another before removing this one.');
  // Pull atomically and release storage only if this request removed the photo.
  const before = await Listing.findOneAndUpdate(
    { _id: l._id, seller: req.user._id, 'images._id': img._id },
    { $pull: { images: { _id: img._id } } },
    { new: false }
  );
  if (before) {
    const removed = before.images.id(img._id);
    await releaseStorage(req.user._id, removed?.bytes || 0);
    await storage.remove(removed?.key).catch(() => {});
  }
  const fresh = await Listing.findById(l._id);
  const category = await Category.findById(fresh.category);
  res.json({ listing: listingOwner(fresh, category) });
});

const orderSchema = z.object({ ids: z.array(z.string()).max(MAX_IMAGES_PER_LISTING) });

// The first photo is the cover shown on cards.
r.put('/:id/images/order', async (req, res) => {
  const l = await ownListing(req);
  const { ids } = orderSchema.parse(req.body);
  const current = l.images.map((i) => String(i._id));
  if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
    throw new HttpError(400, 'Photo order does not match the listing photos.');
  }
  l.images = ids.map((id) => l.images.id(id));
  await l.save();
  const category = await Category.findById(l.category);
  res.json({ listing: listingOwner(l, category) });
});

export default r;
