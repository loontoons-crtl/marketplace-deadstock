import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { Listing } from '../models/Listing.js';
import { Settings } from '../models/Settings.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { refreshSellerAccess, startTrialIfEligible } from './entitlement.js';
import { recalcStorage } from './quota.js';
import { LOCAL_DIR } from './storage.js';

const FAR_FUTURE = new Date('2099-12-31T00:00:00Z');

// Moves data from the old per-listing, 90-day model to annual storage subscriptions.
// Runs at startup; each step is safe to repeat. Nothing is deleted.
export async function runMigrations() {
  const s = await Settings.findById('platform').lean();
  if ((s?.schemaVersion || 0) >= 4) return { skipped: true };
  const log = {};
  const now = new Date();

  // 1. Listings waiting for the old ₹1,500 payment were already approved: make them live.
  log.pendingPaymentToActive = (await Listing.updateMany(
    { status: 'pending_payment' },
    [{ $set: { status: 'active', approvedAt: { $ifNull: ['$reviewedAt', now] }, activatedAt: { $ifNull: ['$activatedAt', now] } } }]
  )).modifiedCount;
  // 2. Listings that hit the old 90-day expiry become "unavailable"; the seller can make them live again.
  log.expiredToUnavailable = (await Listing.updateMany({ status: 'expired' }, { $set: { status: 'unavailable' } })).modifiedCount;
  // 3. Listings an admin approved under the old model count toward the review threshold.
  await Listing.updateMany({ approvedAt: null, reviewedAt: { $ne: null }, status: { $in: ['active', 'reserved', 'unavailable', 'sold'] } }, [{ $set: { approvedAt: '$reviewedAt' } }]);
  // 4. Sample listings stay visible.
  await Listing.updateMany({ isSample: true }, { $set: { sellerAccessUntil: FAR_FUTURE } });

  // 5. Record the stored size of photos uploaded before storage was metered (local storage only).
  let sized = 0;
  if (config.storageDriver === 'local') {
    const docs = await Listing.find({ images: { $elemMatch: { bytes: { $exists: false } } } });
    for (const l of docs) {
      for (const img of l.images) {
        if (img.bytes != null && img.bytes !== 0) continue;
        let bytes = 0;
        for (const f of [`${img.key}.webp`, `${img.key}-t.webp`]) {
          try { bytes += (await fs.stat(path.join(LOCAL_DIR, f))).size; } catch { /* missing file counts 0 */ }
        }
        img.bytes = bytes;
        sized += 1;
      }
      await l.save();
    }
  }
  log.photosSized = sized;

  // 6. Existing sellers with a verified phone get the free trial; everyone's usage and visibility is recomputed.
  const sellers = await User.find({ email: { $not: /@sample\.invalid$/ } });
  let trials = 0;
  for (const u of sellers) {
    if (!(await Subscription.exists({ seller: u._id })) && (await startTrialIfEligible(u, now))) trials += 1;
    await recalcStorage(u._id);
    await refreshSellerAccess(u._id);
  }
  log.trialsStarted = trials;

  await Settings.updateOne({ _id: 'platform' }, { $set: { schemaVersion: 4 } }, { upsert: true });
  console.log('[migrate] moved to annual storage subscriptions:', JSON.stringify(log));
  return log;
}
