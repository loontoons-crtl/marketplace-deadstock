import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { AdminAuditLog, audit } from '../models/AdminAuditLog.js';
import { Category } from '../models/Category.js';
import { ContactEvent } from '../models/ContactEvent.js';
import { Listing } from '../models/Listing.js';
import { Locality } from '../models/Locality.js';
import { Report } from '../models/Report.js';
import { SellerProfile } from '../models/SellerProfile.js';
import { User } from '../models/User.js';
import { LISTING_STATUSES, LIVE_STATUSES } from '../lib/constants.js';
import { Payment } from '../models/Payment.js';
import { Settings, clearSettingsCache, getSettings } from '../models/Settings.js';
import { StorageProduct } from '../models/StorageProduct.js';
import { Subscription } from '../models/Subscription.js';
import { computeEntitlement, getEntitlement, refreshSellerAccess } from '../lib/entitlement.js';
import { quoteAddon, quoteSubscription, settlePayment } from '../lib/billing.js';
import { recalcStorage, releaseStorage } from '../lib/quota.js';

// Every route here requires an administrator. The role is read from the database on each request.
const r = Router();
r.use(requireRole('admin'));

const DAY = 864e5;
const PAGE = 25;
const reason = (label, min = 5) => z.string().trim().min(min, `${label} must be at least ${min} characters.`).max(500);
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageOf = (q) => Math.max(1, Math.min(1000, Number(q.page) || 1));

function adminListing(l, { profile, user, openReports = 0 } = {}) {
  return {
    _id: l._id, id: l.listingNo, title: l.title, status: l.status, isSample: l.isSample,
    category: l.category?.name, categorySlug: l.category?.slug, subcategory: l.subcategory, brand: l.brand, model: l.model,
    condition: l.condition, quantity: l.quantity, unit: l.unit, totalPrice: l.totalPrice, mrp: l.mrp ?? null, minOrderQty: l.minOrderQty,
    locality: l.locality, city: l.city, description: l.description, pickupDetails: l.pickupDetails,
    specs: Object.fromEntries((l.category?.specFields || []).filter((f) => l.specs?.get?.(f.key)).map((f) => [f.label, l.specs.get(f.key)])),
    images: (l.images || []).map((i) => ({ url: i.url, thumb: i.thumbUrl })),
    submittedAt: l.submittedAt, reviewedAt: l.reviewedAt, activatedAt: l.activatedAt, approvedAt: l.approvedAt, autoPublished: Boolean(l.autoPublishedAt),
    sellerAccessUntil: l.sellerAccessUntil, rejectionReason: l.rejectionReason, removedReason: l.removedReason,
    storageBytes: (l.images || []).reduce((s, i) => s + (i.bytes || 0), 0),
    editedAfterApprovalAt: l.editedAfterApprovalAt, sellerSuspended: l.sellerSuspended,
    flags: (l.moderationFlags || []).map((f) => ({ code: f.code, message: f.message, sellerVisible: f.sellerVisible })), checkedAt: l.checkedAt,
    views: l.views, contactClicks: l.contactClicks, createdAt: l.createdAt, updatedAt: l.updatedAt, openReports,
    seller: user ? {
      _id: user._id, name: user.name, email: user.email, phone: user.phone, phoneVerified: Boolean(user.phoneVerifiedAt), status: user.status,
      displayName: profile?.displayName, sellerType: profile?.sellerType, showContact: profile?.showContact,
      idVerified: Boolean(profile?.identityVerifiedAt), bizVerified: Boolean(profile?.businessVerifiedAt),
    } : null,
  };
}

async function withSellers(listings) {
  const ids = [...new Set(listings.map((l) => String(l.seller)))];
  const [users, profiles, reports] = await Promise.all([
    User.find({ _id: { $in: ids } }),
    SellerProfile.find({ user: { $in: ids } }),
    Report.aggregate([{ $match: { listing: { $in: listings.map((l) => l._id) }, status: 'open' } }, { $group: { _id: '$listing', n: { $sum: 1 } } }]),
  ]);
  const u = new Map(users.map((x) => [String(x._id), x]));
  const p = new Map(profiles.map((x) => [String(x.user), x]));
  const rep = new Map(reports.map((x) => [String(x._id), x.n]));
  return listings.map((l) => adminListing(l, { user: u.get(String(l.seller)), profile: p.get(String(l.seller)), openReports: rep.get(String(l._id)) || 0 }));
}

async function findListing(id) {
  const l = await Listing.findById(id).populate('category', 'slug name specFields');
  if (!l) throw new HttpError(404, 'Listing not found.');
  return l;
}

