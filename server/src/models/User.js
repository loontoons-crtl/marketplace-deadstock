import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: false }, // +91XXXXXXXXXX
    passwordHash: { type: String, required: false, select: false },
    googleId: { type: String, default: undefined },
    role: { type: String, enum: ['seller', 'admin'], default: 'seller' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    suspendedReason: { type: String, default: '' },
    phoneVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    // Bytes of listing media stored for this seller. Changed only by atomic $inc on upload/delete.
    storageUsedBytes: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

userSchema.virtual('phoneVerified').get(function () { return Boolean(this.phoneVerifiedAt); });

export const User = mongoose.model('User', userSchema);
