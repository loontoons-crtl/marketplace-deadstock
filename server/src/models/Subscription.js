import mongoose from 'mongoose';

// One current subscription per seller. History lives in Payment records and the admin audit log.
const addonSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageProduct' },
    name: String,
    storageBytes: Number,
    annualPrice: Number, // price at purchase, ₹
    purchasedAt: Date,
    expiresAt: Date, // always aligned to the subscription's expiry
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  },
  { _id: true }
);

const subscriptionSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['trial', 'paid'], required: true },
    plan: {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageProduct', default: null },
      name: String,
      storageBytes: Number,
      annualPrice: Number,
    },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    addons: { type: [addonSchema], default: [] },
    trialUsed: { type: Boolean, default: false },
    endedEarlyAt: { type: Date, default: null }, // admin ended it (e.g. refund)
    remindersSent: { type: [String], default: [] }, // e.g. "2027-10-17:30" so each reminder goes once per period
  },
  { timestamps: true }
);

subscriptionSchema.index({ seller: 1 }, { unique: true });
subscriptionSchema.index({ expiresAt: 1 });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
