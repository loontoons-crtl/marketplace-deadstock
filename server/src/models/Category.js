import mongoose from 'mongoose';

// Category-specific specification fields drive both the listing form and the product page,
// so new categories need no code change.
const specFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, match: /^[a-zA-Z][a-zA-Z0-9]*$/ },
    label: { type: String, required: true },
    placeholder: { type: String, default: '' },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    name: { type: String, required: true, trim: true },
    subcategories: { type: [String], default: [] },
    specFields: { type: [specFieldSchema], default: [] },
    // Placeholder artwork until real photos exist (Phase 3).
    pattern: { type: String, enum: ['wood', 'louver', 'tile', 'stone', 'plain'], default: 'plain' },
    colors: { type: [String], default: ['#BDB6A6', '#9D9684'] },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ slug: 1 }, { unique: true });

export const Category = mongoose.model('Category', categorySchema);
