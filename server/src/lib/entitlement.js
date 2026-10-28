import { Listing } from '../models/Listing.js';
import { getSettings } from '../models/Settings.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';

export const DAY = 864e5;

// Works out what a seller may do right now from their subscription. Pure: no database access.
//   none     – never subscribed (trial starts when the phone is verified)
//   trial    – free trial running
//   active   – paid plan running
//   grace    – ended; listings still visible, no new photos or listings
//   expired  – grace over; listings hidden from buyers, data kept (never auto-deleted)
export function computeEntitlement(sub, settings, usedBytes = 0, now = new Date()) {
  if (!sub) {
    return { state: 'none', allowanceBytes: 0, usedBytes, remainingBytes: 0, canUpload: false, canSubmit: false, listingsVisibleUntil: null };
  }
  const endsAt = sub.endedEarlyAt && sub.endedEarlyAt < sub.expiresAt ? sub.endedEarlyAt : sub.expiresAt;
  const graceEndsAt = new Date(endsAt.getTime() + settings.graceDays * DAY);
  const running = now < endsAt;
  const state = running ? (sub.kind === 'trial' ? 'trial' : 'active') : now < graceEndsAt ? 'grace' : 'expired';
  // Add-ons count while unexpired; after the plan ends, show the allowance as it was on the last day.
  const at = running ? now : new Date(endsAt.getTime() - 1);
  const addonBytes = (sub.addons || []).filter((a) => a.expiresAt > at).reduce((s, a) => s + (a.storageBytes || 0), 0);
  const allowanceBytes = (sub.plan?.storageBytes || 0) + addonBytes;
  const remainingBytes = Math.max(0, allowanceBytes - usedBytes);
  return {
    state,
    kind: sub.kind,
    planName: sub.plan?.name || '',
    startsAt: sub.startsAt,
    endsAt,
    graceEndsAt,
    retentionUntil: new Date(endsAt.getTime() + settings.retentionDays * DAY),
    daysLeft: running ? Math.ceil((endsAt - now) / DAY) : 0,
    allowanceBytes,
    usedBytes,
    remainingBytes,
    canUpload: running && remainingBytes > 0,
    canSubmit: running,
    listingsVisibleUntil: graceEndsAt,
  };
}

export async function getEntitlement(userOrId, now = new Date()) {
  const user = userOrId?._id ? userOrId : await User.findById(userOrId);
  const [sub, settings] = await Promise.all([Subscription.findOne({ seller: user._id }), getSettings()]);
  return { ent: computeEntitlement(sub, settings, user.storageUsedBytes || 0, now), sub, settings };
}

// Copies the seller's visibility window onto all their listings. Called after anything that changes
// the subscription (trial start, payment, admin grant, admin end). Hiding happens automatically when
// the date passes, so no job is needed to hide listings and nothing is deleted.
export async function refreshSellerAccess(userId) {
  const sub = await Subscription.findOne({ seller: userId });
  const settings = await getSettings();
  const ent = computeEntitlement(sub, settings);
  await Listing.updateMany({ seller: userId, isSample: { $ne: true } }, { $set: { sellerAccessUntil: ent.listingsVisibleUntil } });
  return ent;
}

// One free trial per seller account. The account's phone is unique and OTP-verified before this runs.
export async function startTrialIfEligible(user, now = new Date()) {
  const settings = await getSettings();
  if (!settings.trialDays || !user.phoneVerifiedAt) return null;
  const res = await Subscription.updateOne(
    { seller: user._id },
    { $setOnInsert: {
      seller: user._id, kind: 'trial', trialUsed: true,
      plan: { product: null, name: 'Free trial', storageBytes: settings.trialStorageBytes, annualPrice: 0 },
      startsAt: now, expiresAt: new Date(now.getTime() + settings.trialDays * DAY),
    } },
    { upsert: true }
  );
  if (res.upsertedCount) await refreshSellerAccess(user._id);
  return res.upsertedCount > 0;
}
