import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch } from '../../lib/useFetch.js';
import { bytes, dateIN } from '../../lib/format.js';

const tab = ({ isActive }) => `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-forest text-white' : 'text-ink hover:bg-ink/5'}`;

// One line about the subscription, shown on every dashboard page when something needs attention.
function PlanBanner({ b }) {
  if (!b) return null;
  const e = b.entitlement;
  const pct = e.allowanceBytes ? e.usedBytes / e.allowanceBytes : 0;
  let text = null; let tone = 'bg-amber-50 text-amber-900';
  if (e.state === 'none') text = <>Verify your mobile number to start your free {b.terms.trialDays}-day trial.</>;
  else if (e.state === 'trial') { text = <>Free trial: {e.daysLeft} day{e.daysLeft === 1 ? '' : 's'} left (ends {dateIN(e.endsAt)}).</>; tone = 'bg-forest/10 text-forest'; }
  else if (e.state === 'active' && e.daysLeft <= 30) text = <>Your plan ends on {dateIN(e.endsAt)}. Renew to keep listings visible.</>;
  else if (e.state === 'grace') { text = <>Your plan has ended. Listings are hidden from {dateIN(e.graceEndsAt)} unless you renew.</>; tone = 'bg-red-50 text-red-800'; }
  else if (e.state === 'expired') { text = <>Your plan has ended and your listings are hidden. Renew to show them again.</>; tone = 'bg-red-50 text-red-800'; }
  if (!text && pct >= 0.8) text = <>Storage {Math.round(pct * 100)}% used ({bytes(e.remainingBytes)} left).</>;
  if (!text) return null;
  return <p className={`mt-4 rounded-md p-3 text-sm ${tone}`}>{text} <Link to={e.state === 'none' ? '/dashboard/profile' : '/dashboard/subscription'} className="font-semibold underline">{e.state === 'none' ? 'Verify now' : 'Subscription and storage'}</Link></p>;
}

export default function SellerLayout() {
  const { user } = useAuth();
  const { data } = useFetch('/billing');
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm text-muted">Seller dashboard</p><h1 className="text-2xl font-bold">{user.profile?.displayName || user.name}</h1></div>
      </div>
      <PlanBanner b={data} />
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-line pb-2" aria-label="Seller dashboard">
        <NavLink to="/dashboard" end className={tab}>My listings</NavLink>
        <NavLink to="/dashboard/listings/new" className={tab}>Add listing</NavLink>
        <NavLink to="/dashboard/subscription" className={tab}>Subscription and storage</NavLink>
        <NavLink to="/dashboard/profile" className={tab}>Profile and verification</NavLink>
      </nav>
      <div className="mt-6"><Outlet /></div>
    </main>
  );
}
