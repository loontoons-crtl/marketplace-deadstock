import { HttpError } from '../middleware/errors.js';
import { Payment } from '../models/Payment.js';
import { StorageProduct } from '../models/StorageProduct.js';
import { Subscription } from '../models/Subscription.js';
import { getSettings } from '../models/Settings.js';
import { notify } from '../models/Notification.js';
import { computeEntitlement, DAY, refreshSellerAccess } from './entitlement.js';
import { formatBytes } from './format.js';

// ---------- Quotes: every price is worked out here, never taken from the browser ----------

// Buying or renewing a plan. Kept add-ons are renewed with it for the same period.
export async function quoteSubscription(user, { productId, keepAddonIds = [] }, now = new Date()) {
  const plan = await StorageProduct.findOne({ _id: productId, kind: 'plan', active: true });
  if (!plan) throw new HttpError(400, 'This plan is not available.');
  if (!plan.storageBytes) throw new HttpError(400, 'This plan has no storage set yet. Ask the admin to configure it.');
  const sub = await Subscription.findOne({ seller: user._id });
  const keep = [];
  let addonsPrice = 0;
  if (keepAddonIds.length) {
    if (sub?.kind !== 'paid') throw new HttpError(400, 'Only a paid plan has add-on storage to renew.');
    for (const id of new Set(keepAddonIds)) {
      const a = sub.addons.id(id);
      if (!a) throw new HttpError(400, 'Add-on not found on your subscription.');
      const current = a.product ? await StorageProduct.findById(a.product) : null;
      const annual = current?.active ? current.annualPrice : a.annualPrice; // today's price if still sold
      addonsPrice += Math.ceil((annual * plan.durationDays) / 365);
      keep.push(String(a._id));
    }
  }
  const settings = await getSettings();
  const ent = computeEntitlement(sub, settings, user.storageUsedBytes, now);
  const extends_ = sub?.kind === 'paid' && ent.state === 'active';
  const startsAt = extends_ ? ent.endsAt : now;
  return {
    purpose: 'subscription',
    item: {
      product: plan._id, name: plan.name, storageBytes: plan.storageBytes, annualPrice: plan.annualPrice,
      durationDays: plan.durationDays, keepAddonIds: keep, addonsPrice,
    },
    amount: plan.annualPrice + addonsPrice,
    summary: {
      plan: plan.name, storage: formatBytes(plan.storageBytes), planPrice: plan.annualPrice, addonsPrice,
      periodStart: startsAt, periodEnd: new Date(startsAt.getTime() + plan.durationDays * DAY),
      note: extends_ ? 'Your current plan continues; the new year starts when it ends.' : 'Starts as soon as payment is confirmed.',
    },
  };
}

// Extra storage until the current plan's expiry date, charged for the days left.
export async function quoteAddon(user, { productId }, now = new Date()) {
  const addon = await StorageProduct.findOne({ _id: productId, kind: 'addon', active: true });
  if (!addon) throw new HttpError(400, 'This storage add-on is not available.');
  const sub = await Subscription.findOne({ seller: user._id });
  const settings = await getSettings();
  const ent = computeEntitlement(sub, settings, user.storageUsedBytes, now);
  if (ent.state !== 'active') throw new HttpError(409, 'Extra storage can be added to an active paid plan. Subscribe to a plan first.', undefined, 'subscription_required');
  const days = Math.ceil((ent.endsAt - now) / DAY);
  const amount = Math.ceil((addon.annualPrice * Math.min(days, 365)) / 365);
  return {
    purpose: 'addon',
    item: { product: addon._id, name: addon.name, storageBytes: addon.storageBytes, annualPrice: addon.annualPrice, prorateDays: days, periodEnd: ent.endsAt },
    amount,
    summary: {
      addon: addon.name, storage: formatBytes(addon.storageBytes), annualPrice: addon.annualPrice, days,
      periodEnd: ent.endsAt, note: `Charged for the ${days} days left on your plan (₹${addon.annualPrice.toLocaleString('en-IN')} a year), and renews with your plan.`,
    },
  };
}

// ---------- Applying a paid purchase (exactly once) ----------

async function applyToSubscription(payment, now) {
  const { item } = payment;
  const settings = await getSettings();
  let sub = await Subscription.findOne({ seller: payment.seller });
  if (payment.purpose === 'subscription') {
    const ent = computeEntitlement(sub, settings, 0, now);
    const extending = sub?.kind === 'paid' && ent.state === 'active';
    const start = extending ? sub.startsAt : now;
    const base = extending ? ent.endsAt : now;
    const expiresAt = new Date(base.getTime() + item.durationDays * DAY);
    const plan = { product: item.product, name: item.name, storageBytes: item.storageBytes, annualPrice: item.annualPrice };
    if (!sub) {
      sub = new Subscription({ seller: payment.seller, kind: 'paid', plan, startsAt: start, expiresAt });
    } else {
      Object.assign(sub, { kind: 'paid', plan, startsAt: start, expiresAt, endedEarlyAt: null });
      for (const id of item.keepAddonIds || []) {
        const a = sub.addons.id(id);
        if (a) a.expiresAt = expiresAt; // renewed add-ons follow the plan
      }
    }
    await sub.save();
  } else {
    const ent = computeEntitlement(sub, settings, 0, now);
    if (!sub || ent.state !== 'active') throw new Error('Add-on paid but no active plan to attach it to');
    sub.addons.push({
      product: item.product, name: item.name, storageBytes: item.storageBytes, annualPrice: item.annualPrice,
      purchasedAt: now, expiresAt: ent.endsAt, payment: payment._id,
    });
    await sub.save();
  }
  await refreshSellerAccess(payment.seller);
}

// Marks a payment paid and applies it. Safe to call any number of times for the same payment
// (browser callback, webhook, retries): the subscription changes once.
export async function settlePayment(paymentId, { razorpayPaymentId } = {}, now = new Date()) {
  await Payment.updateOne(
    { _id: paymentId, status: { $in: ['created', 'failed'] } },
    { $set: { status: 'paid', paidAt: now, failureReason: '', ...(razorpayPaymentId ? { razorpayPaymentId } : {}) } }
  );
  const claimed = await Payment.findOneAndUpdate({ _id: paymentId, status: 'paid', appliedAt: null }, { $set: { appliedAt: now } }, { new: true });
  if (claimed) {
    try {
      await applyToSubscription(claimed, now);
    } catch (e) {
      await Payment.updateOne({ _id: paymentId }, { $set: { appliedAt: null, note: `Apply failed: ${e.message}` } });
      throw e;
    }
    const amount = (claimed.amountPaise / 100).toLocaleString('en-IN');
    await notify(claimed.seller, 'payment_received', `payment:${claimed._id}`, `Payment received: ₹${amount}`,
      claimed.purpose === 'addon' ? `${claimed.item.name} added to your storage.` : `${claimed.item.name} is active.`);
  }
  return Payment.findById(paymentId);
}

export async function markFailed(paymentId, reason) {
  await Payment.updateOne({ _id: paymentId, status: 'created' }, { $set: { status: 'failed', failureReason: String(reason || 'Payment failed').slice(0, 300) } });
}
