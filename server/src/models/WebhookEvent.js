import mongoose from 'mongoose';

// Razorpay can deliver the same webhook more than once. Each event id is processed once.
const webhookEventSchema = new mongoose.Schema(
  { eventId: { type: String, required: true }, event: String, receivedAt: { type: Date, default: Date.now } },
);
webhookEventSchema.index({ eventId: 1 }, { unique: true });
webhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
