import mongoose from 'mongoose';
import { REPORT_REASONS } from '../lib/constants.js';

const reportSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 1000, default: '' },
    reporterContact: { type: String, trim: true, maxlength: 120, default: '' }, // optional, for follow-up
    reporterUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    visitorHash: { type: String, required: true },
    status: { type: String, enum: ['open', 'dismissed', 'actioned'], default: 'open' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '' },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ listing: 1, visitorHash: 1 });

export const Report = mongoose.model('Report', reportSchema);