// ---------- Overview ----------
r.get('/overview', async (req, res) => {
  const now = new Date();
  const settings = await getSettings();
  const [byStatus, liveCount, sellers, suspended, openReports, last30, contacts30, edited, subs, paid30, paidAll, storage] = await Promise.all([
    Listing.aggregate([{ $match: { isSample: false } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Listing.countDocuments({ status: { $in: ['active', 'reserved'] }, sellerAccessUntil: { $gt: now }, sellerSuspended: { $ne: true }, isSample: false }),
    User.countDocuments({ role: 'seller', email: { $not: /@sample\.invalid$/ } }),
    User.countDocuments({ status: 'suspended' }),
    Report.countDocuments({ status: 'open' }),
    Listing.countDocuments({ isSample: false, createdAt: { $gt: new Date(now - 30 * DAY) } }),
    ContactEvent.countDocuments({ createdAt: { $gt: new Date(now - 30 * DAY) } }),
    Listing.countDocuments({ editedAfterApprovalAt: { $ne: null }, isSample: false }),
    Subscription.find({}, { kind: 1, expiresAt: 1, endedEarlyAt: 1, startsAt: 1, plan: 1, addons: 1 }),
    Payment.aggregate([{ $match: { status: 'paid', paidAt: { $gt: new Date(now - 30 * DAY) } } }, { $group: { _id: null, paise: { $sum: '$amountPaise' } } }]),
    Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, paise: { $sum: '$amountPaise' }, n: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: null, bytes: { $sum: '$storageUsedBytes' } } }]),
  ]);
  const states = { trial: 0, active: 0, grace: 0, expired: 0 };
  let expiring30 = 0;
  for (const sub of subs) {
    const e = computeEntitlement(sub, settings, 0, now);
    states[e.state] += 1;
    if (e.state === 'active' && e.endsAt < new Date(+now + 30 * DAY)) expiring30 += 1;
  }
  res.json({
    statusCounts: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
    liveListings: liveCount, sellers, suspendedAccounts: suspended, openReports, listingsCreated30d: last30,
    contactClicks30d: contacts30, editedAfterApproval: edited,
    subscriptions: { ...states, expiringIn30d: expiring30 },
    revenue: { last30d: (paid30[0]?.paise || 0) / 100, total: (paidAll[0]?.paise || 0) / 100, payments: paidAll[0]?.n || 0 },
    storageUsedBytes: storage[0]?.bytes || 0,
    note: 'Sample listings are excluded. Revenue = verified and recorded payments (Razorpay and offline).',
  });
});

// ---------- Listings ----------
r.get('/listings', async (req, res) => {
  const page = pageOf(req.query);
  const filter = {};
  const status = String(req.query.status || 'pending_review');
  if (status === 'edited') filter.editedAfterApprovalAt = { $ne: null };
  else if (status !== 'all') {
    if (!LISTING_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status filter.');
    filter.status = status;
  }
  if (req.query.samples !== '1') filter.isSample = false;
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q) filter.$or = [{ listingNo: q.toUpperCase() }, { title: { $regex: escapeRx(q), $options: 'i' } }];
  // Review queue is oldest first so nobody waits indefinitely.
  const sort = status === 'pending_review' ? { submittedAt: 1 } : status === 'edited' ? { editedAfterApprovalAt: -1 } : { updatedAt: -1 };
  const [docs, total] = await Promise.all([
    Listing.find(filter).sort(sort).skip((page - 1) * PAGE).limit(PAGE).populate('category', 'slug name specFields'),
    Listing.countDocuments(filter),
  ]);
  res.json({ items: await withSellers(docs), total, page, pages: Math.ceil(total / PAGE) });
});

r.get('/listings/:id', async (req, res) => {
  const l = await findListing(req.params.id);
  const [[item], reports, history] = await Promise.all([
    withSellers([l]),
    Report.find({ listing: l._id }).sort({ createdAt: -1 }).limit(50),
    AdminAuditLog.find({ targetType: 'listing', targetId: l._id }).sort({ createdAt: -1 }).limit(50).populate('admin', 'name'),
  ]);
  res.json({
    listing: item,
    reports: reports.map((x) => ({ _id: x._id, reason: x.reason, details: x.details, contact: x.reporterContact, status: x.status, createdAt: x.createdAt, resolutionNote: x.resolutionNote })),
    history: history.map((h) => ({ action: h.action, admin: h.admin?.name, details: h.details, at: h.createdAt })),
  });
});

