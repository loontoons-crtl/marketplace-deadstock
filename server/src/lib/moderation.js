import { Listing } from '../models/Listing.js';
import { Report } from '../models/Report.js';
import { hammingHex } from './images.js';

// Automatic checks run when a seller submits a listing, and again when a live listing is edited.
// A listing with no flags goes live straight away; any flag sends it to the admin review queue.
// sellerVisible: whether the seller is told the specific reason (they can fix it themselves).
// Fraud signals (reused photos, account history) are not described to the seller.

const PHONE = /(?:\+?\s?91[\s-]?)?\b[6-9](?:[\s-]?\d){9}\b/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b\S+\.(?:com|in|net|org|co|io|me|shop|store)(?:\/\S*)?\b|\bwa\.me\b/i;
const SIMILAR_BITS = 6; // ≤ 6 of 64 bits different = the same photo, resized or recompressed
const MIN_TOTAL_PRICE = 100;
const MAX_TOTAL_PRICE = 50_000_000; // ₹5 crore
const MRP_REVIEW_RATIO = 5; // more than 80% off goes to a person
const DAY = 864e5;

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function textChecks(listing, blockedWords) {
  const flags = [];
  const text = [listing.title, listing.description, listing.pickupDetails, listing.brand, listing.model].filter(Boolean).join('\n');
  if (PHONE.test(text) || EMAIL.test(text) || LINK.test(text)) {
    flags.push({ code: 'contact_in_text', sellerVisible: true, message: 'Remove phone numbers, emails and links from the title and description. Buyers contact you through the Call and WhatsApp buttons.' });
  }
  const hits = (blockedWords || []).filter((w) => w && new RegExp(`(^|\\W)${escapeRx(w.trim())}(\\W|$)`, 'i').test(text));
  if (hits.length) flags.push({ code: 'blocked_words', sellerVisible: true, message: `Contains words our team checks by hand: ${hits.join(', ')}.` });
  if (listing.totalPrice < MIN_TOTAL_PRICE) flags.push({ code: 'price_check', sellerVisible: true, message: `Total price below ₹${MIN_TOTAL_PRICE}. Check the price is the total for the whole lot.` });
  if (listing.totalPrice > MAX_TOTAL_PRICE) flags.push({ code: 'price_check', sellerVisible: true, message: 'Total price above ₹5 crore. Our team will confirm it.' });
  // A claimed discount above 80% is possible for deadstock but is also the classic fake-MRP pattern.
  if (listing.mrp && listing.mrp > listing.totalPrice * MRP_REVIEW_RATIO) flags.push({ code: 'mrp_check', sellerVisible: true, message: 'The MRP is more than 5 times your asking price. Our team will confirm it before the discount is shown.' });
  return flags;
}

// The earliest upload of a photo is treated as its owner (photo ids carry their upload time).
// A listing is flagged when one of its photos was first uploaded by a different seller. So the seller
// who took the photo can reuse it freely, while a copy by someone else (including a new account of a
// seller whose listing was removed) is caught.
async function duplicatePhotoCheck(listing) {
  const mine = (listing.images || []).filter((i) => i.phash);
  if (!mine.length) return [];
  const parts = [...new Set(mine.flatMap((i) => i.phashParts || []))];
  const docs = await Listing.find(
    { 'images.phashParts': { $in: parts } },
    { listingNo: 1, seller: 1, 'images._id': 1, 'images.phash': 1 }
  ).limit(300).lean();
  const seller = String(listing.seller);
  const matches = new Set();
  for (const img of mine) {
    let first = null;
    for (const d of docs) {
      for (const o of d.images || []) {
        if (!o.phash || String(o._id) === String(img._id) || hammingHex(img.phash, o.phash) > SIMILAR_BITS) continue;
        const t = o._id.getTimestamp().getTime();
        if (!first || t < first.t) first = { t, seller: String(d.seller), listingNo: d.listingNo };
      }
    }
    if (first && first.seller !== seller && first.t <= img._id.getTimestamp().getTime()) matches.add(first.listingNo);
  }
  return matches.size
    ? [{ code: 'duplicate_photo', sellerVisible: false, message: `Photo was first uploaded by another seller, on ${[...matches].slice(0, 5).join(', ')}.` }]
    : [];
}

async function sellerHistoryCheck(listing, now) {
  const mine = await Listing.find({ seller: listing.seller, _id: { $ne: listing._id } }, { _id: 1 }).lean();
  const [openReports, recentRemovals] = await Promise.all([
    Report.countDocuments({ listing: { $in: mine.map((m) => m._id) }, status: 'open' }),
    Listing.countDocuments({ seller: listing.seller, status: 'removed', updatedAt: { $gt: new Date(now - 180 * DAY) } }),
  ]);
  const flags = [];
  if (openReports) flags.push({ code: 'seller_reports', sellerVisible: false, message: `Seller has ${openReports} open report${openReports > 1 ? 's' : ''} on other listings.` });
  if (recentRemovals) flags.push({ code: 'seller_removals', sellerVisible: false, message: `Seller had ${recentRemovals} listing${recentRemovals > 1 ? 's' : ''} removed in the last 180 days.` });
  return flags;
}

async function duplicateListingCheck(listing) {
  const same = await Listing.exists({
    seller: listing.seller, _id: { $ne: listing._id }, status: { $in: ['active', 'reserved', 'pending_review'] },
    title: { $regex: `^${escapeRx(listing.title.trim())}$`, $options: 'i' },
  });
  return same ? [{ code: 'duplicate_listing', sellerVisible: true, message: 'You already have a live listing with this exact title. Update that one instead, or change the title if this is different stock.' }] : [];
}

// full: on submit (includes the seller's history). Otherwise only content checks, for edits to live listings.
export async function runListingChecks(listing, settings, { full = true, now = new Date() } = {}) {
  const groups = await Promise.all([
    textChecks(listing, settings.blockedWords),
    duplicatePhotoCheck(listing),
    duplicateListingCheck(listing),
    full ? sellerHistoryCheck(listing, now) : [],
  ]);
  return groups.flat();
}
