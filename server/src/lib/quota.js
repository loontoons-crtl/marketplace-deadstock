import { Listing } from '../models/Listing.js';
import { User } from '../models/User.js';

// Storage accounting. Usage only changes through these atomic updates, so two uploads at the same
// time cannot both squeeze past the limit, and the browser never supplies sizes or allowances.

// Reserves `bytes` if they fit within `allowanceBytes`. Returns false when the seller is out of space.
export async function reserveStorage(userId, bytes, allowanceBytes) {
  const res = await User.updateOne(
    { _id: userId, storageUsedBytes: { $lte: allowanceBytes - bytes } },
    { $inc: { storageUsedBytes: bytes } }
  );
  return res.modifiedCount === 1;
}

export async function releaseStorage(userId, bytes) {
  if (!bytes) return;
  await User.updateOne({ _id: userId }, { $inc: { storageUsedBytes: -bytes } });
  await User.updateOne({ _id: userId, storageUsedBytes: { $lt: 0 } }, { $set: { storageUsedBytes: 0 } });
}

// Recomputes usage from the photos actually on the seller's listings. Photos on listings removed by
// moderation are kept as a record but don't count against the seller.
export async function recalcStorage(userId) {
  const [row] = await Listing.aggregate([
    { $match: { seller: userId, status: { $ne: 'removed' } } },
    { $unwind: '$images' },
    { $group: { _id: null, bytes: { $sum: { $ifNull: ['$images.bytes', 0] } }, photos: { $sum: 1 } } },
  ]);
  const bytes = row?.bytes || 0;
  await User.updateOne({ _id: userId }, { $set: { storageUsedBytes: bytes } });
  return { bytes, photos: row?.photos || 0 };
}