r.post('/listings/:id/approve', async (req, res) => {
  const { note } = z.object({ note: z.string().trim().max(500).optional().default('') }).parse(req.body);
  const l = await findListing(req.params.id);
  if (l.status !== 'pending_review') throw new HttpError(409, `Only listings pending review can be approved (this one is ${l.status}).`);
  const { ent } = await getEntitlement(l.seller);
  const now = new Date();
  // Goes live immediately; it stays visible while the seller's subscription (plus grace) lasts.
  const flags = (l.moderationFlags || []).map((f) => f.code);
  Object.assign(l, { status: 'active', approvedAt: now, reviewedAt: now, reviewedBy: req.user._id, rejectionReason: '', activatedAt: l.activatedAt || now, sellerAccessUntil: ent.listingsVisibleUntil, moderationFlags: [], editedAfterApprovalAt: null });
  await l.save();
  await audit(req, 'listing.approve', 'listing', l, l.listingNo, { note, flagsCleared: flags });
  res.json({ listing: (await withSellers([l]))[0] });
});

r.post('/listings/:id/reject', async (req, res) => {
  const { reason: why } = z.object({ reason: reason('Reason', 10) }).parse(req.body);
  const l = await findListing(req.params.id);
  if (l.status !== 'pending_review') throw new HttpError(409, `Only listings pending review can be rejected (this one is ${l.status}).`);
  Object.assign(l, { status: 'rejected', rejectionReason: why, reviewedAt: new Date(), reviewedBy: req.user._id });
  await l.save();
  await audit(req, 'listing.reject', 'listing', l, l.listingNo, { reason: why });
  res.json({ listing: (await withSellers([l]))[0] });
});

// Takes a listing down for policy reasons. The seller sees the reason and cannot edit it.
r.post('/listings/:id/remove', async (req, res) => {
  const { reason: why } = z.object({ reason: reason('Reason', 10) }).parse(req.body);
  const l = await findListing(req.params.id);
  if (['removed', 'draft'].includes(l.status)) throw new HttpError(409, `A ${l.status} listing cannot be removed.`);
  const from = l.status;
  Object.assign(l, { status: 'removed', removedReason: why });
  await l.save();
  // Photos are kept as a moderation record but no longer count against the seller's storage.
  await releaseStorage(l.seller, l.images.reduce((s, i) => s + (i.bytes || 0), 0));
  await audit(req, 'listing.remove', 'listing', l, l.listingNo, { reason: why, from });
  res.json({ listing: (await withSellers([l]))[0] });
});

// Marks an edited live listing as re-checked.
r.post('/listings/:id/clear-edit-flag', async (req, res) => {
  const l = await findListing(req.params.id);
  if (!l.editedAfterApprovalAt) return res.json({ listing: (await withSellers([l]))[0] });
  l.editedAfterApprovalAt = null;
  await l.save();
  await audit(req, 'listing.recheck_ok', 'listing', l, l.listingNo);
  res.json({ listing: (await withSellers([l]))[0] });
});

// ---------- Reports ----------
r.get('/reports', async (req, res) => {
  const page = pageOf(req.query);
  const status = ['open', 'dismissed', 'actioned', 'all'].includes(req.query.status) ? req.query.status : 'open';
  const filter = status === 'all' ? {} : { status };
  const [docs, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: status === 'open' ? 1 : -1 }).skip((page - 1) * PAGE).limit(PAGE).populate('listing', 'listingNo title status').populate('resolvedBy', 'name'),
    Report.countDocuments(filter),
  ]);
  res.json({
    items: docs.map((x) => ({
      _id: x._id, reason: x.reason, details: x.details, contact: x.reporterContact, status: x.status, createdAt: x.createdAt,
      resolutionNote: x.resolutionNote, resolvedBy: x.resolvedBy?.name, resolvedAt: x.resolvedAt,
      listing: x.listing ? { _id: x.listing._id, id: x.listing.listingNo, title: x.listing.title, status: x.listing.status } : null,
    })),
    total, page, pages: Math.ceil(total / PAGE),
  });
});

