// End-to-end API tests against a real (temporary, in-memory) MongoDB server.
// Run: npm test
process.env.NODE_ENV = 'test';
// Test-only Razorpay secrets: signatures are computed locally; no request reaches Razorpay.
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { seedReference, seedSamples } = await import('../scripts/seedLib.js');
const { Listing } = await import('../src/models/Listing.js');
const { User } = await import('../src/models/User.js');
const { testOutbox } = await import('../src/lib/sms.js');
const { LOCAL_DIR } = await import('../src/lib/storage.js');
const { AdminAuditLog } = await import('../src/models/AdminAuditLog.js');
const { Report } = await import('../src/models/Report.js');
const { Subscription } = await import('../src/models/Subscription.js');
const { Payment } = await import('../src/models/Payment.js');
const { Notification } = await import('../src/models/Notification.js');
const { Settings, clearSettingsCache } = await import('../src/models/Settings.js');
const { refreshSellerAccess } = await import('../src/lib/entitlement.js');
const { runSubscriptionJobs } = await import('../src/lib/jobs.js');
const { runMigrations } = await import('../src/lib/migrate.js');
const { testEmails } = await import('../src/lib/email.js');
const { razorpay } = await import('../src/lib/razorpay.js');
const { processListingImage } = await import('../src/lib/images.js');

// Razorpay order creation is stubbed; everything after it (signatures, webhooks) runs for real.
let orderSeq = 0;
razorpay.createOrder = async ({ amountPaise }) => ({ id: `order_test_${++orderSeq}`, amount: amountPaise, currency: 'INR', status: 'created' });
const sign = (orderId, paymentId) => crypto.createHmac('sha256', 'test_key_secret').update(`${orderId}|${paymentId}`).digest('hex');
const webhook = (event, eventId) => {
  const raw = JSON.stringify(event);
  return request(app).post('/api/billing/webhook').set('Content-Type', 'application/json')
    .set('x-razorpay-signature', crypto.createHmac('sha256', 'test_webhook_secret').update(raw).digest('hex'))
    .set('x-razorpay-event-id', eventId).send(raw);
};

// A real JPEG with EXIF metadata, to check uploads are re-encoded and stripped.
// Each call draws a different random pattern, so photos from different "sellers" are genuinely different
// (the duplicate-photo check would otherwise, correctly, flag them as reused).
const jpeg = (w = 800, h = 600) => {
  const rects = Array.from({ length: 6 }, () => {
    const [x, y, rw, rh, c] = [crypto.randomInt(w), crypto.randomInt(h), 50 + crypto.randomInt(w / 2), 50 + crypto.randomInt(h / 2), crypto.randomInt(0xffffff)];
    return `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="#${c.toString(16).padStart(6, '0')}"/>`;
  }).join('');
  return sharp({ create: { width: w, height: h, channels: 3, background: '#8a6a47' } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${rects}</svg>`) }])
    .withExif({ IFD0: { Copyright: 'SECRET-EXIF-MARKER' } }).jpeg().toBuffer();
};
const setSettings = async (v) => { await Settings.updateOne({ _id: 'platform' }, { $set: v }, { upsert: true }); clearSettingsCache(); };

let mongo, app;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri('deadstock_test'));
  await Listing.syncIndexes();
  await seedReference();
  await seedSamples();
  app = createApp();
});
after(async () => { await disconnectDb(); await mongo.stop(); await fs.rm(LOCAL_DIR, { recursive: true, force: true }); });

const seller = (n) => ({ name: `Seller ${n}`, email: `s${n}@test.in`, phone: `98450000${String(n).padStart(2, '0')}`, password: 'correct-horse-1', sellerType: 'Dealer', businessName: `Test Traders ${n}` });
const draft = { title: 'Pre-laminated MDF boards 18 mm', categorySlug: 'laminates', condition: 'Unused surplus', quantity: 40, unit: 'sheets', totalPrice: 52000, locality: 'Peenya', specs: { sheetSize: '8 ft x 4 ft', bogusKey: 'dropped' }, description: 'Short' };

async function verifyPhone(agent) {
  await agent.post('/api/auth/phone/send-otp');
  const r = await agent.post('/api/auth/phone/verify').send({ code: testOutbox.at(-1).code });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}

async function registered(n) {
  const agent = request.agent(app);
  const r = await agent.post('/api/auth/register').send(seller(n));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return agent;
}

describe('public browsing', () => {
  test('meta lists categories, localities and brands', async () => {
    const r = await request(app).get('/api/meta');
    assert.equal(r.status, 200);
    assert.equal(r.body.categories.length, 12);
    assert.ok(r.body.localities.includes('Peenya'));
    assert.ok(r.body.brands.includes('Sample Brand A'));
  });
  test('search returns active sample listings without phone numbers', async () => {
    const r = await request(app).get('/api/listings?limit=24');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 8);
    for (const l of r.body.items) assert.equal(l.seller.phone, null);
  });
  test('filters, text search and sorting', async () => {
    let r = await request(app).get('/api/listings?cat=tiles');
    assert.deepEqual(r.body.items.map((l) => l.cat), ['tiles']);
    r = await request(app).get('/api/listings?q=granite');
    assert.match(r.body.items[0].title, /granite/i);
    r = await request(app).get('/api/listings?sort=low&limit=24');
    const prices = r.body.items.map((l) => l.total);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    r = await request(app).get('/api/listings?min=100000&max=150000&limit=24');
    assert.ok(r.body.items.every((l) => l.total >= 100000 && l.total <= 150000));
    r = await request(app).get('/api/listings?locality=Whitefield');
    assert.equal(r.body.total, 1);
  });
  test('sample sellers never publish a phone number', async () => {
    const list = await request(app).get('/api/listings?limit=1');
    const r = await request(app).get(`/api/listings/${list.body.items[0].id}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.listing.seller.phone, null);
  });
  test('unknown listing is 404', async () => {
    assert.equal((await request(app).get('/api/listings/DS-999999')).status, 404);
  });
});

