# Deadstock Bengaluru — annual storage subscriptions

Sellers pay one **annual subscription** and list as many products as they like. The plan sets how much **photo storage** they get. There is no fee per listing, no listing-count limit, no 90-day listing expiry, and no commission on sales.

## How it works

- **Free trial.** Starts automatically when a new seller verifies their phone: 30 days, 100 MB.
- **Starter plan.** ₹5,000 a year for 500 MB, created by `npm run seed`. Admins change prices and allowances, add bigger plans, and add extra-storage packs in **Admin → Plans and settings**. Nothing about pricing is hard-coded.
- **What counts as storage.** The compressed photos the platform stores for a seller, both the full image and the thumbnail. Text, prices and specs don't count.
  - Usage changes only on the server, through atomic updates.
  - A failed upload uses nothing.
  - A retried upload (same `Idempotency-Key`) is counted once.
  - Deleting a photo or a listing frees its space immediately.
- **Extra storage.** Sellers on a paid plan buy add-ons. An add-on is priced for the days left on the plan, ends on the same date, and can be renewed with the plan.
- **Renewal.** Plans don't renew by themselves. Renewing early adds a year from the current end date. Reminders go out 30, 7 and 1 days before the end; the days are configurable.
- **When a plan ends:**
  1. For 15 days (the grace period), listings stay visible but the seller can't add photos or publish.
  2. After that, listings are hidden from buyers.
  3. Data and photos are kept for 180 days and nothing is deleted automatically. Renewing shows everything again.
- **Listing checks.** When a seller submits, the server checks the listing automatically. A clean listing goes live immediately. A flagged one waits in **Admin → Listings**. The checks are:
  - phone numbers, emails or links in the text
  - admin-defined blocked words
  - totals under ₹100 or over ₹5 crore
  - a photo first uploaded by a different seller (perceptual hash, so resized copies are caught)
  - open reports or removals on the seller's account

  Editing a live listing re-runs the content checks. A setting switches to manual review of everything.
- **Payments.** Razorpay.
  - The server sets every price, creates the order and verifies Razorpay's signature.
  - The webhook is idempotent.
  - A browser "success" message activates nothing.
  - Without Razorpay keys, online payment is off and admins record offline UPI or bank payments instead. Each of these is logged.

## Moving from the old per-listing model

The server migrates existing data automatically the first time it starts with this version. It runs once, never deletes anything, and prints a summary.

| Before | After |
|---|---|
| Listings in **Awaiting payment** (already approved) | Live |
| Listings that hit the old 90-day expiry | **Unavailable**; the seller can make them live again in one click |
| Existing sellers with a verified phone | 30-day free trial |
| Photos uploaded before storage was metered | Measured (local storage) and counted |
| Old `activation` / `expiresAt` fields on listings | Kept for history, no longer used |

Removed or retired:
- the ₹1,500 per-listing payment and the "Awaiting payment" step
- the admin "Activate free (launch offer)" button, replaced by the trial and by admin offline grants
- 90-day listing expiry

New things:
- **Models:** `StorageProduct` (plans and add-ons), `Subscription`, `Payment`, `WebhookEvent`, `Notification`, `Settings`
- **Routes:** `/api/billing/*` and `/api/admin/{storage-products,settings,payments,sellers/:id/grant,…}`
- **Screens:** **Subscription and storage** (seller), and **Plans and settings** and **Payments** (admin)

## One-time setup

You need Node.js 20.12 or newer (`node -v`).

### 1. MongoDB Atlas

1. Create a free cluster at cloud.mongodb.com (choose the Mumbai region, `ap-south-1`).
2. Database Access → add a database user with a strong password.
3. Network Access → add your current IP address. Don't use 0.0.0.0/0 for anything except a short test.
4. Database → Connect → Drivers → copy the connection string. Put the database name `deadstock` after `.mongodb.net/`.

If your password has special characters such as `@` or `#`, URL-encode them in the connection string.

### 2. Backend

    cd deadstock/server
    npm install
    cp .env.example .env
    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste into SESSION_SECRET
    # edit .env: set MONGODB_URI
    npm run seed        # categories, 20 Bengaluru localities, 8 sample listings
    npm run dev         # API on http://localhost:4000

Check that `http://localhost:4000/api/health` shows `{"ok":true,"db":"connected"}`.

### 3. Frontend (second terminal)

    cd deadstock
    npm install
    npm run dev         # http://localhost:5173

Vite forwards `/api` to port 4000, so the browser sees a single origin and the session cookie works without CORS setup.