r.post('/reports/:id/resolve', async (req, res) => {
  const body = z.object({ outcome: z.enum(['dismissed', 'actioned']), note: reason('Note', 3), removeListing: z.boolean().optional().default(false) }).parse(req.body);
  const rep = await Report.findById(req.params.id);
  if (!rep) throw new HttpError(404, 'Report not found.');
  if (rep.status !== 'open') throw new HttpError(409, 'This report is already resolved.');
  const l = await Listing.findById(rep.listing);
  if (body.removeListing) {
    if (body.outcome !== 'actioned') throw new HttpError(400, 'Removing the listing counts as action taken.');
    if (l && l.status !== 'removed') {
      const from = l.status;
      Object.assign(l, { status: 'removed', removedReason: body.note });
      await l.save();
      await releaseStorage(l.seller, l.images.reduce((s, i) => s + (i.bytes || 0), 0));
      await audit(req, 'listing.remove', 'listing', l, l.listingNo, { reason: body.note, from, report: rep._id });
    }
  }
  Object.assign(rep, { status: body.outcome, resolutionNote: body.note, resolvedBy: req.user._id, resolvedAt: new Date() });
  await rep.save();
  await audit(req, `report.${body.outcome}`, 'report', rep, l?.listingNo || '', { note: body.note, removedListing: body.removeListing });
  res.json({ ok: true });
});

// ---------- Sellers ----------
r.get('/sellers', async (req, res) => {
  const page = pageOf(req.query);
  const filter = { email: { $not: /@sample\.invalid$/ } };
  if (['active', 'suspended'].includes(req.query.status)) filter.status = req.query.status;
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q) filter.$or = [{ email: { $regex: escapeRx(q), $options: 'i' } }, { name: { $regex: escapeRx(q), $options: 'i' } }, { phone: { $regex: escapeRx(q.replace(/\s/g, '')) } }];
  const [users, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE).limit(PAGE), User.countDocuments(filter)]);
  const ids = users.map((u) => u._id);
  const [profiles, counts, subs, settings] = await Promise.all([
    SellerProfile.find({ user: { $in: ids } }),
    Listing.aggregate([{ $match: { seller: { $in: ids } } }, { $group: { _id: '$seller', n: { $sum: 1 } } }]),
    Subscription.find({ seller: { $in: ids } }),
    getSettings(),
  ]);
  const p = new Map(profiles.map((x) => [String(x.user), x]));
  const c = new Map(counts.map((x) => [String(x._id), x.n]));
  const sb = new Map(subs.map((x) => [String(x.seller), x]));
  res.json({
    items: users.map((u) => {
      const e = computeEntitlement(sb.get(String(u._id)), settings, u.storageUsedBytes || 0);
      return { ...sellerRow(u, p.get(String(u._id)), c.get(String(u._id)) || 0), subscription: { state: e.state, planName: e.planName, endsAt: e.endsAt, allowanceBytes: e.allowanceBytes, usedBytes: e.usedBytes } };
    }),
    total, page, pages: Math.ceil(total / PAGE),
  });
});

function sellerRow(u, prof, listingCount) {
  return {
    _id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, suspendedReason: u.suspendedReason,
    phoneVerified: Boolean(u.phoneVerifiedAt), createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, listingCount,
    storageUsedBytes: u.storageUsedBytes || 0,
    profile: prof ? {
      displayName: prof.displayName, sellerType: prof.sellerType, businessName: prof.businessName, gstin: prof.gstin, about: prof.about,
      locality: prof.locality, showContact: prof.showContact,
      idVerified: Boolean(prof.identityVerifiedAt), idMethod: prof.identityVerification?.method || '',
      bizVerified: Boolean(prof.businessVerifiedAt), bizMethod: prof.businessVerification?.method || '',
    } : null,
  };
}

r.get('/sellers/:id', async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new HttpError(404, 'Seller not found.');
  const [prof, listings, history] = await Promise.all([
    SellerProfile.findOne({ user: u._id }),
    Listing.find({ seller: u._id }).sort({ createdAt: -1 }).limit(100).populate('category', 'slug name'),
    AdminAuditLog.find({ targetType: 'user', targetId: u._id }).sort({ createdAt: -1 }).limit(50).populate('admin', 'name'),
  ]);
  const [{ ent, sub }, payments] = await Promise.all([
    getEntitlement(u),
    Payment.find({ seller: u._id }).sort({ createdAt: -1 }).limit(50),
  ]);
  res.json({
    seller: sellerRow(u, prof, listings.length),
    subscription: { ...ent, addons: (sub?.addons || []).map((a) => ({ _id: a._id, name: a.name, storageBytes: a.storageBytes, expiresAt: a.expiresAt })) },
    payments: payments.map(paymentRow),
    listings: listings.map((l) => ({ _id: l._id, id: l.listingNo, title: l.title, status: l.status, totalPrice: l.totalPrice, createdAt: l.createdAt, storageBytes: l.images.reduce((t, i) => t + (i.bytes || 0), 0) })),
    history: history.map((h) => ({ action: h.action, admin: h.admin?.name, details: h.details, at: h.createdAt })),
  });
});

