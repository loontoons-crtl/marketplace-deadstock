import mongoose from 'mongoose';

// Admin-configurable things a seller can buy: a base annual PLAN, or an ADDON (extra storage).
// Prices are whole rupees here and converted to paise only when talking to Razorpay.
// Purchases keep a snapshot of name/storage/price, so editing a product never changes past purchases.
const storageProductSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['plan', 'addon'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    storageBytes: { type: Number, required: true, min: 0 },
    annualPrice: { type: Number, required: true, min: 0 }, // ₹, excluding GST
    currency: { type: String, enum: ['INR'], default: 'INR' },
    durationDays: { type: Number, default: 365, min: 1, max: 3660 }, // plans only
    active: { type: Boolean, default: false }, // only active products can be bought
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
storageProductSchema.index({ kind: 1, active: 1, order: 1 });

export const StorageProduct = mongoose.model('StorageProduct', storageProductSchema);
