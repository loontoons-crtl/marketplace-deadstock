import mongoose from 'mongoose';

const MB = 1024 * 1024;

// One document holding platform rules the admin can change without a code release.
export const SETTINGS_DEFAULTS = {
  trialDays: 30,
  trialStorageBytes: 100 * MB, // change in Admin → Plans & settings
  graceDays: 15, // listings stay visible this long after a subscription ends
  retentionDays: 180, // how long data is kept after a subscription ends (never auto-deleted)
  // 'auto': listings that pass the automatic checks go live at once; flagged ones wait for an admin.
  // 'manual': every listing waits for an admin.
  moderationMode: 'auto',
  reviewFirstListings: 0, // optionally also review each seller's first N listings by hand
  blockedWords: [], // words or phrases that send a listing to admin review, e.g. a banned product
  reminderDays: [30, 7, 1], // renewal reminders before expiry
  gstNote: '', // e.g. "Prices include 18% GST" once confirmed with your CA
  refundTerms: '',
};

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'platform' },
    trialDays: { type: Number, min: 0, max: 365 },
    trialStorageBytes: { type: Number, min: 0 },
    graceDays: { type: Number, min: 0, max: 90 },
    retentionDays: { type: Number, min: 30, max: 3650 },
    reviewFirstListings: { type: Number, min: 0, max: 1000 },
    moderationMode: { type: String, enum: ['auto', 'manual'] },
    blockedWords: { type: [String], default: undefined },
    reminderDays: { type: [Number], default: undefined },
    gstNote: { type: String, maxlength: 200 },
    refundTerms: { type: String, maxlength: 1000 },
    schemaVersion: { type: Number, default: 0 }, // data migrations already applied
  },
  { timestamps: true }
);

export const Settings = mongoose.model('Settings', settingsSchema);

let cache = null;
let cachedAt = 0;
export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < 30_000) return cache;
  const doc = await Settings.findById('platform').lean();
  cache = { ...SETTINGS_DEFAULTS, ...Object.fromEntries(Object.entries(doc || {}).filter(([, v]) => v !== undefined && v !== null)) };
  cachedAt = Date.now();
  return cache;
}
export const clearSettingsCache = () => { cache = null; };