// Identity and business are verified separately. We record how it was checked, not the documents.
r.post('/sellers/:id/verify', async (req, res) => {
  const body = z.object({
    kind: z.enum(['identity', 'business']),
    verified: z.boolean(),
    method: z.string().trim().max(300).optional().default(''),
  }).parse(req.body);
  if (body.verified && body.method.length < 5) throw new HttpError(400, 'Describe how you checked (at least 5 characters).', { method: 'Required when verifying.' });
  const u = await User.findById(req.params.id);
  const prof = u && await SellerProfile.findOne({ user: u._id });
  if (!prof) throw new HttpError(404, 'Seller profile not found.');
  if (body.kind === 'business' && body.verified && !prof.gstin && !/gst|registration|licen[cs]e|udyam/i.test(body.method)) {
    throw new HttpError(400, 'Business verification needs a GSTIN on the profile, or a note naming the registration you checked (e.g. Udyam, trade licence).', { method: 'Name the registration checked.' });
  }
  const at = body.verified ? new Date() : null;
  const record = body.verified ? { by: req.user._id, method: body.method } : { by: null, method: '' };
  if (body.kind === 'identity') { prof.identityVerifiedAt = at; prof.identityVerification = record; }
  else { prof.businessVerifiedAt = at; prof.businessVerification = record; }
  await prof.save();
  await audit(req, `seller.${body.verified ? 'verify' : 'unverify'}_${body.kind}`, 'user', u, u.email, { method: body.method });
  res.json({ seller: sellerRow(u, prof, await Listing.countDocuments({ seller: u._id })) });
});

r.post('/sellers/:id/suspend', async (req, res) => {
  const { reason: why } = z.object({ reason: reason('Reason', 10) }).parse(req.body);
  const u = await User.findById(req.params.id);
  if (!u) throw new HttpError(404, 'Seller not found.');
  if (String(u._id) === String(req.user._id)) throw new HttpError(409, 'You cannot suspend your own account.');
  if (u.role === 'admin') throw new HttpError(409, 'Remove admin rights before suspending an administrator.');
  if (u.status === 'suspended') throw new HttpError(409, 'Already suspended.');
  Object.assign(u, { status: 'suspended', suspendedReason: why });
  await u.save();
  const { modifiedCount } = await Listing.updateMany({ seller: u._id }, { sellerSuspended: true });
  await audit(req, 'seller.suspend', 'user', u, u.email, { reason: why, listingsHidden: modifiedCount });
  res.json({ seller: sellerRow(u, await SellerProfile.findOne({ user: u._id }), await Listing.countDocuments({ seller: u._id })) });
});

r.post('/sellers/:id/unsuspend', async (req, res) => {
  const { note } = z.object({ note: reason('Note', 5) }).parse(req.body);
  const u = await User.findById(req.params.id);
  if (!u) throw new HttpError(404, 'Seller not found.');
  if (u.status !== 'suspended') throw new HttpError(409, 'This account is not suspended.');
  Object.assign(u, { status: 'active', suspendedReason: '' });
  await u.save();
  await Listing.updateMany({ seller: u._id }, { sellerSuspended: false });
  await audit(req, 'seller.unsuspend', 'user', u, u.email, { note });
  res.json({ seller: sellerRow(u, await SellerProfile.findOne({ user: u._id }), await Listing.countDocuments({ seller: u._id })) });
});

// ---------- Subscriptions and payments ----------
function paymentRow(p) {
  return {
    _id: p._id, seller: p.seller?._id || p.seller, sellerName: p.seller?.name, sellerEmail: p.seller?.email,
    purpose: p.purpose, method: p.method, status: p.status, amount: p.amountPaise / 100, item: p.item?.name,
    storageBytes: p.item?.storageBytes, razorpayOrderId: p.razorpayOrderId, razorpayPaymentId: p.razorpayPaymentId,
    reference: p.manualReference, note: p.note, failureReason: p.failureReason, createdAt: p.createdAt, paidAt: p.paidAt,
  };
}

async function sellerUser(id) {
  const u = await User.findById(id);
  if (!u) throw new HttpError(404, 'Seller not found.');
  return u;
}