describe('authentication', () => {
  test('register, me, logout, login by email and by phone', async () => {
    const agent = await registered(1);
    let me = await agent.get('/api/auth/me');
    assert.equal(me.body.user.email, 's1@test.in');
    assert.equal(me.body.user.phone, '+919845000001');
    assert.equal(me.body.user.phoneVerified, false);
    assert.equal(me.body.user.role, 'seller');
    await agent.post('/api/auth/logout');
    me = await agent.get('/api/auth/me');
    assert.equal(me.body.user, null);
    assert.equal((await agent.post('/api/auth/login').send({ identifier: 'S1@test.in', password: 'correct-horse-1' })).status, 200);
    assert.equal((await request(app).post('/api/auth/login').send({ identifier: '+91 98450 00001', password: 'correct-horse-1' })).status, 200);
  });
  test('rejects duplicates, bad phone, weak password and wrong password', async () => {
    assert.equal((await request(app).post('/api/auth/register').send(seller(1))).status, 409);
    const bad = await request(app).post('/api/auth/register').send({ ...seller(2), phone: '12345', password: 'short' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.fields.phone && bad.body.fields.password);
    const wrong = await request(app).post('/api/auth/login').send({ identifier: 's1@test.in', password: 'nope-nope' });
    assert.equal(wrong.status, 401);
    const none = await request(app).post('/api/auth/login').send({ identifier: 'nobody@test.in', password: 'nope-nope' });
    assert.equal(none.status, 401);
    assert.equal(none.body.error, wrong.body.error); // no account enumeration
  });
  test('register cannot self-assign admin role', async () => {
    const r = await request(app).post('/api/auth/register').send({ ...seller(3), role: 'admin' });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, 'seller');
  });
  test('cross-site origin is refused on state-changing requests', async () => {
    const r = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ identifier: 's1@test.in', password: 'correct-horse-1' });
    assert.equal(r.status, 403);
  });
  test('suspended account loses its session immediately', async () => {
    const agent = await registered(4);
    await User.updateOne({ email: 's4@test.in' }, { status: 'suspended' });
    assert.equal((await agent.get('/api/seller/listings')).status, 401);
    assert.equal((await agent.post('/api/auth/login').send({ identifier: 's4@test.in', password: 'correct-horse-1' })).status, 403);
  });
});

describe('phone verification', () => {
  test('wrong code fails, right code verifies, attempts are limited', async () => {
    const agent = await registered(5);
    assert.equal((await agent.post('/api/auth/phone/send-otp')).status, 200);
    const { code } = testOutbox.at(-1);
    const wrong = code === '000000' ? '111111' : '000000';
    assert.equal((await agent.post('/api/auth/phone/verify').send({ code: wrong })).status, 400);
    assert.equal((await agent.post('/api/auth/phone/send-otp')).status, 429); // resend cooldown
    const ok = await agent.post('/api/auth/phone/verify').send({ code });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.phoneVerified, true);
    assert.equal((await agent.post('/api/auth/phone/verify').send({ code })).status, 400); // code is single-use
  });
  test('needs login', async () => {
    assert.equal((await request(app).post('/api/auth/phone/send-otp')).status, 401);
  });
});

