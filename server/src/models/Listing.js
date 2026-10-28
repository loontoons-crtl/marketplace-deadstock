import mongoose from 'mongoose';
import { CONDITIONS, LISTING_STATUSES, UNITS } from '../lib/constants.js';

const listingSchema = new mongoose.Schema(
  {
    listingNo: { type: String, required: true }, // DS-1001
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subcategory: { type: String, trim: true, maxlength: 80, default: '' },
    brand: { type: String, trim: true, maxlength: 80, default: '' },
    model: { type: String, trim: true, maxlength: 80, default: '' },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    condition: { type: String, enum: CONDITIONS, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UNITS, required: true },
    totalPrice: { type: Number, required: true, min: 1 }, // whole rupees
    // Optional: seller-stated MRP / list price for the same quantity, in whole rupees. Shown struck through.
    mrp: { type: Number, min: 1, default: null },
    minOrderQty: { type: Number, min: 1, default: null },
    specs: { type: Map, of: String, default: {} },
    city: { type: String, required: true, default: 'Bengaluru' },
    locality: { type: String, required: true },
    pickupDetails: { type: String, trim: true, maxlength: 500, default: '' },
    // First image is the cover. Files live in Cloudinary (or server/uploads in development).
    // bytes = size actually stored (full + thumbnail); counts toward the seller's storage allowance.
    // uploadKey lets a retried upload be recognised so it is not stored or counted twice.
    images: {
      type: [{ key: String, url: String, thumbUrl: String, width: Number, height: Number, bytes: { type: Number, default: 0 }, uploadKey: String, phash: String, phashParts: { type: [String], default: undefined } }],
      default: [],
    },
    // Copied from the locality's approximate centre; never the seller's exact address.
    location: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number], default: undefined } },

    status: { type: String, enum: LISTING_STATUSES, default: 'draft' },
    submittedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    removedReason: { type: String, default: '' },
    approvedAt: { type: Date, default: null }, // approved by an admin
    autoPublishedAt: { type: Date, default: null }, // went live without review (seller past the review threshold)
    // Set while the seller's account is suspended so their listings drop out of search.
    sellerSuspended: { type: Boolean, default: false },
    // Set when a seller edits a listing that is already live, so admins can re-check it.
    editedAfterApprovalAt: { type: Date, default: null },
    // Results of the automatic checks run on submit and on edits to live listings (see lib/moderation.js).
    moderationFlags: { type: [{ code: String, message: String, sellerVisible: Boolean, _id: false }], default: [] },
    checkedAt: { type: Date, default: null },
    // Copied from the seller's subscription: end of its grace period. Public search shows a listing only
    // while this is in the future, so lapsed subscriptions hide listings without deleting anything.
    sellerAccessUntil: { type: Date, default: null },
    activatedAt: { type: Date, default: null }, // first went live

    // Legacy fields from the per-listing 90-day model (kept so old records still read correctly).
    activation: { type: { type: String, enum: ['payment', 'complimentary'] }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, note: String },
    expiresAt: { type: Date, default: null },

    views: { type: Number, default: 0 },
    contactClicks: { call: { type: Number, default: 0 }, whatsapp: { type: Number, default: 0 } },

    isSample: { type: Boolean, default: false }, // demonstration data from the seed script
  },
  { timestamps: true }
);

listingSchema.index({ listingNo: 1 }, { unique: true });
listingSchema.index({ seller: 1, createdAt: -1 });
listingSchema.index({ status: 1, sellerAccessUntil: 1, activatedAt: -1 });
listingSchema.index({ status: 1, category: 1, createdAt: -1 });
listingSchema.index({ status: 1, city: 1, locality: 1 });
listingSchema.index({ status: 1, totalPrice: 1 });
listingSchema.index({ location: '2dsphere' }, { sparse: true });
listingSchema.index({ status: 1, submittedAt: 1 });
listingSchema.index({ 'images.phashParts': 1 });
listingSchema.index(
  { title: 'text', brand: 'text', subcategory: 'text', model: 'text', description: 'text' },
  { weights: { title: 10, brand: 6, model: 4, subcategory: 3, description: 1 }, name: 'listing_text' }
);

export const Listing = mongoose.model('Listing', listingSchema);
