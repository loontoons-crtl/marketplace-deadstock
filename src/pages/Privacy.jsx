import { Link } from 'react-router-dom';

export default function Privacy() {
  const reopenBanner = () => {
    window.dispatchEvent(new CustomEvent('open-cookie-banner'));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <p className="eyebrow text-muted">Legal &amp; Compliance</p>
      <h1 className="serif-title mt-2 text-4xl sm:text-5xl">Privacy &amp; Cookie Policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated: November 2026 · Deadstock Bengaluru</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink/90">
        <section>
          <h2 className="text-lg font-semibold text-ink">1. Overview</h2>
          <p className="mt-2">
            Deadstock Bengaluru (“we”, “our”, or “the platform”) values your privacy. This policy explains what information we collect, how it is used, how cookies operate on our platform, and your rights regarding your personal data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">2. Information We Collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Seller account information:</strong> When you register or list inventory, we collect your name, email address, password hash, seller type, and business details (e.g., GSTIN and business name, if provided).
            </li>
            <li>
              <strong>Mobile number &amp; OTP verification:</strong> To prevent fraud, sellers must verify their 10-digit Indian mobile number via OTP. Your phone number is only published on your listings if you explicitly opt in to show contact buttons.
            </li>
            <li>
              <strong>Google Sign-In:</strong> If you choose “Continue with Google”, we receive your name, email address, and Google profile ID solely to create and authenticate your account. We do not access your contacts, files, or any other Google account data.
            </li>
            <li>
              <strong>Listing content &amp; photos:</strong> Information about your building materials, including specs, price, condition, locality, and uploaded photos. Photos are processed and compressed for fast display.
            </li>
            <li>
              <strong>Buyer interactions:</strong> Buyers can browse anonymously without creating an account. When a buyer clicks “Call” or “WhatsApp”, we log anonymous click counts for seller analytics without storing buyer identities.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">3. Cookie &amp; Local Storage Policy</h2>
          <p className="mt-2">
            We believe in minimal, transparent data collection. We <strong>do not</strong> use third-party advertising cookies, marketing pixels, or cross-site tracking scripts.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-line bg-paper text-ink font-semibold">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-muted">
                <tr>
                  <td className="p-3 font-mono font-medium text-ink">ds.sid</td>
                  <td className="p-3">HTTP Cookie (Strict/Lax, Secure)</td>
                  <td className="p-3">Essential session token to keep logged-in sellers and admins securely authenticated.</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono font-medium text-ink">city</td>
                  <td className="p-3">Local Storage</td>
                  <td className="p-3">Saves your preferred city filter (e.g., Bengaluru) across page reloads.</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono font-medium text-ink">ds_cookie_consent</td>
                  <td className="p-3">Local Storage</td>
                  <td className="p-3">Remembers that you acknowledged our essential cookie banner.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            You can review or reset your cookie banner choice at any time by{' '}
            <button
              type="button"
              onClick={reopenBanner}
              className="font-medium text-forest underline hover:text-ink"
            >
              clicking here to open cookie preferences
            </button>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">4. How We Use and Share Information</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>We do not sell, rent, or trade your personal information to third parties.</li>
            <li>Information is used exclusively to operate the marketplace, authenticate accounts, verify listings, prevent scams, and communicate billing or renewal notices.</li>
            <li>Payments: If you subscribe to an annual storage plan, payment card and UPI transactions are processed directly by our payment gateway (Razorpay). We never store your card numbers or UPI PINs.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">5. Security Measures</h2>
          <p className="mt-2">We implement defense-in-depth security across our infrastructure:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Transport Encryption:</strong> All traffic is encrypted in transit over HTTPS (TLS 1.3) with HSTS headers enforced.</li>
            <li><strong>Password Protection:</strong> Passwords are cryptographically salted and hashed using bcrypt (12 rounds) and never stored in plain text.</li>
            <li><strong>Session Hardening:</strong> Session cookies are marked <code>HttpOnly</code>, <code>SameSite=Lax</code>, and <code>Secure</code> to prevent XSS and session hijacking.</li>
            <li><strong>CSRF &amp; Origin Protection:</strong> State-changing API requests strictly enforce origin validation to protect against Cross-Site Request Forgery.</li>
            <li><strong>Defensive HTTP Headers:</strong> Active Helmet security policies, including <code>X-Content-Type-Options: nosniff</code>, <code>X-Frame-Options: SAMEORIGIN</code>, and <code>Permissions-Policy</code>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">6. Your Rights &amp; Account Deletion</h2>
          <p className="mt-2">
            You have full control over your personal data:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Edit Profile:</strong> Update your name, business name, or contact visibility at any time in your <Link to="/dashboard/profile" className="underline hover:text-ink">Seller Profile</Link>.</li>
            <li><strong>Delete Account:</strong> You can permanently delete your account directly from your dashboard profile (Danger zone). Deleting your account immediately erases your profile, all your listings, and all stored photo files permanently.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">7. Contact &amp; Grievance Officer</h2>
          <p className="mt-2">
            For privacy inquiries or data requests, contact our grievance team at <span className="font-medium text-ink">hello@example.com</span>.
          </p>
          <div className="mt-4 flex gap-4 text-sm font-medium">
            <Link to="/terms" className="text-forest underline hover:text-ink">Terms &amp; conditions →</Link>
            <Link to="/refund-policy" className="text-forest underline hover:text-ink">Refund policy →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