describe('seller listings', () => {
  let a, b, id, listingNo;
  // These tests walk through admin review, so every listing waits for an admin here.
  before(async () => { await setSettings({ moderationMode: 'manual' }); a = await registered(10); b = await registered(11); });
  after(() => setSettings({ moderationMode: 'auto' }));

  test('anonymous users cannot create listings', async () => {
    assert.equal((await request(app).post('/api/seller/listings').send(draft)).status, 401);
  });
  test('create a draft; unknown spec keys are dropped', async () => {
    const r = await a.post('/api/seller/listings').send(draft);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.listing.status, 'draft');
    assert.match(r.body.listing.id, /^DS-1\d{3,}$/);
    assert.deepEqual(r.body.listing.specs, { sheetSize: '8 ft x 4 ft' });
    id = r.body.listing._id; listingNo = r.body.listing.id;
  });
  test('invalid locality, category and price are rejected', async () => {
    const r = await a.post('/api/seller/listings').send({ ...draft, locality: 'Atlantis' });
    assert.equal(r.status, 400); assert.ok(r.body.fields.locality);
    assert.equal((await a.post('/api/seller/listings').send({ ...draft, categorySlug: 'nope' })).status, 400);
    assert.equal((await a.post('/api/seller/listings').send({ ...draft, totalPrice: -5 })).status, 400);
  });
  test('cannot set status or seller through the form', async () => {
    const r = await a.post('/api/seller/listings').send({ ...draft, status: 'active', seller: '000000000000000000000000' });
    assert.equal(r.body.listing.status, 'draft');
    const doc = await Listing.findById(r.body.listing._id);
    assert.notEqual(String(doc.seller), '000000000000000000000000');
    await a.delete(`/api/seller/listings/${r.body.listing._id}`);
  });
  test('another seller cannot read, edit or delete it', async () => {
    assert.equal((await b.get(`/api/seller/listings/${id}`)).status, 404);
    assert.equal((await b.patch(`/api/seller/listings/${id}`).send({ totalPrice: 1 })).status, 404);
    assert.equal((await b.delete(`/api/seller/listings/${id}`)).status, 404);
    assert.equal((await b.get('/api/seller/listings')).body.items.length, 0);
  });
  test('drafts are not public', async () => {
    assert.equal((await request(app).get(`/api/listings/${listingNo}`)).status, 404);
  });
  test('submission requires required specs, then verified phone, then contact consent', async () => {
    let r = await a.post(`/api/seller/listings/${id}/submit`);
    assert.equal(r.status, 400);
    assert.ok(r.body.fields['specs.thickness']); assert.ok(r.body.fields.description); assert.ok(r.body.fields.images);
    await a.patch(`/api/seller/listings/${id}`).send({ specs: { sheetSize: '8 ft x 4 ft', thickness: '18 mm' }, description: 'Sealed packs from a cancelled hotel project.' });
    // No subscription yet: photos need the free trial, which starts when the phone is verified.
    let up = await a.post(`/api/seller/listings/${id}/images`).attach('photo', await jpeg(), 'stock.jpg');
    assert.equal(up.status, 403); assert.equal(up.body.code, 'subscription_required');
    await verifyPhone(a);
    up = await a.post(`/api/seller/listings/${id}/images`).attach('photo', await jpeg(), 'stock.jpg');
    assert.equal(up.status, 201);
    r = await a.post(`/api/seller/listings/${id}/submit`);
    assert.equal(r.status, 403); assert.match(r.body.error, /Allow buyers/);
    assert.equal((await a.patch('/api/seller/profile').send({ showContact: true })).status, 200);
    r = await a.post(`/api/seller/listings/${id}/submit`);
    assert.equal(r.status, 200); assert.equal(r.body.listing.status, 'pending_review');
    assert.equal((await request(app).get(`/api/listings/${listingNo}`)).status, 404); // still not public
  });
  test('category is locked after submission', async () => {
    const r = await a.patch(`/api/seller/listings/${id}`).send({ categorySlug: 'tiles' });
    assert.equal(r.status, 409);
  });
  test('profile cannot self-verify', async () => {
    const r = await a.patch('/api/seller/profile').send({ identityVerifiedAt: new Date().toISOString() });
    assert.equal(r.status, 400);
  });
  test('once live, it is public with the verified phone', async () => {
    await Listing.updateOne({ _id: id }, { status: 'active', approvedAt: new Date(), activatedAt: new Date(), sellerAccessUntil: new Date(Date.now() + 30 * 864e5) });
    const r = await request(app).get(`/api/listings/${listingNo}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.listing.seller.phone, '919845000010');
    assert.equal(r.body.listing.specs.Thickness, '18 mm');
    assert.equal((await request(app).post(`/api/listings/${listingNo}/contact`).send({ channel: 'whatsapp' })).status, 200);
    const mine = await a.get(`/api/seller/listings/${id}`);
    assert.equal(mine.body.listing.contactClicks.whatsapp, 1);
    assert.ok(mine.body.listing.views >= 1);
    assert.equal(mine.body.listing.status, 'active'); // a contact click does not mark it sold
  });
  test('title locked once approved; price can change', async () => {
    assert.equal((await a.patch(`/api/seller/listings/${id}`).send({ title: 'Something else entirely' })).status, 409);
    assert.equal((await a.patch(`/api/seller/listings/${id}`).send({ totalPrice: 48000 })).status, 200);
  });
  test('listings hide when the seller\'s access window has passed, whatever their status', async () => {
    const r = await a.post('/api/seller/listings').send({ ...draft, title: 'Lapsed lot test listing' });
    await Listing.updateOne({ _id: r.body.listing._id }, { status: 'active', activatedAt: new Date(Date.now() - 91 * 864e5), sellerAccessUntil: new Date(Date.now() - 864e5) });
    assert.equal((await request(app).get(`/api/listings/${r.body.listing.id}`)).status, 404);
    const s = await request(app).get('/api/listings?q=Lapsed');
    assert.equal(s.body.total, 0);
    await a.delete(`/api/seller/listings/${r.body.listing._id}`);
  });
  test('no 90-day expiry: reserved stays visible, sold leaves search, and any listing can be deleted to free storage', async () => {
    assert.equal((await a.post(`/api/seller/listings/${id}/availability`).send({ status: 'reserved' })).status, 200);
    assert.equal((await request(app).get(`/api/listings/${listingNo}`)).status, 200);
    assert.equal((await a.post(`/api/seller/listings/${id}/availability`).send({ status: 'sold' })).status, 200);
    assert.equal((await request(app).get(`/api/listings/${listingNo}`)).status, 404);
    assert.equal((await a.post(`/api/seller/listings/${id}/availability`).send({ status: 'active' })).status, 409);
    const used = (await User.findOne({ email: 's10@test.in' })).storageUsedBytes;
    assert.ok(used > 0);
    assert.equal((await a.delete(`/api/seller/listings/${id}`)).status, 200);
    assert.equal((await User.findOne({ email: 's10@test.in' })).storageUsedBytes, 0);
  });
  test('drafts can be deleted', async () => {
    const r = await a.post('/api/seller/listings').send(draft);
    assert.equal((await a.delete(`/api/seller/listings/${r.body.listing._id}`)).status, 200);
  });
});

// ---------------------------------------------------------------- Phase 3

async function readyListing(agent, n, extra = {}, { verify = true } = {}) {
  // Verified phone (starts the trial) + consent + a complete listing with one photo, then submitted.
  if (verify) await verifyPhone(agent);
  await agent.patch('/api/seller/profile').send({ showContact: true });
  const r = await agent.post('/api/seller/listings').send({ ...draft, title: `Phase three listing ${n}`, specs: { sheetSize: '8 x 4', thickness: '1 mm' }, description: 'Sealed stock stored indoors, ready for pickup.', ...extra });
  const id = r.body.listing._id;
  await agent.post(`/api/seller/listings/${id}/images`).attach('photo', await jpeg(), 'p.jpg');
  const s = await agent.post(`/api/seller/listings/${id}/submit`);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  return { id, no: r.body.listing.id, status: s.body.listing.status };
}

describe('photos', () => {
  let a, b, id;
  before(async () => {
    a = await registered(20); b = await registered(21);
    await verifyPhone(a); await verifyPhone(b);
    id = (await a.post('/api/seller/listings').send(draft)).body.listing._id;
  });
  test('rejects files that are not images, whatever the extension says', async () => {
    const r = await a.post(`/api/seller/listings/${id}/images`).attach('photo', Buffer.from('<?php echo 1; ?>'), { filename: 'x.jpg', contentType: 'image/jpeg' });
    assert.equal(r.status, 400);
  });
  test('rejects tiny images', async () => {
    assert.equal((await a.post(`/api/seller/listings/${id}/images`).attach('photo', await jpeg(200, 150), 't.jpg')).status, 400);
  });
  test('stores a re-encoded WebP with metadata removed', async () => {
    const r = await a.post(`/api/seller/listings/${id}/images`).attach('photo', await jpeg(3000, 2000), 'big.jpg');
    assert.equal(r.status, 201);
    const img = r.body.listing.images[0];
    assert.match(img.url, /^\/uploads\/[a-z0-9]+-[a-f0-9]{16}\.webp$/);
    const file = await fs.readFile(path.join(LOCAL_DIR, path.basename(img.url)));
    const meta = await sharp(file).metadata();
    assert.equal(meta.format, 'webp');
    assert.ok(meta.width <= 1600);
    assert.equal(meta.exif, undefined);
    assert.ok(!file.includes('SECRET-EXIF-MARKER'));
  });
  test('another seller cannot add or delete photos', async () => {
    assert.equal((await b.post(`/api/seller/listings/${id}/images`).attach('photo', await jpeg(), 'x.jpg')).status, 404);
    const mine = (await a.get(`/api/seller/listings/${id}`)).body.listing;
    assert.equal((await b.delete(`/api/seller/listings/${id}/images/${mine.images[0]._id}`)).status, 404);
  });
  test('at most 8 photos; reorder sets the cover; delete removes the file', async () => {
    for (let i = 0; i < 7; i++) assert.equal((await a.post(`/api/seller/listings/${id}/images`).attach('photo', await jpeg(), `p${i}.jpg`)).status, 201);
    assert.equal((await a.post(`/api/seller/listings/${id}/images`).attach('photo', await jpeg(), 'p9.jpg')).status, 409);
    let l = (await a.get(`/api/seller/listings/${id}`)).body.listing;
    const ids = l.images.map((i) => i._id);
    const r = await a.put(`/api/seller/listings/${id}/images/order`).send({ ids: [...ids].reverse() });
    assert.equal(r.status, 200);
    assert.equal(r.body.listing.images[0]._id, ids.at(-1));
    assert.equal((await a.put(`/api/seller/listings/${id}/images/order`).send({ ids: ids.slice(1) })).status, 400);
    const gone = l.images[0];
    assert.equal((await a.delete(`/api/seller/listings/${id}/images/${gone._id}`)).status, 200);
    await assert.rejects(fs.access(path.join(LOCAL_DIR, path.basename(gone.url))));
  });
});

describe('admin moderation', () => {
  let admin, seller, other, L;
  after(() => setSettings({ moderationMode: 'auto' }));
  before(async () => {
    await setSettings({ moderationMode: 'manual' });
    admin = await registered(30);
    await User.updateOne({ email: 's30@test.in' }, { role: 'admin' });
    seller = await registered(31);
    other = await registered(32);
    L = await readyListing(seller, 1);
  });

  test('sellers and anonymous users cannot reach admin routes', async () => {
    assert.equal((await request(app).get('/api/admin/overview')).status, 401);
    assert.equal((await seller.get('/api/admin/overview')).status, 403);
    assert.equal((await seller.post(`/api/admin/listings/${L.id}/approve`).send({})).status, 403);
  });
  test('review queue shows the submitted listing with seller details', async () => {
    const r = await admin.get('/api/admin/listings?status=pending_review');
    assert.equal(r.status, 200);
    const row = r.body.items.find((x) => x._id === L.id);
    assert.ok(row);
    assert.equal(row.seller.email, 's31@test.in');
    assert.equal(row.images.length, 1);
  });
  test('reject needs a reason; seller sees it and can resubmit', async () => {
    assert.equal((await admin.post(`/api/admin/listings/${L.id}/reject`).send({ reason: 'no' })).status, 400);
    const r = await admin.post(`/api/admin/listings/${L.id}/reject`).send({ reason: 'Photo does not show the actual stock.' });
    assert.equal(r.body.listing.status, 'rejected');
    const mine = (await seller.get(`/api/seller/listings/${L.id}`)).body.listing;
    assert.equal(mine.rejectionReason, 'Photo does not show the actual stock.');
    assert.equal((await seller.post(`/api/seller/listings/${L.id}/submit`)).status, 200);
  });
  test('approve makes it live at once (no payment step), visible while the seller\'s trial lasts', async () => {
    const r = await admin.post(`/api/admin/listings/${L.id}/approve`).send({});
    assert.equal(r.body.listing.status, 'active');
    const pub = await request(app).get(`/api/listings/${L.no}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.listing.images.length, 1);
    assert.equal(pub.body.listing.expires, undefined); // no per-listing expiry any more
    assert.equal((await admin.post(`/api/admin/listings/${L.id}/approve`).send({})).status, 409); // not twice
    assert.equal((await admin.post(`/api/admin/listings/${L.id}/activate-complimentary`).send({ note: 'x' })).status, 404); // old route gone
    const actions = (await AdminAuditLog.find({ targetId: L.id })).map((x) => x.action);
    assert.deepEqual(actions.sort(), ['listing.approve', 'listing.reject']);
  });
  test('editing a live listing flags it for re-check', async () => {
    await seller.patch(`/api/seller/listings/${L.id}`).send({ totalPrice: 45000 });
    const r = await admin.get('/api/admin/listings?status=edited');
    assert.ok(r.body.items.some((x) => x._id === L.id));
    await admin.post(`/api/admin/listings/${L.id}/clear-edit-flag`);
    assert.ok(!(await admin.get('/api/admin/listings?status=edited')).body.items.some((x) => x._id === L.id));
  });
  test('verification: separate identity and business, method required, recorded', async () => {
    const sid = (await User.findOne({ email: 's31@test.in' }))._id;
    assert.equal((await admin.post(`/api/admin/sellers/${sid}/verify`).send({ kind: 'identity', verified: true })).status, 400);
    let r = await admin.post(`/api/admin/sellers/${sid}/verify`).send({ kind: 'identity', verified: true, method: 'Video call, name matched' });
    assert.equal(r.body.seller.profile.idVerified, true);
    assert.equal(r.body.seller.profile.bizVerified, false);
    r = await admin.post(`/api/admin/sellers/${sid}/verify`).send({ kind: 'business', verified: true, method: 'Looked at shop sign' });
    assert.equal(r.status, 400); // no GSTIN and no registration named
    const pub = await request(app).get(`/api/listings/${L.no}`);
    assert.equal(pub.body.listing.seller.idVerified, true);
    assert.equal(pub.body.listing.seller.bizVerified, false);
  });
  test('suspending a seller hides their listings and ends their access; unsuspend restores', async () => {
    const sid = (await User.findOne({ email: 's31@test.in' }))._id;
    const aid = (await User.findOne({ email: 's30@test.in' }))._id;
    assert.equal((await admin.post(`/api/admin/sellers/${aid}/suspend`).send({ reason: 'Testing self suspension' })).status, 409);
    assert.equal((await admin.post(`/api/admin/sellers/${sid}/suspend`).send({ reason: 'Repeated fake listings reported' })).status, 200);
    assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 404);
    assert.equal((await seller.get('/api/seller/listings')).status, 401);
    assert.equal((await admin.post(`/api/admin/sellers/${sid}/unsuspend`).send({ note: 'Cleared after a call' })).status, 200);
    assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 200);
    // Suspension ended the old session, so the seller logs in again.
    assert.equal((await seller.post('/api/auth/login').send({ identifier: 's31@test.in', password: 'correct-horse-1' })).status, 200);
  });
  test('reports: anyone can report; duplicates collapse; admin can action and remove', async () => {
    assert.equal((await request(app).post(`/api/listings/${L.no}/report`).send({ reason: 'Nonsense' })).status, 400);
    assert.equal((await request(app).post(`/api/listings/${L.no}/report`).send({ reason: 'Other', details: 'x' })).status, 400);
    assert.equal((await request(app).post(`/api/listings/${L.no}/report`).send({ reason: 'Already sold', details: 'Seller said it went last week.' })).status, 201);
    const dup = await request(app).post(`/api/listings/${L.no}/report`).send({ reason: 'Already sold' });
    assert.equal(dup.body.duplicate, true);
    assert.equal(await Report.countDocuments({ listing: L.id }), 1);
    const list = await admin.get('/api/admin/reports');
    const rep = list.body.items.find((x) => x.listing?.id === L.no);
    assert.ok(rep);
    assert.equal((await admin.post(`/api/admin/reports/${rep._id}/resolve`).send({ outcome: 'dismissed', note: 'n/a', removeListing: true })).status, 400);
    assert.equal((await admin.post(`/api/admin/reports/${rep._id}/resolve`).send({ outcome: 'actioned', note: 'Confirmed sold with seller; removed.', removeListing: true })).status, 200);
    assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 404);
    const mine = (await seller.get(`/api/seller/listings/${L.id}`)).body.listing;
    assert.equal(mine.status, 'removed');
    assert.equal(mine.removedReason, 'Confirmed sold with seller; removed.');
    assert.equal((await seller.patch(`/api/seller/listings/${L.id}`).send({ totalPrice: 1 })).status, 409);
    assert.equal((await seller.delete(`/api/seller/listings/${L.id}`)).status, 409);
  });
  test('categories: admin can add one and it appears for sellers; spec keys must be unique', async () => {
    const bad = await admin.post('/api/admin/categories').send({ slug: 'adhesives', name: 'Adhesives and sealants', specFields: [{ key: 'pack', label: 'Pack' }, { key: 'pack', label: 'Pack 2' }] });
    assert.equal(bad.status, 400);
    const r = await admin.post('/api/admin/categories').send({ slug: 'adhesives', name: 'Adhesives and sealants', specFields: [{ key: 'packSize', label: 'Pack size', required: true }] });
    assert.equal(r.status, 201);
    assert.ok((await request(app).get('/api/meta')).body.categories.some((c) => c.slug === 'adhesives'));
    await admin.patch(`/api/admin/categories/${r.body.category._id}`).send({ active: false });
    assert.ok(!(await request(app).get('/api/meta')).body.categories.some((c) => c.slug === 'adhesives'));
    assert.equal((await admin.patch(`/api/admin/categories/${r.body.category._id}`).send({ slug: 'renamed' })).status, 400);
  });
  test('locality coordinates: correcting a centre updates its listings', async () => {
    const locs = (await admin.get('/api/admin/localities')).body.items;
    const peenya = locs.find((l) => l.name === 'Peenya');
    assert.equal((await admin.patch(`/api/admin/localities/${peenya._id}`).send({ coords: { lat: 60, lng: 10 } })).status, 400); // outside India
    assert.equal((await admin.patch(`/api/admin/localities/${peenya._id}`).send({ coords: { lat: 13.03, lng: 77.52 } })).status, 200);
    const l = await Listing.findOne({ locality: 'Peenya', isSample: true });
    assert.deepEqual(l.location.coordinates, [77.52, 13.03]);
  });
  test('overview and audit log respond', async () => {
    const o = await admin.get('/api/admin/overview');
    assert.equal(o.status, 200);
    assert.ok(o.body.subscriptions.trial >= 1);
    assert.equal(typeof o.body.revenue.total, 'number');
    const a = await admin.get('/api/admin/audit');
    assert.ok(a.body.items.length >= 5);
  });
});

