import mongoose from 'mongoose';

// Append-only record of administrative actions. Never updated or deleted by the app.
const adminAuditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // e.g. listing.approve, seller.suspend
    targetType: { type: String, enum: ['listing', 'user', 'report', 'category', 'locality', 'pricing', 'settings'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetLabel: { type: String, default: '' }, // human-readable, e.g. DS-1012 or seller email
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);

export function audit(req, action, targetType, target, targetLabel, details = {}) {
  return AdminAuditLog.create({ admin: req.user._id, action, targetType, targetId: target._id || target, targetLabel, details });
}
