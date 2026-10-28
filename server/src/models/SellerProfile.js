import mongoose from 'mongoose';
import { SELLER_TYPES } from '../lib/constants.js';

const sellerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    sellerType: { type: String, enum: SELLER_TYPES, required: true },
    businessName: { type: String, trim: true, maxlength: 120, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    about: { type: String, trim: true, maxlength: 1000, default: '' },
    city: { type: String, required: true, default: 'Bengaluru' },
    locality: { type: String, trim: true, default: '' },
    // Seller's explicit consent to show their verified phone on live listings.
    showContact: { type: Boolean, default: false },
    showContactConsentAt: { type: Date, default: null },
    // Set by administrators only (Phase 3). Identity and business verification are separate.
    identityVerifiedAt: { type: Date, default: null },
    businessVerifiedAt: { type: Date, default: null },
    // How the admin checked, e.g. "Video call, matched Aadhaar name" or "GSTIN active on GST portal".
    // We record the method only; ID documents are not uploaded or stored.
    identityVerification: { by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, method: String },
    businessVerification: { by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, method: String },
  },
  { timestamps: true }
);

sellerProfileSchema.index({ user: 1 }, { unique: true });

export const SellerProfile = mongoose.model('SellerProfile', sellerProfileSchema);