describe('location and contact', () => {
  test('sort by distance from a locality, nearest first, with approximate km', async () => {
    const r = await request(app).get('/api/listings?sort=near&near=Peenya&limit=24');
    assert.equal(r.status, 200);
    assert.equal(r.body.items[0].locality, 'Peenya');
    const d = r.body.items.map((x) => x.distanceKm);
    assert.ok(d.every((x) => typeof x === 'number'));
    assert.deepEqual(d, [...d].sort((x, y) => x - y));
    assert.equal((await request(app).get('/api/listings?sort=near')).status, 400);
  });
  test('repeat contact taps by one visitor count once', async () => {
    const one = (await request(app).get('/api/listings?limit=1')).body.items[0].id;
    const before = await Listing.findOne({ listingNo: one });
    for (let i = 0; i < 3; i++) await request(app).post(`/api/listings/${one}/contact`).send({ channel: 'call' });
    const afterL = await Listing.findOne({ listingNo: one });
    assert.equal(afterL.contactClicks.call - before.contactClicks.call, 1);
  });
});


// ---------------------------------------------------------------- Annual storage subscriptions

const DAYMS = 864e5;
const subOf = async (email) => Subscription.findOne({ seller: (await User.findOne({ email }))._id });

describe('annual storage subscriptions', () => {
  let admin, seller, planId, addonId, lockedPlanId;
  const email = 's41@test.in';

  // Pays for `body` the way the browser would: checkout, then verify with Razorpay's signature.
  async function pay(agent, body, paymentId = `pay_${crypto.randomUUID().slice(0, 8)}`) {
    const c = await agent.post('/api/billing/checkout').send(body);
    assert.equal(c.status, 201, JSON.stringify(c.body));
    const v = await agent.post('/api/billing/verify').send({ razorpay_order_id: c.body.orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(c.body.orderId, paymentId) });
    assert.equal(v.status, 200, JSON.stringify(v.body));
    return { checkout: c.body, verify: v.body, paymentId };
  }

  before(async () => {
    admin = await registered(40);
    await User.updateOne({ email: 's40@test.in' }, { role: 'admin' });
    seller = await registered(41);
  });

  test('before phone verification there is no subscription; verifying starts the 30-day trial', async () => {
    let b = (await seller.get('/api/billing')).body;
    assert.equal(b.entitlement.state, 'none');
    await verifyPhone(seller);
    b = (await seller.get('/api/billing')).body;
    assert.equal(b.entitlement.state, 'trial');
    assert.equal(b.entitlement.daysLeft, 30);
    assert.equal(b.entitlement.allowanceBytes, 100 * 1024 * 1024);
    assert.equal(b.paymentsEnabled, true);
  });

  test('only admins configure plans; inactive or storage-less plans cannot be bought', async () => {
    assert.equal((await seller.post('/api/admin/storage-products').send({ kind: 'plan', name: 'Hack', storageMB: 1, annualPrice: 1 })).status, 403);
    let r = await admin.post('/api/admin/storage-products').send({ kind: 'plan', name: 'Starter', storageMB: 2048, annualPrice: 5000, active: true });
    assert.equal(r.status, 201); planId = r.body.product._id;
    r = await admin.post('/api/admin/storage-products').send({ kind: 'addon', name: 'Extra 1 GB', storageMB: 1024, annualPrice: 1500, active: true });
    assert.equal(r.status, 201); addonId = r.body.product._id;
    r = await admin.post('/api/admin/storage-products').send({ kind: 'plan', name: 'Draft plan', storageMB: 1024, annualPrice: 3000, active: false });
    lockedPlanId = r.body.product._id;
    assert.equal((await seller.post('/api/billing/checkout').send({ purpose: 'subscription', productId: lockedPlanId })).status, 400);
    const meta = (await request(app).get('/api/meta')).body;
    assert.equal(meta.pricing.fromPrice, 5000);
    assert.equal(meta.pricing.trialDays, 30);
  });

  test('checkout amount comes from the server; nothing activates before verified payment', async () => {
    const c = await seller.post('/api/billing/checkout').send({ purpose: 'subscription', productId: planId, amount: 1, amountPaise: 100 });
    assert.equal(c.status, 201);
    assert.equal(c.body.amountPaise, 500000);
    assert.equal((await Payment.findById(c.body.paymentId)).status, 'created');
    assert.equal((await subOf(email)).kind, 'trial');
  });

  test('a forged signature is rejected and nothing activates', async () => {
    const c = await seller.post('/api/billing/checkout').send({ purpose: 'subscription', productId: planId });
    const v = await seller.post('/api/billing/verify').send({ razorpay_order_id: c.body.orderId, razorpay_payment_id: 'pay_fake', razorpay_signature: 'deadbeef' });
    assert.equal(v.status, 400);
    assert.equal((await subOf(email)).kind, 'trial');
    // Another seller can't verify someone else's order either.
    const other = await registered(42);
    const v2 = await other.post('/api/billing/verify').send({ razorpay_order_id: c.body.orderId, razorpay_payment_id: 'pay_x', razorpay_signature: sign(c.body.orderId, 'pay_x') });
    assert.equal(v2.status, 404);
  });

  test('a verified payment activates the plan exactly once, despite repeated verify calls and webhooks', async () => {
    const { checkout, paymentId } = await pay(seller, { purpose: 'subscription', productId: planId });
    let sub = await subOf(email);
    assert.equal(sub.kind, 'paid');
    assert.equal(sub.plan.storageBytes, 2048 * 1024 * 1024);
    const days = Math.round((sub.expiresAt - Date.now()) / DAYMS);
    assert.equal(days, 365);
    const firstExpiry = +sub.expiresAt;
    // Same verification again, then Razorpay's webhook for the same payment (twice, same event id).
    await seller.post('/api/billing/verify').send({ razorpay_order_id: checkout.orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(checkout.orderId, paymentId) });
    const evt = { event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: checkout.orderId, amount: checkout.amountPaise } } } };
    assert.equal((await webhook(evt, 'evt_1')).status, 200);
    assert.equal((await webhook(evt, 'evt_1')).body.duplicate, true);
    sub = await subOf(email);
    assert.equal(+sub.expiresAt, firstExpiry);
    assert.equal(await Payment.countDocuments({ seller: sub.seller, status: 'paid' }), 1);
    assert.ok(await Notification.exists({ user: sub.seller, kind: 'payment_received' }));
  });

  test('webhooks: bad signature refused; a failed payment is recorded; a later success on the same order still applies', async () => {
    const bad = await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'nope').send('{"event":"payment.captured"}');
    assert.equal(bad.status, 400);
    const c = (await seller.post('/api/billing/checkout').send({ purpose: 'addon', productId: addonId })).body;
    await webhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f1', order_id: c.orderId, amount: c.amountPaise, error_description: 'Card declined' } } } }, 'evt_f1');
    assert.equal((await Payment.findById(c.paymentId)).status, 'failed');
    // Wrong amount is ignored.
    await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_f2', order_id: c.orderId, amount: 1 } } } }, 'evt_f2');
    assert.equal((await Payment.findById(c.paymentId)).status, 'failed');
    await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_f3', order_id: c.orderId, amount: c.amountPaise } } } }, 'evt_f3');
    assert.equal((await Payment.findById(c.paymentId)).status, 'paid');
    const sub = await subOf(email);
    assert.equal(sub.addons.length, 1);
    assert.equal(+sub.addons[0].expiresAt, +sub.expiresAt);
  });

  test('add-on storage is charged for the days left and ends with the plan', async () => {
    const sub = await subOf(email);
    sub.expiresAt = new Date(Date.now() + 100 * DAYMS);
    await sub.save();
    const q = await seller.post('/api/billing/quote').send({ purpose: 'addon', productId: addonId });
    assert.equal(q.body.amount, Math.ceil((1500 * 100) / 365));
    await pay(seller, { purpose: 'addon', productId: addonId });
    const after = await subOf(email);
    assert.equal(after.addons.length, 2);
    assert.equal(+after.addons[1].expiresAt, +after.expiresAt);
    const b = (await seller.get('/api/billing')).body;
    assert.equal(b.entitlement.allowanceBytes, (2048 + 1024 + 1024) * 1024 * 1024);
    // A trial seller can't buy add-ons.
    const t = await registered(43); await verifyPhone(t);
    assert.equal((await t.post('/api/billing/quote').send({ purpose: 'addon', productId: addonId })).body.code, 'subscription_required');
  });

  test('renewing early extends from the current end date and can renew add-ons with it', async () => {
    const before = await subOf(email);
    const keep = [String(before.addons[0]._id)];
    const q = (await seller.post('/api/billing/quote').send({ purpose: 'subscription', productId: planId, keepAddonIds: keep })).body;
    assert.equal(q.amount, 5000 + 1500);
    await pay(seller, { purpose: 'subscription', productId: planId, keepAddonIds: keep });
    const after = await subOf(email);
    assert.equal(+after.expiresAt, +before.expiresAt + 365 * DAYMS);
    assert.equal(+after.addons[0].expiresAt, +after.expiresAt); // kept add-on renewed
    assert.equal(+after.addons[1].expiresAt, +before.expiresAt); // not kept: ends with the old period
  });

  test('storage is enforced on the server: a full account is refused, usage stays exact, and parallel uploads cannot overshoot', async () => {
    const u = await User.findOne({ email });
    const L = await readyListing(seller, 'quota', {}, { verify: false });
    const one = (await Listing.findById(L.id)).images[0].bytes;
    assert.ok(one > 0);
    const allowance = (await seller.get('/api/billing')).body.entitlement.allowanceBytes;
    const img = await jpeg();
    // The server re-encodes deterministically, so the stored size of this photo is known in advance.
    const p = await processListingImage(img);
    const size = p.full.length + p.thumb.length;
    // Room for exactly one more photo of this size.
    await User.updateOne({ _id: u._id }, { storageUsedBytes: allowance - Math.floor(size * 1.5) });
    const [r1, r2] = await Promise.all([
      seller.post(`/api/seller/listings/${L.id}/images`).attach('photo', img, 'a.jpg'),
      seller.post(`/api/seller/listings/${L.id}/images`).attach('photo', img, 'b.jpg'),
    ]);
    const codes = [r1.status, r2.status].sort();
    assert.deepEqual(codes, [201, 413]);
    const refused = r1.status === 413 ? r1 : r2;
    assert.equal(refused.body.code, 'storage_full');
    const used = (await User.findById(u._id)).storageUsedBytes;
    assert.equal(used, allowance - Math.floor(size * 1.5) + size);
    assert.ok(used <= allowance);
    // Deleting a photo releases exactly its size.
    const l = await Listing.findById(L.id);
    await seller.delete(`/api/seller/listings/${L.id}/images/${l.images[1]._id}`);
    assert.equal((await User.findById(u._id)).storageUsedBytes, used - l.images[1].bytes);
    await User.updateOne({ _id: u._id }, { storageUsedBytes: 0 });
    await seller.post('/api/admin/sellers/x/recalc-storage'); // sellers can't call admin tools
    const rc = await admin.post(`/api/admin/sellers/${u._id}/recalc-storage`);
    assert.equal(rc.body.after, (await Listing.findById(L.id)).images.reduce((t, i) => t + i.bytes, 0));
  });

  test('a retried upload with the same Idempotency-Key is stored and counted once', async () => {
    const L = await readyListing(seller, 'retry', {}, { verify: false });
    const before = (await User.findOne({ email })).storageUsedBytes;
    const img = await jpeg();
    const r1 = await seller.post(`/api/seller/listings/${L.id}/images`).set('Idempotency-Key', 'upload-key-1234').attach('photo', img, 'x.jpg');
    const r2 = await seller.post(`/api/seller/listings/${L.id}/images`).set('Idempotency-Key', 'upload-key-1234').attach('photo', img, 'x.jpg');
    assert.equal(r1.status, 201); assert.equal(r2.body.duplicate, true);
    const l = await Listing.findById(L.id);
    assert.equal(l.images.length, 2);
    assert.equal((await User.findOne({ email })).storageUsedBytes, before + l.images[1].bytes);
  });

  test('no listing-count limit: 25 more listings are fine within storage', async () => {
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => seller.post('/api/seller/listings').send({ ...draft, title: `Bulk lot number ${i}` })));
    assert.ok(results.every((r) => r.status === 201));
  });

  test('optional: each seller\'s first N listings reviewed by hand, then automatic', async () => {
    await admin.patch('/api/admin/settings').send({ reviewFirstListings: 2 });
    const s2 = await registered(44);
    const a1 = await readyListing(s2, 'r1');
    assert.equal(a1.status, 'pending_review');
    await admin.post(`/api/admin/listings/${a1.id}/approve`).send({});
    const a2 = await readyListing(s2, 'r2', {}, { verify: false });
    assert.equal(a2.status, 'pending_review'); // only 1 approved so far
    await admin.post(`/api/admin/listings/${a2.id}/approve`).send({});
    const a3 = await readyListing(s2, 'r3', {}, { verify: false });
    assert.equal(a3.status, 'active');
    assert.equal((await request(app).get(`/api/listings/${a3.no}`)).status, 200);
    assert.ok((await admin.get('/api/admin/listings?status=active')).body.items.find((x) => x._id === a3.id).autoPublished);
    await admin.patch('/api/admin/settings').send({ reviewFirstListings: 0 });
  });

  test('expiry: grace keeps listings visible but blocks new work; after grace they hide (not deleted); renewal shows them again', async () => {
    const s3 = await registered(45);
    const L = await readyListing(s3, 'exp');
    await admin.post(`/api/admin/listings/${L.id}/approve`).send({});
    const sid = (await User.findOne({ email: 's45@test.in' }))._id;
    // Trial ended yesterday: grace.
    await Subscription.updateOne({ seller: sid }, { expiresAt: new Date(Date.now() - DAYMS) });
    await refreshSellerAccess(sid);
    assert.equal((await s3.get('/api/billing')).body.entitlement.state, 'grace');
    assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 200);
    const up = await s3.post(`/api/seller/listings/${L.id}/images`).attach('photo', await jpeg(), 'g.jpg');
    assert.equal(up.status, 403); assert.equal(up.body.code, 'subscription_required');
    const d = (await s3.post('/api/seller/listings').send({ ...draft, title: 'Grace period draft', specs: { sheetSize: '8x4', thickness: '1mm' }, description: 'Draft written during the grace period.' })).body.listing;
    assert.ok(d); // drafts can still be written
    // 20 days after the end (grace is 15): hidden, but nothing deleted.
    await Subscription.updateOne({ seller: sid }, { expiresAt: new Date(Date.now() - 20 * DAYMS) });
    await refreshSellerAccess(sid);
    assert.equal((await s3.get('/api/billing')).body.entitlement.state, 'expired');
    assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 404);
    const kept = await Listing.findById(L.id);
    assert.equal(kept.status, 'active');
    await fs.access(path.join(LOCAL_DIR, path.basename(kept.images[0].url))); // photo still on disk
    // Paying brings them back.
    await pay(s3, { purpose: 'subscription', productId: planId });
    assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 200);
    assert.equal((await s3.get('/api/billing')).body.entitlement.state, 'active');
  });

  test('renewal reminders and end notices go out once each', async () => {
    const s4 = await registered(46); await verifyPhone(s4);
    const sid = (await User.findOne({ email: 's46@test.in' }))._id;
    await Subscription.updateOne({ seller: sid }, { expiresAt: new Date(Date.now() + 6 * DAYMS) });
    const n0 = testEmails.length;
    await runSubscriptionJobs();
    await runSubscriptionJobs();
    const mine = await Notification.find({ user: sid, kind: 'renewal_reminder' });
    assert.equal(mine.length, 1);
    assert.match(mine[0].key, /:7$/);
    assert.equal(testEmails.filter((e) => e.to === 's46@test.in').length, 1);
    await Subscription.updateOne({ seller: sid }, { expiresAt: new Date(Date.now() - 2 * DAYMS) });
    await runSubscriptionJobs();
    assert.ok(await Notification.exists({ user: sid, kind: 'subscription_ended' }));
    assert.ok(testEmails.length > n0);
  });

  test('admin can record an offline payment and end a subscription; both are audited', async () => {
    const s5 = await registered(47); await verifyPhone(s5);
    const u = await User.findOne({ email: 's47@test.in' });
    const g = await admin.post(`/api/admin/sellers/${u._id}/grant`).send({ productId: planId, amountReceived: 5000, reference: 'UPI 4521', note: 'Paid by UPI at the shop' });
    assert.equal(g.status, 200, JSON.stringify(g.body));
    assert.equal(g.body.payment.method, 'manual');
    assert.equal(g.body.payment.status, 'paid');
    assert.equal((await s5.get('/api/billing')).body.entitlement.state, 'active');
    assert.equal((await admin.post(`/api/admin/sellers/${u._id}/end-subscription`).send({ reason: 'Refunded on request' })).status, 200);
    assert.equal((await s5.get('/api/billing')).body.entitlement.state, 'grace');
    const actions = (await AdminAuditLog.find({ targetId: u._id })).map((a) => a.action);
    assert.ok(actions.includes('subscription.grant_subscription') && actions.includes('subscription.end'));
    const list = await admin.get('/api/admin/payments?method=manual');
    assert.ok(list.body.items.some((p) => p.reference === 'UPI 4521'));
  });

  test('migration from the old model converts listings and starts trials without deleting anything', async () => {
    const legacy = await registered(48);
    const uid = (await User.findOne({ email: 's48@test.in' }))._id;
    await User.updateOne({ _id: uid }, { phoneVerifiedAt: new Date() });
    const base = { ...draft, seller: uid, category: (await Listing.findOne({ isSample: true })).category, specs: {}, city: 'Bengaluru' };
    delete base.categorySlug;
    await Listing.create({ ...base, listingNo: 'DS-OLD1', status: 'pending_payment', reviewedAt: new Date() });
    await Listing.create({ ...base, listingNo: 'DS-OLD2', status: 'expired', expiresAt: new Date(Date.now() - DAYMS) });
    await Settings.updateOne({ _id: 'platform' }, { $set: { schemaVersion: 0 } }, { upsert: true });
    clearSettingsCache();
    await runMigrations();
    assert.equal((await Listing.findOne({ listingNo: 'DS-OLD1' })).status, 'active');
    assert.equal((await Listing.findOne({ listingNo: 'DS-OLD2' })).status, 'unavailable');
    assert.equal((await Subscription.findOne({ seller: uid })).kind, 'trial');
    // It had been approved under the old model, so it is now live for as long as the seller's trial lasts.
    const pub = await request(app).get('/api/listings/DS-OLD1');
    assert.equal(pub.status, 200);
    assert.equal(pub.body.listing.seller.phone, null); // no contact consent given, so no number shown
    assert.ok((await Listing.findOne({ listingNo: 'DS-OLD1' })).sellerAccessUntil > new Date());
    assert.equal(await Listing.countDocuments({ seller: uid }), 2); // nothing deleted
    assert.equal((await Settings.findById('platform')).schemaVersion, 4);
    assert.ok(legacy);
  });
});

