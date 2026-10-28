import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api } from '../../lib/api.js';
import { bytes, dateIN, money, rupees } from '../../lib/format.js';
import { STATE_LABEL } from './Sellers.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch } from '../../lib/useFetch.js';
import StatusBadge from '../seller/StatusBadge.jsx';
import { dt, ReasonAction, Yes } from './ui.jsx';

function Verify({ kind, seller, onDone }) {
  const p = seller.profile;
  const verified = kind === 'identity' ? p.idVerified : p.bizVerified;
  const method = kind === 'identity' ? p.idMethod : p.bizMethod;
  const call = async (body) => { await api(`/admin/sellers/${seller._id}/verify`, { method: 'POST', body: { kind, ...body } }); onDone(); };
  return (
    <div className="rounded-md border border-line p-3">
      <p className="font-semibold capitalize">{kind}: <Yes ok={verified} yes="verified" no="not verified" /></p>
      {verified && method && <p className="text-muted">Checked by: {method}</p>}
      <div className="mt-2">
        {verified
          ? <ReasonAction label="Remove verification" min={5} prompt="Why? (recorded)" onSubmit={(why) => call({ verified: false, method: why })} />
          : <ReasonAction label={`Mark ${kind} verified`} tone="primary" min={5} prompt="How did you check? (recorded; don't type ID numbers)"
              placeholder={kind === 'identity' ? 'e.g. Video call 17 Oct, face and name matched photo ID' : `e.g. GSTIN ${p.gstin || '…'} active on GST portal, legal name matches`}
              onSubmit={(method) => call({ verified: true, method })} />}
      </div>
    </div>
  );
}

