import mongoose from 'mongoose';

// One pending OTP per user. Only a hash of the code is stored.
const phoneOtpSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phone: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

phoneOtpSchema.index({ user: 1 }, { unique: true });
phoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB removes expired codes

export const PhoneOtp = mongoose.model('PhoneOtp', phoneOtpSchema);
