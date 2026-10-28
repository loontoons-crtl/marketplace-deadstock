import mongoose from 'mongoose';

// One row per counted Call / WhatsApp click. visitorHash is a salted hash of IP + user agent,
// used only to avoid counting repeat taps; the raw IP is not stored.
const contactEventSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: ['call', 'whatsapp'], required: true },
    visitorHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

contactEventSchema.index({ listing: 1, visitorHash: 1, channel: 1, createdAt: -1 });
contactEventSchema.index({ seller: 1, createdAt: -1 });

export const ContactEvent = mongoose.model('ContactEvent', contactEventSchema);
