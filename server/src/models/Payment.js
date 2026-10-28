import mongoose from 'mongoose';

// Every purchase attempt. Amounts are decided on the server and stored in paise.
// status: created (order made, not paid) → paid (verified) | failed. refunded is recorded by an admin.
const paymentSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ['subscription', 'addon'], required: true },
    method: { type: String, enum: ['razorpay', 'manual'], required: true },
    // What is being bought, frozen at order time.
    item: {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageProduct' },
      name: String,
      storageBytes: Number,
      annualPrice: Number,
      durationDays: Number,
      keepAddonIds: { type: [String], default: undefined }, // renewal: add-ons renewed with the plan
      addonsPrice: Number, // renewal: ₹ for the kept add-ons
      prorateDays: Number, // add-on: days charged
      periodEnd: Date, // add-on: subscription expiry it is aligned to
    },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
    razorpayOrderId: { type: String, default: undefined },
    razorpayPaymentId: { type: String, default: undefined },
    failureReason: { type: String, default: '' },
    appliedAt: { type: Date, default: null }, // when the purchase was added to the subscription (exactly once)
    paidAt: { type: Date, default: null },
    manualReference: { type: String, default: '' }, // e.g. UPI / bank transfer ref for offline payments
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

paymentSchema.index({ razorpayOrderId: 1 }, { unique: true, partialFilterExpression: { razorpayOrderId: { $type: 'string' } } });
paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } });
paymentSchema.index({ seller: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
