export const SELLER_TYPES = ['Dealer', 'Distributor', 'Manufacturer', 'Retailer', 'Contractor', 'Business', 'Individual'];

export const CONDITIONS = ['Unused surplus', 'Discontinued stock', 'Opened packaging', 'Used', 'Damaged'];

export const UNITS = ['sheets', 'boxes', 'pcs', 'sq ft', 'sq m', 'running ft', 'kg', 'sets', 'rolls', 'lot'];

// Lifecycle: draft → pending_review (a seller's first few listings) → active, or draft → active directly
// once the seller is past the review threshold. rejected / removed are set by admins.
// 'pending_payment' and 'expired' belong to the old per-listing model; a startup migration moves them away.
export const LISTING_STATUSES = ['draft', 'pending_review', 'active', 'reserved', 'sold', 'unavailable', 'rejected', 'removed', 'pending_payment', 'expired'];

// Live statuses: shown publicly (active, reserved) or paused by the seller (unavailable).
export const LIVE_STATUSES = ['active', 'reserved', 'unavailable'];

// Statuses a buyer can see in public search and on the product page.
export const PUBLIC_STATUSES = ['active', 'reserved'];

// Sellers can delete any listing except one removed by moderation (kept as a record).
// Deleting frees the storage its photos used.
export const DELETABLE_STATUSES = ['draft', 'pending_review', 'active', 'reserved', 'sold', 'unavailable', 'rejected'];

// Seller-controlled availability changes on a live listing.
export const SELLER_AVAILABILITY_TRANSITIONS = {
  active: ['reserved', 'sold', 'unavailable'],
  reserved: ['active', 'sold', 'unavailable'],
  unavailable: ['active', 'sold'],
};

export const REPORT_REASONS = ['Fake or misleading listing', 'Wrong price or quantity', 'Already sold', 'Seller unreachable', 'Prohibited item', 'Suspected fraud or scam', 'Other'];

export const MB = 1024 * 1024;
export const GB = 1024 * MB;
