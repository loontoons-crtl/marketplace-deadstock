import { z } from 'zod';
import { CONDITIONS, SELLER_TYPES, UNITS } from './constants.js';
import { normalizeIndianMobile } from './phone.js';

const text = (max, min = 0) => z.string().trim().min(min).max(max);
const optText = (max) => z.string().trim().max(max).optional().default('');

export const phoneField = z
  .string()
  .transform((v, ctx) => {
    const p = normalizeIndianMobile(v);
    if (!p) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 10-digit Indian mobile number.' }); return z.NEVER; }
    return p;
  });

export const passwordField = z.string().min(8, 'Use at least 8 characters.').max(128);

export const registerSchema = z.object({
  name: text(80, 2),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  phone: phoneField,
  password: passwordField,
  sellerType: z.enum(SELLER_TYPES, { errorMap: () => ({ message: 'Choose what kind of seller you are.' }) }),
  businessName: optText(120),
});

export const loginSchema = z.object({
  identifier: text(254, 3), // email or phone
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const otpVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') });

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const profileUpdateSchema = z
  .object({
    displayName: text(100, 2),
    sellerType: z.enum(SELLER_TYPES),
    businessName: text(120),
    gstin: z.string().trim().toUpperCase().refine((v) => v === '' || GSTIN.test(v), 'GSTIN should be 15 characters, like 29ABCDE1234F1Z5.'),
    about: text(1000),
    locality: text(80),
    showContact: z.boolean(),
  })
  .partial()
  .strict();

const intField = (label, min, max) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min, `${label} must be at least ${min}.`).max(max);

// Shape check only. Category, locality and spec keys are checked against the database in the route.
export const listingInputSchema = z.object({
  title: text(120, 5).refine((v) => v.length >= 5, 'Title needs at least 5 characters.'),
  categorySlug: z.string().trim().min(1, 'Choose a category.'),
  subcategory: optText(80),
  brand: optText(80),
  model: optText(80),
  description: optText(3000),
  condition: z.enum(CONDITIONS, { errorMap: () => ({ message: 'Choose a condition.' }) }),
  quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).positive('Quantity must be more than 0.').max(10_000_000),
  unit: z.enum(UNITS, { errorMap: () => ({ message: 'Choose a unit.' }) }),
  totalPrice: intField('Total price', 1, 1_000_000_000),
  mrp: z.union([z.literal(''), z.null(), intField('MRP', 1, 5_000_000_000)]).optional().transform((v) => (v === '' ? null : v)),
  minOrderQty: z.union([z.literal(''), z.null(), intField('Minimum order', 1, 10_000_000)]).optional().transform((v) => (v === '' || v == null ? null : v)),
  specs: z.record(z.string().trim().max(200)).optional().default({}),
  city: z.string().trim().default('Bengaluru'),
  locality: z.string().trim().min(1, 'Choose a locality.'),
  pickupDetails: optText(500),
});

export const listingUpdateSchema = listingInputSchema.partial();

export const availabilitySchema = z.object({ status: z.enum(['active', 'reserved', 'sold', 'unavailable']) });

export const publicSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  cat: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  locality: z.string().trim().max(80).optional(),
  cond: z.enum(CONDITIONS).optional().catch(undefined),
  brand: z.string().trim().max(80).optional(),
  min: z.coerce.number().int().min(0).optional().catch(undefined),
  max: z.coerce.number().int().min(0).optional().catch(undefined),
  sort: z.enum(['newest', 'low', 'high', 'relevance', 'near']).optional().catch(undefined),
  near: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(1),
  limit: z.coerce.number().int().min(1).max(24).optional().catch(12),
  exclude: z.string().trim().max(20).optional(),
});
