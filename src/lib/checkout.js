import { api } from './api.js';

// Loads Razorpay's checkout script once (from Razorpay's own domain).
let loading = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = resolve;
      s.onerror = () => { loading = null; reject(new Error('Could not load the payment window. Check your connection and try again.')); };
      document.body.appendChild(s);
    });
  }
  return loading;
}

// Opens Razorpay checkout for a server-created order. Resolves after OUR server has verified the payment.
// Resolves { status: 'paid', billing } | { status: 'dismissed' }; rejects on failure.
export async function payWithRazorpay(body) {
  const order = await api('/billing/checkout', { method: 'POST', body });
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: order.name,
      description: order.description,
      prefill: order.prefill,
      theme: { color: '#2F4A3A' },
      handler: async (resp) => {
        try {
          const v = await api('/billing/verify', { method: 'POST', body: resp });
          resolve({ status: 'paid', billing: v.billing });
        } catch (e) { reject(e); }
      },
      modal: { ondismiss: () => resolve({ status: 'dismissed' }) },
    });
    rz.on('payment.failed', (resp) => {
      api(`/billing/payments/${order.paymentId}/failed`, { method: 'POST', body: { reason: resp?.error?.description || 'Payment failed' } }).catch(() => {});
    });
    rz.open();
  });
}
