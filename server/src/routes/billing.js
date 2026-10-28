import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config, paymentsEnabled } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { Listing } from '../models/Listing.js';
import { Notification } from '../models/Notification.js';
import { Payment } from '../models/Payment.js';
import { StorageProduct } from '../models/StorageProduct.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { LIVE_STATUSES } from '../lib/constants.js';
import { getEntitlement } from '../lib/entitlement.js';
import { markFailed, quoteAddon, quoteSubscription, settlePayment } from '../lib/billing.js';
import { razorpay } from '../lib/razorpay.js';

const r = Router();

const productOut = (p) => ({ _id: p._id, kind: p.kind, name: p.name, description: p.description, storageBytes: p.storageBytes, annualPrice: p.annualPrice, durationDays: p.durationDays });
const paymentOut = (p) => ({
  _id: p._id, purpose: p.purpose, method: p.method, status: p.status, amount: p.amountPaise / 100, name: p.item?.name,
  storageBytes: p.item?.storageBytes, createdAt: p.createdAt, paidAt: p.paidAt, failureReason: p.failureReason,
  razorpayPaymentId: p.razorpayPaymentId, reference: p.manualReference,
});

async function summary(user) {
  const { ent, sub, settings } = await getEntitlement(user);
  const [plans, addons, payments, live, total, photoAgg, notes, byListing] = await Promise.all([
    StorageProduct.find({ kind: 'plan', active: true }).sort({ order: 1, annualPrice: 1 }),
    StorageProduct.find({ kind: 'addon', active: true }).sort({ order: 1, annualPrice: 1 }),
    Payment.find({ seller: user._id, status: { $ne: 'created' } }).sort({ createdAt: -1 }).limit(50),
    Listing.countDocuments({ seller: user._id, status: { $in: LIVE_STATUSES } }),
    Listing.countDocuments({ seller: user._id }),
    Listing.aggregate([{ $match: { seller: user._id, status: { $ne: 'removed' } } }, { $project: { n: { $size: '$images' } } }, { $group: { _id: null, n: { $sum: '$n' } } }]),
    Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(10),
    Listing.aggregate([
      { $match: { seller: user._id, status: { $ne: 'removed' } } },
      { $project: { listingNo: 1, title: 1, status: 1, photos: { $size: '$images' }, bytes: { $sum: '$images.bytes' } } },
      { $sort: { bytes: -1 } }, { $limit: 20 },
    ]),
  ]);
  const photos = photoAgg[0]?.n || 0;
  return {
    entitlement: ent,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    addonsOwned: (sub?.addons || []).map((a) => ({ _id: a._id, name: a.name, storageBytes: a.storageBytes, annualPrice: a.annualPrice, purchasedAt: a.purchasedAt, expiresAt: a.expiresAt })),
    // avgPhotoBytes: the seller's own average photo size, once there are enough photos to be meaningful.
    counts: { liveListings: live, totalListings: total, photos, avgPhotoBytes: photos >= 10 ? Math.round(ent.usedBytes / photos) : null },
    plans: plans.map(productOut),
    addons: addons.map(productOut),
    payments: payments.map(paymentOut),
    notifications: notes.map((n) => ({ _id: n._id, kind: n.kind, title: n.title, body: n.body, createdAt: n.createdAt, read: Boolean(n.readAt) })),
    storageByListing: byListing,
    terms: { trialDays: settings.trialDays, graceDays: settings.graceDays, retentionDays: settings.retentionDays, reminderDays: settings.reminderDays, gstNote: settings.gstNote, refundTerms: settings.refundTerms },
    paymentsEnabled: paymentsEnabled(),
    razorpayKeyId: paymentsEnabled() ? config.razorpayKeyId : null, // public key, safe to send
  };
}

// ---------- Razorpay webhook (raw body, mounted before the JSON parser in app.js) ----------
export async function razorpayWebhook(req, res) {
  const raw = req.body; // Buffer
  if (!razorpay.verifyWebhookSignature(raw, req.get('x-razorpay-signature'))) return res.status(400).json({ error: 'Invalid signature' });
  let evt;
  try { evt = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const eventId = req.get('x-razorpay-event-id') || `${evt.event}:${evt.payload?.payment?.entity?.id || evt.payload?.order?.entity?.id || ''}`;
  try {
    await WebhookEvent.create({ eventId, event: evt.event });
  } catch (e) {
    if (e?.code === 11000) return res.json({ ok: true, duplicate: true }); // already handled
    throw e;
  }
  const pay = evt.payload?.payment?.entity;
  const orderId = pay?.order_id || evt.payload?.order?.entity?.id;
  const payment = orderId ? await Payment.findOne({ razorpayOrderId: orderId }) : null;
  if (payment) {
    if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
      const amount = pay?.amount ?? evt.payload?.order?.entity?.amount_paid;
      if (amount !== payment.amountPaise) {
        console.error('[webhook] amount mismatch', orderId, amount, payment.amountPaise);
      } else {
        await settlePayment(payment._id, { razorpayPaymentId: pay?.id });
      }
    } else if (evt.event === 'payment.failed') {
      await markFailed(payment._id, pay?.error_description);
    }
  }
  res.json({ ok: true }); // 200 for any valid, signed event so Razorpay stops retrying
}

