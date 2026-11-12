import { Link } from 'react-router-dom';

export default function RefundPolicy() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <p className="eyebrow text-muted">Billing &amp; Support</p>
      <h1 className="serif-title mt-2 text-4xl sm:text-5xl">Refund &amp; cancellation policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated: November 2026 · Deadstock Bengaluru</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink/90">
        <section>
          <h2 className="text-lg font-semibold text-ink">1. Annual storage subscriptions</h2>
          <p className="mt-2">
            Sellers pay an annual subscription fee for photo storage capacity on Deadstock Bengaluru. Plans do <strong>not</strong> auto-renew—you will never be charged unexpectedly at the end of a billing year.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              <strong>7-day refund window:</strong> If you purchase a new annual plan and have not yet published live listings or used storage under the paid plan, you may request a full refund within 7 days of payment.
            </li>
            <li>
              <strong>Duplicate or failed charges:</strong> Any accidental duplicate payment or technical billing error verified via Razorpay or bank records will be refunded in full within 5–7 business days to the original payment method.
            </li>
            <li>
              <strong>Partial-year cancellations:</strong> After the 7-day window or once storage has been actively used, annual plans and prorated extra-storage add-ons are non-refundable, though your listings remain active until the end of the paid term.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">2. Account suspension &amp; policy violations</h2>
          <p className="mt-2">
            Accounts suspended for repeated policy violations (such as uploading counterfeit stock, misleading listings, or bypassing moderation checks) are not eligible for subscription refunds.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">3. Material purchases between buyers &amp; sellers</h2>
          <p className="mt-2">
            Deadstock Bengaluru does not collect, hold, or process payments for building materials bought or sold through the site. All material pricing, deposits, returns, exchanges, or refunds are governed directly by the agreement between the buyer and the seller.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">4. Requesting a refund</h2>
          <p className="mt-2">
            To request a subscription refund or report a billing issue, email <span className="font-medium text-ink">hello@example.com</span> with your registered email/mobile number and Razorpay Payment ID or UPI reference number. Approved refunds are processed within 5–7 business days.
          </p>
          <p className="mt-4">
            <Link to="/terms" className="font-medium text-forest underline">Read Terms &amp; conditions →</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
