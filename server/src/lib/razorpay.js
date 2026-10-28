import crypto from 'node:crypto';
import { config } from '../config.js';

// Minimal Razorpay client: create an order, verify a checkout signature, verify a webhook signature.
// Uses the REST API directly (no SDK). The key secret never leaves the server.

const safeEqualHex = (a, b) => {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export const razorpay = {
  async createOrder({ amountPaise, receipt, notes }) {
    const auth = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Razorpay order failed: ${data?.error?.description || res.status}`);
    return data; // { id: 'order_…', amount, currency, status }
  },

  // Checkout success: Razorpay signs "order_id|payment_id" with the key secret.
  verifyCheckoutSignature(orderId, paymentId, signature) {
    if (!config.razorpayKeySecret || !orderId || !paymentId || !signature) return false;
    const expected = crypto.createHmac('sha256', config.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
    return safeEqualHex(expected, signature);
  },

  // Webhooks: Razorpay signs the raw request body with the webhook secret.
  verifyWebhookSignature(rawBody, signature) {
    if (!config.razorpayWebhookSecret || !signature) return false;
    const expected = crypto.createHmac('sha256', config.razorpayWebhookSecret).update(rawBody).digest('hex');
    return safeEqualHex(expected, signature);
  },
};
