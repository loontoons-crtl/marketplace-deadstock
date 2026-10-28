const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const money = (n) => inr.format(n);
export const num = (n) => new Intl.NumberFormat('en-IN').format(n);
// Unit price only when quantity is a real countable unit; never guessed.
export function unitPrice(l) {
  if (!l.qty || l.qty <= 0 || l.unit === 'lot' || !l.total) return null;
  return `${inr2.format(l.total / l.qty)} / ${l.unit}`;
}
export const daysAgo = (iso) => {
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
export const dateIN = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
// Official WhatsApp click-to-chat URL. phone is digits only, e.g. 919845012345.
export const waLink = (phone, title) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(`Hi, I saw "${title}" on Deadstock Bengaluru. Is it still available?`)}`;

export const STATUS_LABEL = {
  draft: 'Draft', pending_review: 'Pending review', pending_payment: 'Live', active: 'Live', reserved: 'Reserved',
  sold: 'Sold', unavailable: 'Unavailable', rejected: 'Rejected', expired: 'Unavailable', removed: 'Removed',
};

export function bytes(n) {
  if (!n) return '0 MB';
  const gb = n / 1024 ** 3;
  if (gb >= 1) return `${gb >= 10 || Number.isInteger(gb) ? Math.round(gb) : gb.toFixed(1)} GB`;
  const mb = n / 1024 ** 2;
  if (mb < 1) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}
// Rough photo count for a storage amount. Uses the seller's real average when known.
export const TYPICAL_PHOTO_BYTES = 300 * 1024;
export const approxPhotos = (n, avg) => Math.floor(n / (avg || TYPICAL_PHOTO_BYTES));
export const rupees = (n) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;

// "1 photo", "3 photos" (Indian digit grouping).
export const plural = (n, one, many = `${one}s`) => `${new Intl.NumberFormat('en-IN').format(n)} ${n === 1 ? one : many}`;

// Discount against the seller's stated MRP. Rounded down so we never overstate it.
export const discountPct = (l) => (l.mrp && l.total && l.mrp > l.total ? Math.floor((1 - l.total / l.mrp) * 100) : null);