// Records an offline payment (UPI, bank transfer, cash) or a deliberate free grant and applies it.
// The amount is what was actually received (0 for a free grant) and is stored as such.
const grantSchema = z.object({
  productId: z.string().min(1),
  keepAddonIds: z.array(z.string()).max(20).optional().default([]),
  amountReceived: z.number().int().min(0).max(10_000_000),
  reference: z.string().trim().max(120).optional().default(''),
  note: reason('Note', 5),
});
r.post('/sellers/:id/grant', async (req, res) => {
  const body = grantSchema.parse(req.body);
  const u = await sellerUser(req.params.id);
  const product = await StorageProduct.findById(body.productId);
  if (!product) throw new HttpError(400, 'Choose a plan or add-on.');
  const q = product.kind === 'plan'
    ? await quoteSubscription(u, { productId: product._id, keepAddonIds: body.keepAddonIds })
    : await quoteAddon(u, { productId: product._id });
  const payment = await Payment.create({
    seller: u._id, purpose: q.purpose, method: 'manual', item: q.item, amountPaise: body.amountReceived * 100,
    manualReference: body.reference, recordedBy: req.user._id, note: body.note,
  });
  await settlePayment(payment._id);
  await audit(req, `subscription.grant_${q.purpose}`, 'user', u, u.email, { item: q.item.name, listPrice: q.amount, amountReceived: body.amountReceived, reference: body.reference, note: body.note });
  res.json({ ok: true, payment: paymentRow(await Payment.findById(payment._id)) });
});

// Ends a subscription now (e.g. after a refund). The normal grace period then applies; nothing is deleted.
r.post('/sellers/:id/end-subscription', async (req, res) => {
  const { reason: why } = z.object({ reason: reason('Reason', 10) }).parse(req.body);
  const u = await sellerUser(req.params.id);
  const sub = await Subscription.findOne({ seller: u._id });
  if (!sub) throw new HttpError(404, 'This seller has no subscription.');
  sub.endedEarlyAt = new Date();
  await sub.save();
  await refreshSellerAccess(u._id);
  await audit(req, 'subscription.end', 'user', u, u.email, { reason: why });
  res.json({ ok: true });
});

r.post('/sellers/:id/recalc-storage', async (req, res) => {
  const u = await sellerUser(req.params.id);
  const before = u.storageUsedBytes || 0;
  const after = await recalcStorage(u._id);
  if (after.bytes !== before) await audit(req, 'storage.recalculate', 'user', u, u.email, { before, after: after.bytes });
  res.json({ before, after: after.bytes, photos: after.photos });
});

r.get('/payments', async (req, res) => {
  const page = pageOf(req.query);
  const filter = {};
  if (['created', 'paid', 'failed', 'refunded'].includes(req.query.status)) filter.status = req.query.status;
  if (['razorpay', 'manual'].includes(req.query.method)) filter.method = req.query.method;
  const [docs, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE).limit(PAGE).populate('seller', 'name email'),
    Payment.countDocuments(filter),
  ]);
  res.json({ items: docs.map(paymentRow), total, page, pages: Math.ceil(total / PAGE) });
});

// Records that a refund was issued (in the Razorpay dashboard or offline). Money is not moved from here.
r.post('/payments/:id/record-refund', async (req, res) => {
  const { note } = z.object({ note: reason('Note', 5) }).parse(req.body);
  const p = await Payment.findOneAndUpdate({ _id: req.params.id, status: 'paid' }, { $set: { status: 'refunded', note } }, { new: true });
  if (!p) throw new HttpError(409, 'Only a paid payment can be marked as refunded.');
  await audit(req, 'payment.record_refund', 'user', p.seller, String(p._id), { note, amount: p.amountPaise / 100 });
  res.json({ payment: paymentRow(p) });
});

// ---------- Plans, add-ons and platform settings ----------
const productSchema = z.object({
  kind: z.enum(['plan', 'addon']),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().default(''),
  storageMB: z.number().int().min(1, 'Storage must be at least 1 MB.').max(10_000_000),
  annualPrice: z.number().int().min(0).max(10_000_000),
  durationDays: z.number().int().min(1).max(3660).optional().default(365),
  active: z.boolean().optional().default(false),
  order: z.number().int().min(0).max(999).optional(),
});
const productRow = (p) => ({ _id: p._id, kind: p.kind, name: p.name, description: p.description, storageBytes: p.storageBytes, storageMB: Math.round(p.storageBytes / 1024 ** 2), annualPrice: p.annualPrice, durationDays: p.durationDays, active: p.active, order: p.order, updatedAt: p.updatedAt });