// Records an offline payment (UPI, bank transfer) or a deliberate free grant, and applies it.
function GrantForm({ sellerId, onDone }) {
  const { data } = useFetch('/admin/storage-products');
  const [f, setF] = useState({ productId: '', amountReceived: '', reference: '', note: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn btn-outline px-3 py-1.5" onClick={() => setOpen(true)}>Record offline payment</button>;
  const products = (data?.items || []).filter((p) => p.storageBytes > 0);
  const chosen = products.find((p) => p._id === f.productId);
  const save = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      await api(`/admin/sellers/${sellerId}/grant`, { method: 'POST', body: { productId: f.productId, amountReceived: Number(f.amountReceived || 0), reference: f.reference.trim(), note: f.note.trim() } });
      setOpen(false); onDone();
    } catch (e2) { setErr(e2.fields ? Object.values(e2.fields).join(' ') : e2.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="grid w-full gap-3 rounded-md border border-line bg-paper p-3 sm:grid-cols-2">
      <label><span className="mb-1 block font-medium">Plan or add-on</span><select className="field w-full" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value, amountReceived: '' })} required><option value="">Choose</option>{products.map((p) => <option key={p._id} value={p._id}>{p.kind === 'plan' ? 'Plan' : 'Add-on'}: {p.name} ({bytes(p.storageBytes)}, {rupees(p.annualPrice)}/yr){p.active ? '' : ' [off sale]'}</option>)}</select></label>
      <label><span className="mb-1 block font-medium">Amount received (₹)</span><input className="field w-full" inputMode="numeric" value={f.amountReceived} onChange={(e) => setF({ ...f, amountReceived: e.target.value.replace(/\D/g, '') })} placeholder={chosen ? `List price ${rupees(chosen.annualPrice)}; 0 for a free grant` : ''} required /></label>
      <label><span className="mb-1 block font-medium">Payment reference</span><input className="field w-full" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="UPI / bank reference" /></label>
      <label><span className="mb-1 block font-medium">Note (recorded)</span><input className="field w-full" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Paid by UPI at the godown" required minLength={5} /></label>
      <p className="text-xs text-muted sm:col-span-2">This activates the plan or add-on immediately and records the payment as offline. Add-ons need an active paid plan.</p>
      {err && <p className="rounded bg-red-50 p-2 text-red-800 sm:col-span-2" role="alert">{err}</p>}
      <div className="flex gap-2 sm:col-span-2"><button className="btn btn-primary px-3 py-1.5" disabled={busy}>{busy ? 'Saving…' : 'Record and activate'}</button><button type="button" className="btn btn-outline px-3 py-1.5" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

function SubscriptionPanel({ seller, sub, payments, onChange }) {
  const [recalc, setRecalc] = useState(null);
  const run = async () => { const r = await api(`/admin/sellers/${seller._id}/recalc-storage`, { method: 'POST' }); setRecalc(r); onChange(); };
  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-4">
      <h3 className="font-bold">Subscription and storage</h3>
      {sub.state === 'none' ? <p className="mt-1 text-muted">No subscription yet (trial starts when the phone is verified).</p> : (
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p>Status: <b>{STATE_LABEL[sub.state]}</b> · {sub.planName}</p>
          <p>{dateIN(sub.startsAt)} → {dateIN(sub.endsAt)}{sub.daysLeft ? ` (${sub.daysLeft} days left)` : ''}</p>
          <p>Storage: {bytes(sub.usedBytes)} of {bytes(sub.allowanceBytes)}</p>
          <p>Listings visible until {dateIN(sub.listingsVisibleUntil)}</p>
          {sub.addons.length > 0 && <p className="sm:col-span-2 text-muted">Add-ons: {sub.addons.map((a) => `${a.name} (${bytes(a.storageBytes)}, to ${dateIN(a.expiresAt)})`).join(' · ')}</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <GrantForm sellerId={seller._id} onDone={onChange} />
        {['trial', 'active'].includes(sub.state) && <ReasonAction label="End subscription now" tone="danger" prompt="Reason (recorded; the grace period then applies, nothing is deleted)" placeholder="e.g. Refunded at seller's request" onSubmit={async (reason) => { await api(`/admin/sellers/${seller._id}/end-subscription`, { method: 'POST', body: { reason } }); onChange(); }} />}
        <button className="btn btn-outline px-3 py-1.5" onClick={run}>Recalculate storage</button>
      </div>
      {recalc && <p className="mt-2 text-xs text-muted">Storage recalculated from {recalc.photos} photos: {bytes(recalc.before)} → {bytes(recalc.after)}.</p>}
      <h4 className="mt-4 font-semibold">Payments</h4>
      {payments.length === 0 ? <p className="text-muted">None.</p> : <ul className="mt-1 space-y-1">{payments.map((p) => <li key={p._id}>{dateIN(p.paidAt || p.createdAt)} · {rupees(p.amount)} · {p.item} · <b>{p.status}</b> · {p.method === 'manual' ? `offline${p.reference ? ` (${p.reference})` : ''}` : p.razorpayPaymentId || p.razorpayOrderId}</li>)}</ul>}
    </section>
  );
}

export default function AdminSellerDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const { data, error, reload } = useFetch(`/admin/sellers/${id}`);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { seller: s, listings, history, subscription, payments } = data;
  const p = s.profile || {};
  return (
    <div className="text-sm">
      <Link to="/admin/sellers" className="text-muted underline">← Sellers</Link>
      <h2 className="mt-3 text-2xl font-bold">{p.displayName || s.name}</h2>
      <p className="text-muted">{p.sellerType} · joined {dateIN(s.createdAt)} · last login {dateIN(s.lastLoginAt)}{s.role === 'admin' && ' · administrator'}</p>
      {s.status === 'suspended' && <p className="mt-3 rounded bg-red-50 p-3 text-red-800"><b>Suspended:</b> {s.suspendedReason}. Their listings are hidden from buyers.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-line bg-white p-4">
          <h3 className="font-bold">Account and profile</h3>
          <p>{s.name} · {s.email}</p>
          <p>{s.phone} · <Yes ok={s.phoneVerified} yes="verified by OTP" no="not verified" /> · shows phone on listings: <Yes ok={p.showContact} /></p>
          <p>Business name: {p.businessName || '—'} · GSTIN: {p.gstin || '—'}</p>
          <p>Locality: {p.locality || '—'}</p>
          {p.about && <p className="whitespace-pre-line text-muted">{p.about}</p>}
        </section>
        <section className="space-y-3 rounded-lg border border-line bg-white p-4">
          <h3 className="font-bold">Verification</h3>
          <p className="text-xs text-muted">Record how you checked. Don't store copies or numbers of ID documents.</p>
          <Verify kind="identity" seller={s} onDone={reload} />
          <Verify kind="business" seller={s} onDone={reload} />
        </section>
      </div>

      <SubscriptionPanel seller={s} sub={subscription} payments={payments} onChange={reload} />

      <section className="mt-6 rounded-lg border border-line bg-white p-4">
        <h3 className="font-bold">Account status</h3>
        <div className="mt-2">
          {s.status === 'active'
            ? (String(s._id) === String(me.id) || s.role === 'admin'
              ? <p className="text-muted">Administrators can't be suspended here.</p>
              : <ReasonAction label="Suspend account" tone="danger" prompt="Reason (recorded; hides all their listings and logs them out)" onSubmit={async (reason) => { await api(`/admin/sellers/${s._id}/suspend`, { method: 'POST', body: { reason } }); reload(); }} />)
            : <ReasonAction label="Lift suspension" tone="primary" min={5} prompt="Note (recorded)" onSubmit={async (note) => { await api(`/admin/sellers/${s._id}/unsuspend`, { method: 'POST', body: { note } }); reload(); }} />}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white p-4">
        <h3 className="font-bold">Listings ({listings.length})</h3>
        {listings.length === 0 ? <p className="text-muted">None yet.</p> : <ul className="mt-2 divide-y divide-line">{listings.map((l) => <li key={l._id} className="flex flex-wrap items-center gap-2 py-2"><StatusBadge status={l.status} /><Link to={`/admin/listings/${l._id}`} className="underline">{l.id} · {l.title}</Link><span className="text-muted">{money(l.totalPrice)} · {bytes(l.storageBytes)}</span></li>)}</ul>}
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white p-4">
        <h3 className="font-bold">Admin history</h3>
        {history.length === 0 ? <p className="text-muted">No admin actions yet.</p> : <ul className="mt-2 space-y-1">{history.map((h, i) => <li key={i}><span className="text-muted">{dt(h.at)}</span> · {h.admin}: <b>{h.action}</b>{(h.details?.reason || h.details?.method || h.details?.note) && ` — ${h.details.reason || h.details.method || h.details.note}`}</li>)}</ul>}
      </section>
    </div>
  );
}
