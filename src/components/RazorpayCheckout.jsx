import { useState } from 'react';

/**
 * Razorpay Standard Web Checkout Button Component
 *
 * Implements:
 * 1. POST /api/create-order to initiate order
 * 2. Razorpay modal popup via checkout.js
 * 3. POST /api/verify-payment to verify signature HMAC-SHA256
 */
export default function RazorpayCheckout({
  amount = 100, // In Rupees (e.g., 100 = ₹100.00, converted to 10000 paise)
  currency = 'INR',
  name = 'Deadstock Bengaluru',
  description = 'Marketplace Payment',
  receipt = `rcpt_${Date.now()}`,
  prefill = { name: '', email: '', contact: '' },
  onSuccess = () => {},
  onError = () => {},
  onDismiss = () => {},
  buttonText = 'Pay with Razorpay',
  className = 'btn-primary',
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handlePayment = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // Amount in paise (minimum 100 paise = ₹1)
      const amountInPaise = Math.round(Number(amount) * 100);
      if (amountInPaise < 100) {
        throw new Error('Minimum payment amount is ₹1.00 (100 paise)');
      }

      // STEP 1: Call backend create-order endpoint
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt,
        }),
      });

      const orderData = await res.json();
      if (!res.ok) {
        throw new Error(orderData.error || 'Failed to create Razorpay order');
      }

      const keyId = orderData.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!keyId) {
        throw new Error('Razorpay Key ID is not configured.');
      }

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // STEP 2: Configure Razorpay Checkout options
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name,
        description,
        order_id: orderData.order_id,
        prefill: {
          name: prefill.name || '',
          email: prefill.email || '',
          contact: prefill.contact || '',
        },
        theme: {
          color: '#2F4A3A', // Deadstock Forest Green
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            onDismiss();
          },
        },
        handler: async (response) => {
          try {
            // STEP 3: Verify payment signature on backend
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment signature verification failed');
            }

            setSuccessMsg(`Payment successful! Payment ID: ${response.razorpay_payment_id}`);
            onSuccess({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
          } catch (verifyErr) {
            setErrorMsg(verifyErr.message);
            onError(verifyErr);
          } finally {
            setLoading(false);
          }
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', (failedResp) => {
        setLoading(false);
        const desc = failedResp?.error?.description || 'Payment was declined or failed';
        setErrorMsg(desc);
        onError(failedResp?.error || new Error(desc));
      });

      razorpayInstance.open();
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message);
      onError(err);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading || disabled}
        className={className}
      >
        {loading ? 'Opening Razorpay...' : buttonText}
      </button>

      {errorMsg && (
        <p className="mt-1 text-xs text-red-600 font-medium" role="alert">
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <p className="mt-1 text-xs text-emerald-700 font-medium">
          {successMsg}
        </p>
      )}
    </div>
  );
}