// ---------- Seller endpoints ----------
r.use(requireAuth);

r.get('/', async (req, res) => res.json(await summary(req.user)));

const quoteSchema = z.discriminatedUnion('purpose', [
  z.object({ purpose: z.literal('subscription'), productId: z.string().min(1), keepAddonIds: z.array(z.string()).max(20).optional().default([]) }),
  z.object({ purpose: z.literal('addon'), productId: z.string().min(1) }),
]);
const quote = (user, body) => (body.purpose === 'subscription' ? quoteSubscription(user, body) : quoteAddon(user, body));

r.post('/quote', async (req, res) => {
  const q = await quote(req.user, quoteSchema.parse(req.body));
  res.json({ amount: q.amount, summary: q.summary });
});

const checkoutLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, skip: () => config.isTest, standardHeaders: 'draft-8', legacyHeaders: false });

// Creates a Razorpay order for an amount decided here. Nothing is activated until payment is verified.
r.post('/checkout', checkoutLimiter, async (req, res) => {
  if (!paymentsEnabled()) throw new HttpError(503, 'Online payment is not set up yet. Contact us to pay by bank transfer or UPI.', undefined, 'payments_disabled');
  if (!req.user.phoneVerifiedAt) throw new HttpError(403, 'Verify your phone number first.');
  const q = await quote(req.user, quoteSchema.parse(req.body));
  if (q.amount < 1) throw new HttpError(400, 'Nothing to pay for this item.');
  const payment = await Payment.create({ seller: req.user._id, purpose: q.purpose, method: 'razorpay', item: q.item, amountPaise: q.amount * 100 });
  try {
    const order = await razorpay.createOrder({ amountPaise: payment.amountPaise, receipt: String(payment._id), notes: { seller: String(req.user._id), purpose: q.purpose } });
    payment.razorpayOrderId = order.id;
    await payment.save();
    res.status(201).json({
      paymentId: payment._id, orderId: order.id, amountPaise: payment.amountPaise, currency: 'INR', keyId: config.razorpayKeyId,
      name: 'Deadstock Bengaluru', description: q.item.name, prefill: { email: req.user.email, contact: req.user.phone, name: req.user.name },
    });
  } catch (e) {
    await markFailed(payment._id, 'Could not create payment order');
    console.error('[checkout]', e.message);
    throw new HttpError(502, 'Could not start the payment. Please try again in a minute.');
  }
});

const verifySchema = z.object({ razorpay_order_id: z.string().min(1).max(64), razorpay_payment_id: z.string().min(1).max(64), razorpay_signature: z.string().min(1).max(256) });

// Called by the browser after Razorpay checkout. The signature, not the browser's word, decides.
r.post('/verify', async (req, res) => {
  const b = verifySchema.parse(req.body);
  const payment = await Payment.findOne({ razorpayOrderId: b.razorpay_order_id, seller: req.user._id });
  if (!payment) throw new HttpError(404, 'Payment not found.');
  if (!razorpay.verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    throw new HttpError(400, 'We could not verify this payment. If money was deducted, it will be confirmed automatically or refunded by Razorpay.');
  }
  const settled = await settlePayment(payment._id, { razorpayPaymentId: b.razorpay_payment_id });
  res.json({ payment: paymentOut(settled), billing: await summary(req.user) });
});

// The checkout reported a failure or was closed. Informational only; a later successful payment still counts.
r.post('/payments/:id/failed', async (req, res) => {
  const { reason } = z.object({ reason: z.string().max(300).optional().default('') }).parse(req.body);
  const payment = await Payment.findOne({ _id: req.params.id, seller: req.user._id });
  if (!payment) throw new HttpError(404, 'Payment not found.');
  await markFailed(payment._id, reason || 'Checkout closed or failed');
  res.json({ ok: true });
});

r.post('/notifications/read', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});

export default r;