// ---------------------------------------------------------------- Automatic listing checks

describe('automatic listing checks', () => {
  let admin, a, b;
  const full = { specs: { sheetSize: '8 x 4', thickness: '1 mm' }, description: 'Sealed stock stored indoors, ready for pickup.' };
  async function submitWith(agent, fields, photo) {
    const r = await agent.post('/api/seller/listings').send({ ...draft, ...full, ...fields });
    const id = r.body.listing._id;
    await agent.post(`/api/seller/listings/${id}/images`).attach('photo', photo || (await jpeg()), 'p.jpg');
    const s = await agent.post(`/api/seller/listings/${id}/submit`);
    assert.equal(s.status, 200, JSON.stringify(s.body));
    return { id, no: r.body.listing.id, listing: s.body.listing };
  }
  const adminRow = async (id) => (await admin.get(`/api/admin/listings/${id}`)).body.listing;
  before(async () => {
    await setSettings({ moderationMode: 'auto', reviewFirstListings: 0, blockedWords: [] });
    admin = await registered(60);
    await User.updateOne({ email: 's60@test.in' }, { role: 'admin' });
    a = await registered(61); b = await registered(62);
    for (const x of [a, b]) { await verifyPhone(x); await x.patch('/api/seller/profile').send({ showContact: true }); }
  });

  test('a clean listing goes live immediately, with no admin step', async () => {
    const L = await submitWith(a, { title: 'Clean walnut laminate lot' });
    assert.equal(L.listing.status, 'active');
    assert.deepEqual(L.listing.reviewReasons, []);
    assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 200);
  });
  test('phone numbers, emails or links in the text send it to review, with a reason the seller can fix', async () => {
    for (const description of ['Call 98450 12345 for a better rate on this lot.', 'Email sales@kumar-laminates.in for the full list.', 'See photos at www.example.com/lot before buying.']) {
      const L = await submitWith(a, { title: `Contact test ${description.slice(0, 12)}`, description });
      assert.equal(L.listing.status, 'pending_review', description);
      assert.match(L.listing.reviewReasons[0], /Remove phone numbers/);
      assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 404);
      assert.equal((await adminRow(L.id)).flags[0].code, 'contact_in_text');
    }
  });
  test('admin-defined blocked words and implausible prices are flagged', async () => {
    await admin.patch('/api/admin/settings').send({ blockedWords: ['Asbestos'] });
    let L = await submitWith(a, { title: 'Asbestos cement roofing sheets' });
    assert.equal(L.listing.status, 'pending_review');
    assert.match(L.listing.reviewReasons.join(' '), /asbestos/);
    L = await submitWith(a, { title: 'Ninety nine rupee lot', totalPrice: 99 });
    assert.equal(L.listing.status, 'pending_review');
    assert.equal((await adminRow(L.id)).flags[0].code, 'price_check');
    await admin.patch('/api/admin/settings').send({ blockedWords: [] });
  });
  test('MRP: must be above the asking price, is shown publicly, and a discount over 80% goes to review', async () => {
    const bad = await a.post('/api/seller/listings').send({ ...draft, ...full, title: 'MRP lower than price', totalPrice: 50000, mrp: 40000 });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.fields?.mrp, JSON.stringify(bad.body));
    let L = await submitWith(a, { title: 'Laminate lot with honest MRP', totalPrice: 50000, mrp: 90000 });
    assert.equal(L.listing.status, 'active');
    const pub = (await request(app).get(`/api/listings/${L.no}`)).body.listing;
    assert.equal(pub.mrp, 90000);
    // An edit that would push the MRP to or below the price is refused.
    const lower = await a.patch(`/api/seller/listings/${L.id}`).send({ totalPrice: 95000 });
    assert.equal(lower.status, 400);
    L = await submitWith(a, { title: 'Laminate lot with inflated MRP', totalPrice: 10000, mrp: 60000 });
    assert.equal(L.listing.status, 'pending_review');
    assert.match(L.listing.reviewReasons.join(' '), /MRP/);
    assert.equal((await adminRow(L.id)).flags[0].code, 'mrp_check');
    const cleared = await a.post('/api/seller/listings').send({ ...draft, title: 'No MRP is fine', mrp: '' });
    assert.equal(cleared.status, 201);
    assert.equal(cleared.body.listing.mrp, null);
  });
  test('a photo reused from another seller is flagged, without telling the seller why', async () => {
    const original = await jpeg(1200, 900);
    const A = await submitWith(a, { title: 'Original photo lot' }, original);
    assert.equal(A.listing.status, 'active', JSON.stringify((await adminRow(A.id)).flags));
    // Seller B uploads the same photo, resized and recompressed.
    const copy = await sharp(original).resize(700).jpeg({ quality: 50 }).toBuffer();
    const B = await submitWith(b, { title: 'Copied photo lot' }, copy);
    assert.equal(B.listing.status, 'pending_review');
    assert.deepEqual(B.listing.reviewReasons, []); // fraud signal is not described to the seller
    const flag = (await adminRow(B.id)).flags.find((f) => f.code === 'duplicate_photo');
    assert.ok(flag); assert.match(flag.message, new RegExp(A.no));
    // The same seller reusing their own photo is fine.
    const A2 = await submitWith(a, { title: 'Second lot same photo' }, original);
    assert.equal(A2.listing.status, 'active', JSON.stringify((await adminRow(A2.id)).flags));
  });
  test('approving a flagged listing makes it live and clears the flags', async () => {
    const L = await submitWith(a, { title: 'Approve after check', description: 'WhatsApp 9845012345 for price.' });
    const r = await admin.post(`/api/admin/listings/${L.id}/approve`).send({});
    assert.equal(r.body.listing.status, 'active');
    assert.deepEqual(r.body.listing.flags, []);
    const log = await AdminAuditLog.findOne({ targetId: L.id, action: 'listing.approve' });
    assert.deepEqual(log.details.flagsCleared, ['contact_in_text']);
  });
  test('editing a live listing to add contact details takes it out of search until reviewed', async () => {
    const L = await submitWith(a, { title: 'Live then edited' });
    assert.equal(L.listing.status, 'active');
    const e = await a.patch(`/api/seller/listings/${L.id}`).send({ description: 'Now call me on +91 98450 22222 directly please.' });
    assert.equal(e.body.listing.status, 'pending_review');
    assert.equal((await request(app).get(`/api/listings/${L.no}`)).status, 404);
  });
  test('a seller with a recently removed listing has new listings checked by hand', async () => {
    const c = await registered(63);
    await verifyPhone(c); await c.patch('/api/seller/profile').send({ showContact: true });
    const first = await submitWith(c, { title: 'Soon removed lot' });
    await admin.post(`/api/admin/listings/${first.id}/remove`).send({ reason: 'Confirmed fake listing after buyer reports.' });
    const next = await submitWith(c, { title: 'Next lot after removal' });
    assert.equal(next.listing.status, 'pending_review');
    assert.equal((await adminRow(next.id)).flags[0].code, 'seller_removals');
  });
  test('manual mode sends every listing to review', async () => {
    await admin.patch('/api/admin/settings').send({ moderationMode: 'manual' });
    const L = await submitWith(a, { title: 'Manual mode lot' });
    assert.equal(L.listing.status, 'pending_review');
    await admin.patch('/api/admin/settings').send({ moderationMode: 'auto' });
  });
});
