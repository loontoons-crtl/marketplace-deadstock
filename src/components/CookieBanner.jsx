import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'ds_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        // Show after a brief delay so page loads smoothly
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // If localStorage is unavailable, do nothing
    }
  }, []);

  // Allow re-opening the banner from the footer via a custom event
  useEffect(() => {
    const handleReopen = () => setVisible(true);
    window.addEventListener('open-cookie-banner', handleReopen);
    return () => window.removeEventListener('open-cookie-banner', handleReopen);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ acceptedAt: new Date().toISOString(), essential: true }));
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-4 rounded-xl border border-line bg-paper/95 p-4 shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:p-5">
        <div className="text-sm leading-relaxed text-ink/90">
          <p className="font-semibold text-ink">Essential cookies &amp; privacy</p>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            We use only essential cookies to maintain your secure login session and remember your city preference. We do not use third-party advertising or cross-site tracking cookies.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            to="/privacy"
            onClick={() => setVisible(false)}
            className="text-xs font-medium text-muted hover:text-ink underline sm:text-sm"
          >
            Privacy policy
          </Link>
          <button
            type="button"
            onClick={accept}
            className="btn btn-primary rounded-full px-5 py-2 text-xs font-semibold sm:text-sm"
          >
            Accept essential
          </button>
        </div>
      </div>
    </aside>
  );
}
