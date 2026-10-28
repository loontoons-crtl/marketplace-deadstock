import mongoose from 'mongoose';

// Messages to sellers (shown in the dashboard; emailed once an email provider is configured).
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, required: true }, // renewal_reminder, subscription_ended, listings_hidden, payment_received, storage_nearly_full
    title: { type: String, required: true },
    body: { type: String, default: '' },
    key: { type: String, required: true }, // dedupe: one notification per key
    readAt: { type: Date, default: null },
    emailedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
notificationSchema.index({ user: 1, key: 1 }, { unique: true });
notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);

export async function notify(userId, kind, key, title, body = '') {
  try {
    await Notification.create({ user: userId, kind, key, title, body });
    return true;
  } catch (e) {
    if (e?.code === 11000) return false; // already sent
    throw e;
  }
}