## Environment variables (server/.env)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string, including `/deadstock` |
| `SESSION_SECRET` | 32+ random characters; signs the session cookie |
| `PORT`, `CLIENT_ORIGIN` | API port; frontend origin(s) allowed to make logged-in changes |
| `SMS_PROVIDER` | `console` prints OTPs in the API terminal (development only) |
| `CLOUDINARY_URL` | Empty in development (photos go to `server/uploads`); required in production |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Online payment. Empty = switched off |
| `RAZORPAY_WEBHOOK_SECRET` | Secret for `/api/billing/webhook` (events `payment.captured`, `payment.failed`, `order.paid`) |
| `EMAIL_PROVIDER` | `console` prints renewal reminders in the terminal; a real provider is needed before launch |
| `RUN_JOBS` | Hourly reminder job; `false` on any extra copies of the API |

### Razorpay (test mode first)

1. Create a Razorpay account and stay in **Test mode**.
2. Go to Account & Settings → API Keys, generate test keys, and put them in `.env`.
3. Webhooks need a public URL, so set them up when you deploy. Locally, the checkout's own signature check activates the plan.
4. Pay with Razorpay's test cards or test UPI. No real money moves.

Payments have **not** been tested against Razorpay's servers yet. The automated tests use the real signature-checking code with test secrets, and simulate Razorpay's order step. Run one test-mode payment end to end before going live.

### Cloudinary (needed before going live, optional now)

1. Sign up at cloudinary.com (free plan).
2. Go to Settings → API Keys and copy the **API environment variable** (`cloudinary://…`).
3. Paste it as `CLOUDINARY_URL=` in `server/.env` and restart the API.

New photos then go to Cloudinary, and storage is still counted from the compressed size each photo takes there. Photos already saved locally stay in `server/uploads`.

The Cloudinary code path has not been tested against a real account yet. Do one upload after you set it up.

## Testing

    cd server
    npm test

There are 68 tests, run against a temporary MongoDB. They cover:

- storage limits, including parallel uploads and full accounts
- idempotent uploads
- trial start, plan purchase, add-on proration, early renewal, grace and expiry, reminders
- forged and duplicate payments, and webhooks
- automatic listing checks and admin review
- the migration from the old model
- all earlier features

## Try it by hand

1. Register a seller and verify the phone (the code appears in the API terminal). **Subscription and storage** shows the 30-day trial and 100 MB.
2. Add a listing with photos and submit it. It goes live straight away.
3. Add another with a phone number in the description. It waits for review, and the seller sees why.
4. Make an admin (`npm run create-admin -- email`) and open **Admin → Listings** to see the flag, then approve it.
5. In **Admin → Plans and settings**, add an extra-storage pack and set its price.
6. In **Admin → Sellers → (seller) → Record offline payment**, activate Starter. The seller's page then shows Starter for a year, with 500 MB, an add-on price for the days left, and payment history.

## Known gaps

- **Not yet used live:** Razorpay with real keys, a production email provider for reminders, and a production SMS provider (DLT template).
- **GST and invoices:** whether prices include GST is shown from a setting (confirm with your CA). Tax invoices are not generated yet.
- **Policies:** refund, cancellation and privacy pages still need writing; the refund-terms text is a setting.
- **Storage estimates:** the "≈ photos" figures assume about 300 KB per stored photo. Check real usage once sellers upload phone photos and adjust plan sizes.
- **Before launch:** password reset, changing the phone number, restoring a removed listing, and a shared rate-limit store if more than one API instance runs.

## Storefront design (premium look)

- Public pages (home, search, product) use an editorial style: Instrument Serif headings, a full-bleed hero slider, scroll-reveal sections, image category tiles and swipeable rows. Seller and admin dashboards keep the plain working style.
- Hero slider (`src/components/HeroSlider.jsx`): autoplays every 7 s with progress bars, pauses on mouse hover, keyboard focus or when the tab is hidden, has a pause button, swipe and arrow-key support, and does not autoplay when the device asks for reduced motion.
- Optional **MRP** on listings: sellers can enter the MRP for the same quantity. It must be higher than the asking price (checked on the server). Buyers see it struck through with "X% below MRP". A claimed discount above 80% is held for review (`mrp_check`).
- Photography in `public/hero` and `public/cat` is from Unsplash (free licence, attribution not required) and is used as category mood imagery, not as product photos. Replace with your own shoots when you can. Doors and plumbing have no photo yet and use drawn swatches.