r.get('/storage-products', async (req, res) => {
  const items = await StorageProduct.find().sort({ kind: 1, order: 1, annualPrice: 1 });
  res.json({ items: items.map(productRow) });
});

r.post('/storage-products', async (req, res) => {
  const b = productSchema.parse(req.body);
  const p = await StorageProduct.create({ ...b, storageBytes: b.storageMB * 1024 ** 2, order: b.order ?? (await StorageProduct.countDocuments({ kind: b.kind })) });
  await audit(req, 'pricing.create', 'pricing', p, p.name, { kind: p.kind, storageMB: b.storageMB, annualPrice: p.annualPrice, active: p.active });
  res.status(201).json({ product: productRow(p) });
});

// Price and storage changes apply to new purchases only; existing subscriptions keep what they bought.
r.patch('/storage-products/:id', async (req, res) => {
  const b = productSchema.omit({ kind: true }).partial().strict().parse(req.body);
  const p = await StorageProduct.findById(req.params.id);
  if (!p) throw new HttpError(404, 'Not found.');
  const before = productRow(p);
  if (b.storageMB !== undefined) { p.storageBytes = b.storageMB * 1024 ** 2; delete b.storageMB; }
  p.set(b);
  await p.save();
  await audit(req, 'pricing.update', 'pricing', p, p.name, { before: { annualPrice: before.annualPrice, storageMB: before.storageMB, active: before.active }, after: { annualPrice: p.annualPrice, storageMB: Math.round(p.storageBytes / 1024 ** 2), active: p.active } });
  res.json({ product: productRow(p) });
});

const settingsSchema = z.object({
  trialDays: z.number().int().min(0).max(365),
  trialStorageMB: z.number().int().min(0).max(1_000_000),
  graceDays: z.number().int().min(0).max(90),
  retentionDays: z.number().int().min(30).max(3650),
  reviewFirstListings: z.number().int().min(0).max(1000),
  moderationMode: z.enum(['auto', 'manual']),
  blockedWords: z.array(z.string().trim().min(2).max(40)).max(200),
  reminderDays: z.array(z.number().int().min(1).max(90)).min(1).max(5),
  gstNote: z.string().trim().max(200),
  refundTerms: z.string().trim().max(1000),
}).partial().strict();
const settingsOut = (s) => ({ ...s, trialStorageMB: Math.round(s.trialStorageBytes / 1024 ** 2) });

r.get('/settings', async (req, res) => res.json({ settings: settingsOut(await getSettings({ fresh: true })) }));

r.patch('/settings', async (req, res) => {
  const b = settingsSchema.parse(req.body);
  const set = { ...b };
  if (b.trialStorageMB !== undefined) { set.trialStorageBytes = b.trialStorageMB * 1024 ** 2; delete set.trialStorageMB; }
  if (set.blockedWords) set.blockedWords = [...new Set(set.blockedWords.map((w) => w.toLowerCase()))];
  if (set.reminderDays) set.reminderDays = [...new Set(set.reminderDays)].sort((x, y) => y - x);
  const before = await getSettings({ fresh: true });
  await Settings.updateOne({ _id: 'platform' }, { $set: set }, { upsert: true });
  clearSettingsCache();
  const after = await getSettings({ fresh: true });
  // A grace-period change moves every seller's visibility window.
  if (b.graceDays !== undefined && b.graceDays !== before.graceDays) {
    const sellers = await Subscription.distinct('seller');
    for (const id of sellers) await refreshSellerAccess(id);
  }
  await audit(req, 'settings.update', 'settings', req.user._id, 'platform settings', { changed: Object.keys(b), ...b });
  res.json({ settings: settingsOut(after) });
});

// ---------- Categories ----------
const specFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/, 'Keys use letters and numbers only, starting with a letter.'),
  label: z.string().trim().min(1).max(60),
  placeholder: z.string().trim().max(80).optional().default(''),
  required: z.boolean().optional().default(false),
});
const categorySchema = z.object({
  name: z.string().trim().min(3).max(80),
  subcategories: z.array(z.string().trim().min(1).max(60)).max(30).optional().default([]),
  specFields: z.array(specFieldSchema).max(15).optional().default([])
    .refine((a) => new Set(a.map((f) => f.key)).size === a.length, 'Each specification key must be unique.'),
  pattern: z.enum(['wood', 'louver', 'tile', 'stone', 'plain']).optional(),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).length(2).optional(),
  order: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

r.get('/categories', async (req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find().sort({ order: 1, name: 1 }),
    Listing.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]),
  ]);
  const c = new Map(counts.map((x) => [String(x._id), x.n]));
  res.json({ items: cats.map((x) => ({ _id: x._id, slug: x.slug, name: x.name, subcategories: x.subcategories, specFields: x.specFields, pattern: x.pattern, colors: x.colors, order: x.order, active: x.active, listingCount: c.get(String(x._id)) || 0 })) });
});

