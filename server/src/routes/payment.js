import crypto from 'node:crypto';
import { Router } from 'express';
import Razorpay from 'razorpay';
import { config } from '../config.js';

const router = Router();

function getRazorpayInstance() {
  const key_id = config.razorpayKeyId;
  const key_secret = config.razorpayKeySecret;
  if (!key_id || !key_secret) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
}

const safeEqualHex = (a, b) => {
  if (!a || !b) return false;
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// STEP 1: Create Order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body || {};
    const parsedAmount = Number(amount);

    // Amount validation (minimum 100 paise = 1 INR)
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount < 100) {
      return res.status(400).json({
        error: 'Invalid amount. Minimum amount is 100 paise (₹1.00).',
      });
    }

    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      return res.status(401).json({
        error: 'Razorpay credentials not configured on the server.',
      });
    }

    const rzp = getRazorpayInstance();
    const orderOptions = {
      amount: Math.round(parsedAmount),
      currency: String(currency).toUpperCase(),
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    };

    const order = await rzp.orders.create(orderOptions);

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: config.razorpayKeyId, // public key for frontend checkout
    });
  } catch (err) {
    console.error('Razorpay create-order error:', err);
    if (err?.statusCode === 401 || err?.error?.code === 'BAD_REQUEST_ERROR' && err?.error?.description?.includes('Auth')) {
      return res.status(401).json({ error: 'Razorpay authentication failed.' });
    }
    return res.status(500).json({
      error: err?.error?.description || err.message || 'Failed to create Razorpay order.',
    });
  }
});

// STEP 3: Verify Payment Signature
router.post('/verify-payment', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id = razorpay_order_id,
      payment_id = razorpay_payment_id,
      signature = razorpay_signature,
    } = req.body || {};

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: order_id, payment_id, and signature are all required.',
      });
    }

    if (!config.razorpayKeySecret) {
      return res.status(500).json({
        success: false,
        error: 'Server missing Razorpay key secret.',
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    const isValid = safeEqualHex(expectedSignature, signature);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature. Verification failed.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      payment_id,
      order_id,
    });
  } catch (err) {
    console.error('Razorpay verify-payment error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error during signature verification.',
    });
  }
});

export default router;
