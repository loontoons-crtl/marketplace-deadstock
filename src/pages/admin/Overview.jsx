import { Link } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { useFetch } from '../../lib/useFetch.js';
import { STATUS_LABEL, bytes, num, rupees } from '../../lib/format.js';

function Stat({ label, value, to, alert, raw }) {
  const body = (<><p className="text-sm text-muted">{label}</p><p className={`mt-1 text-3xl font-bold ${alert ? 'text-red-800' : ''}`}>{raw ?? num(value || 0)}</p></>);
  return to ? <Link to={to} className="rounded-lg border border-line bg-white p-4 hover:border-forest">{body}</Link> : <div className="rounded-lg border border-line bg-white p-4">{body}</div>;
}

export default function Overview() {
  const { data: d, error, reload } = useFetch('/admin/overview');
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!d) return <Loading />;
  const sc = d.statusCounts;
  const sub = d.subscriptions;
  return (
    <>
      <h2 className="text-lg font-bold">Needs attention</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Waiting for review" value={sc.pending_review} to="/admin/listings?status=pending_review" alert={sc.pending_review > 0} />
        <Stat label="Open reports" value={d.openReports} to="/admin/reports" alert={d.openReports > 0} />
        <Stat label="Live listings edited since approval" value={d.editedAfterApproval} to="/admin/listings?status=edited" alert={d.editedAfterApproval > 0} />
      </div>
      <h2 className="mt-8 text-lg font-bold">Subscriptions and revenue</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Paid plans active" value={sub.active} to="/admin/sellers" />
        <Stat label="On free trial" value={sub.trial} to="/admin/sellers" />
        <Stat label="Ended, in grace period" value={sub.grace} alert={sub.grace > 0} to="/admin/sellers" />
        <Stat label="Paid plans ending in 30 days" value={sub.expiringIn30d} />
        <Stat label="Revenue, last 30 days" raw={rupees(d.revenue.last30d)} to="/admin/payments?status=paid" />
        <Stat label="Revenue, all time" raw={rupees(d.revenue.total)} to="/admin/payments?status=paid" />
        <Stat label="Ended, listings hidden" value={sub.expired} />
        <Stat label="Photo storage in use" raw={bytes(d.storageUsedBytes)} />
      </div>
      <h2 className="mt-8 text-lg font-bold">Marketplace</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live listings" value={d.liveListings} to="/admin/listings?status=active" />
        <Stat label="Seller accounts" value={d.sellers} to="/admin/sellers" />
        <Stat label="Listings created (30 days)" value={d.listingsCreated30d} />
        <Stat label="Call / WhatsApp taps (30 days)" value={d.contactClicks30d} />
      </div>
      <h2 className="mt-8 text-lg font-bold">All listings by status</h2>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {['draft', 'pending_review', 'active', 'reserved', 'unavailable', 'sold', 'rejected', 'removed'].map((k) => <li key={k}><Link to={`/admin/listings?status=${k}`} className="inline-block rounded border border-line bg-white px-3 py-1.5 hover:border-forest">{STATUS_LABEL[k]}: <b>{num(sc[k] || 0)}</b></Link></li>)}
      </ul>
      <p className="mt-6 text-xs text-muted">{d.note}</p>
    </>
  );
}