r.post('/categories', async (req, res) => {
  const body = categorySchema.extend({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, 'Use lowercase letters, numbers and hyphens.') }).parse(req.body);
  const cat = await Category.create({ ...body, order: body.order ?? (await Category.countDocuments()) });
  await audit(req, 'category.create', 'category', cat, cat.slug, { name: cat.name });
  res.status(201).json({ category: cat });
});

// The slug is fixed after creation because search URLs use it.
r.patch('/categories/:id', async (req, res) => {
  const body = categorySchema.partial().strict().parse(req.body);
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new HttpError(404, 'Category not found.');
  const before = { name: cat.name, active: cat.active, specKeys: cat.specFields.map((f) => f.key) };
  cat.set(body);
  await cat.save();
  await audit(req, 'category.update', 'category', cat, cat.slug, { before, changed: Object.keys(body) });
  res.json({ category: cat });
});

// ---------- Localities ----------
const coordsSchema = z.object({ lat: z.number().min(6).max(37), lng: z.number().min(68).max(98) }).nullable(); // India bounds

r.get('/localities', async (req, res) => {
  const city = String(req.query.city || 'Bengaluru');
  const [locs, counts] = await Promise.all([
    Locality.find({ city }).sort({ name: 1 }),
    Listing.aggregate([{ $match: { city } }, { $group: { _id: '$locality', n: { $sum: 1 } } }]),
  ]);
  const c = new Map(counts.map((x) => [x._id, x.n]));
  res.json({ items: locs.map((l) => ({ _id: l._id, city: l.city, name: l.name, active: l.active, lat: l.location?.coordinates?.[1] ?? null, lng: l.location?.coordinates?.[0] ?? null, listingCount: c.get(l.name) || 0 })) });
});

r.post('/localities', async (req, res) => {
  const body = z.object({ city: z.string().trim().min(2).max(60).default('Bengaluru'), name: z.string().trim().min(2).max(60), coords: coordsSchema.optional().default(null) }).parse(req.body);
  const loc = await Locality.create({ city: body.city, name: body.name, ...(body.coords ? { location: { type: 'Point', coordinates: [body.coords.lng, body.coords.lat] } } : {}) });
  await audit(req, 'locality.create', 'locality', loc, `${loc.name}, ${loc.city}`, body.coords || {});
  res.status(201).json({ ok: true });
});

// Renaming is not allowed because listings store the locality name.
r.patch('/localities/:id', async (req, res) => {
  const body = z.object({ active: z.boolean().optional(), coords: coordsSchema.optional() }).strict().parse(req.body);
  const loc = await Locality.findById(req.params.id);
  if (!loc) throw new HttpError(404, 'Locality not found.');
  if (body.active !== undefined) loc.active = body.active;
  let moved = 0;
  if (body.coords !== undefined) {
    loc.location = body.coords ? { type: 'Point', coordinates: [body.coords.lng, body.coords.lat] } : undefined;
    // Keep listings in this locality in step with the corrected centre point.
    const upd = body.coords
      ? await Listing.updateMany({ city: loc.city, locality: loc.name }, { $set: { location: loc.location } })
      : await Listing.updateMany({ city: loc.city, locality: loc.name }, { $unset: { location: 1 } });
    moved = upd.modifiedCount;
  }
  await loc.save();
  await audit(req, 'locality.update', 'locality', loc, `${loc.name}, ${loc.city}`, { ...body, listingsUpdated: moved });
  res.json({ ok: true });
});

// ---------- Audit log ----------
r.get('/audit', async (req, res) => {
  const page = pageOf(req.query);
  const filter = {};
  if (['listing', 'user', 'report', 'category', 'locality', 'pricing', 'settings'].includes(req.query.type)) filter.targetType = req.query.type;
  const [docs, total] = await Promise.all([
    AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE).limit(PAGE).populate('admin', 'name email'),
    AdminAuditLog.countDocuments(filter),
  ]);
  res.json({ items: docs.map((d) => ({ _id: d._id, at: d.createdAt, admin: d.admin?.name, action: d.action, targetType: d.targetType, targetId: d.targetId, targetLabel: d.targetLabel, details: d.details })), total, page, pages: Math.ceil(total / PAGE) });
});

export default r;
