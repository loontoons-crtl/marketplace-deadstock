import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <p className="eyebrow text-muted">Legal</p>
      <h1 className="serif-title mt-2 text-4xl sm:text-5xl">Terms &amp; conditions</h1>
      <p className="mt-3 text-sm text-muted">Last updated: November 2026 · Deadstock Bengaluru</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink/90">
        <section>
          <h2 className="text-lg font-semibold text-ink">1. About the platform</h2>
          <p className="mt-2">
            Deadstock Bengaluru is an online listing marketplace connecting buyers with dealers, manufacturers, retailers, and contractors offering surplus, overstock, or discontinued building materials in and around Bengaluru.
          </p>
          <p className="mt-2">
            We do not buy, sell, inspect, store, or deliver any listed materials, and we do not charge commissions on sales. All negotiations, inspections, payments for goods, and deliveries occur directly between the buyer and the seller.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">2. Seller accounts &amp; verification</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Sellers must provide accurate contact and business details, including a valid Indian mobile number verified via OTP before publishing listings.</li>
            <li>You are responsible for keeping your account credentials secure and for all activity under your account.</li>
            <li>Verification badges (Phone, ID, Business/GST) reflect checks performed at the time of verification and do not constitute an endorsement or warranty of any seller’s inventory.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">3. Listing rules &amp; moderation</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Listings must represent real, available physical stock with honest descriptions, quantities, condition grades, and original photographs of the actual material.</li>
            <li>Do not include phone numbers, email addresses, external website links, or prohibited keywords inside listing titles or descriptions.</li>
            <li>Do not reuse photographs belonging to other sellers or upload misleading stock imagery.</li>
            <li>Listings may be automatically held for manual review, rejected, or removed if they violate these rules or receive verified user reports.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">4. Annual storage subscriptions</h2>
          <p className="mt-2">
            New verified sellers receive a free trial (30 days, 100 MB photo storage). Continued publishing requires an active annual storage plan. Subscriptions do not auto-renew. If a plan expires, listings remain visible during a 15-day grace period, after which they are hidden from buyers until renewed. Data and photos are retained for 180 days after expiry.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">5. Limitation of liability</h2>
          <p className="mt-2">
            Deadstock Bengaluru provides the platform on an “as is” basis. Buyers are strongly advised to inspect materials in person before making payment. We are not liable for the quality, authenticity, safety, legality, or availability of listed materials, nor for any loss or dispute arising between buyers and sellers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">6. Governing law &amp; contact</h2>
          <p className="mt-2">
            These terms are governed by the laws of India, with exclusive jurisdiction in the courts of Bengaluru, Karnataka. For questions or takedown requests, write to <span className="font-medium text-ink">hello@example.com</span> or use the <Link to="/refund-policy" className="font-medium text-forest underline">Refund policy</Link> page for billing queries.
          </p>
        </section>
      </div>
    </main>
  );
}
