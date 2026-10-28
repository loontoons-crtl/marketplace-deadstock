import { phoneDigits } from './phone.js';

// Converts DB documents into the JSON shape the frontend uses.
// Field names match the Phase 1 sample data so existing components keep working.

function specRows(listing, category) {
  const specs = listing.specs instanceof Map ? Object.fromEntries(listing.specs) : listing.specs || {};
  const out = {};
  for (const f of category?.specFields || []) if (specs[f.key]) out[f.label] = specs[f.key];
  return out;
}

export function sellerPublic(profile, user, { withContact }) {
  if (!profile) return null;
  const canShow = withContact && profile.showContact && user?.phoneVerifiedAt;
  return {
    name: profile.displayName,
    type: profile.sellerType,
    idVerified: Boolean(profile.identityVerifiedAt),
    bizVerified: Boolean(profile.businessVerifiedAt),
    phoneVerified: Boolean(user?.phoneVerifiedAt),
    phone: canShow ? phoneDigits(user.phone) : null,
  };
}

export function listingPublic(l, { category, profile, user, withContact = false }) {
  return {
    id: l.listingNo,
    title: l.title,
    cat: category?.slug,
    sub: l.subcategory,
    brand: l.brand,
    model: l.model,
    condition: l.condition,
    qty: l.quantity,
    unit: l.unit,
    total: l.totalPrice,
    mrp: l.mrp > l.totalPrice ? l.mrp : null,
    minOrder: l.minOrderQty,
    locality: l.locality,
    city: l.city,
    created: (l.activatedAt || l.createdAt)?.toISOString(),
    updated: l.updatedAt?.toISOString(),
    status: l.status,
    specs: specRows(l, category),
    pickup: l.pickupDetails,
    desc: l.description,
    isSample: l.isSample,
    images: (l.images || []).map((i) => ({ url: i.url, thumb: i.thumbUrl, w: i.width, h: i.height })),
    ...(l.distanceKm != null ? { distanceKm: l.distanceKm } : {}),
    seller: sellerPublic(profile, user, { withContact }),
  };
}

// Owner view: raw editable values plus lifecycle fields.
export function listingOwner(l, category) {
  return {
    _id: l._id,
    id: l.listingNo,
    title: l.title,
    categorySlug: category?.slug,
    categoryName: category?.name,
    subcategory: l.subcategory,
    brand: l.brand,
    model: l.model,
    description: l.description,
    condition: l.condition,
    quantity: l.quantity,
    unit: l.unit,
    totalPrice: l.totalPrice,
    mrp: l.mrp ?? null,
    minOrderQty: l.minOrderQty,
    specs: l.specs instanceof Map ? Object.fromEntries(l.specs) : l.specs || {},
    city: l.city,
    locality: l.locality,
    pickupDetails: l.pickupDetails,
    status: l.status,
    images: (l.images || []).map((i) => ({ _id: i._id, url: i.url, thumb: i.thumbUrl, bytes: i.bytes || 0 })),
    storageBytes: (l.images || []).reduce((s, i) => s + (i.bytes || 0), 0),
    rejectionReason: l.rejectionReason,
    // Only reasons the seller can act on; fraud signals stay with the admin.
    reviewReasons: (l.moderationFlags || []).filter((f) => f.sellerVisible).map((f) => f.message),
    removedReason: l.removedReason,
    autoPublished: Boolean(l.autoPublishedAt),
    submittedAt: l.submittedAt,
    activatedAt: l.activatedAt,
    views: l.views,
    contactClicks: l.contactClicks,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

export function userSelf(user, profile) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    role: user.role,
    profile: profile
      ? {
          displayName: profile.displayName,
          sellerType: profile.sellerType,
          businessName: profile.businessName,
          gstin: profile.gstin,
          about: profile.about,
          city: profile.city,
          locality: profile.locality,
          showContact: profile.showContact,
          idVerified: Boolean(profile.identityVerifiedAt),
          bizVerified: Boolean(profile.businessVerifiedAt),
        }
      : null,
  };
}
