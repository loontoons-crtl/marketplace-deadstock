import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api } from '../../lib/api.js';
import { bytes, dateIN, money, num } from '../../lib/format.js';
import { useFetch } from '../../lib/useFetch.js';
import StatusBadge from '../seller/StatusBadge.jsx';
import { dt, ReasonAction, Yes } from './ui.jsx';

export default function AdminListingDetail() {
  const { id } = useParams();
  const { data, error, reload } = useFetch(`/admin/listings/${id}`);
  const [view, setView] = useState(0);
  const [msg, setMsg] = useState(null);
  const [actionErr, setActionErr] = useState(null);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { listing: l, reports, history } = data;
  const act = (path, body, done) => async (text) => {
    setMsg(null); setActionErr(null);
    await api(`/admin/listings/${l._id}/${path}`, { method: 'POST', body: body(text) });
    setMsg(done); reload();
  };
  const simple = async (path, done) => {
    setMsg(null); setActionErr(null);
    try { await api(`/admin/listings/${l._id}/${path}`, { method: 'POST', body: {} }); setMsg(done); reload(); } catch (e) { setActionErr(e.message); }
  };
  const s = l.seller || {};
  return (
    <div>
      <Link to="/admin/listings" className="text-sm text-muted underline">← Listings</Link>
      <div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge status={l.status} /><span className="text-sm text-muted">{l.id} · {l.category}{l.subcategory && ` › ${l.subcategory}`}</span>{l.isSample && <span className="rounded bg-line px-1.5 text-xs">sample</span>}</div>
      <h2 className="mt-1 text-2xl font-bold">{l.title}</h2>
      {msg && <p className="mt-3 rounded bg-forest/10 p-2 text-sm text-forest" role="status">{msg}</p>}
      {actionErr && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800" role="alert">{actionErr}</p>}

      <section className="mt-4 flex flex-wrap gap-2 rounded-lg border border-line bg-white p-4">
        <p className="w-full text-sm font-semibold">Actions</p>
        {l.status === 'pending_review' && <>
          <button className="btn btn-primary px-3 py-1.5" onClick={() => simple('approve', 'Approved and live.')}>Approve and publish</button>
          <ReasonAction label="Reject" prompt="Reason (the seller sees this)" placeholder="e.g. Photos show a different product. Add photos of the actual stock." onSubmit={act('reject', (reason) => ({ reason }), 'Rejected. The seller can fix and resubmit.')} />
        </>}
        {l.editedAfterApprovalAt && <button className="btn btn-outline px-3 py-1.5" onClick={() => simple('clear-edit-flag', 'Marked as re-checked.')}>Re-checked edits: OK</button>}
        {!['removed', 'draft'].includes(l.status) && <ReasonAction label="Remove listing" tone="danger" prompt="Reason (the seller sees this)" placeholder="e.g. Prohibited item / confirmed fraudulent listing" onSubmit={act('remove', (reason) => ({ reason }), 'Listing removed.')} />}
        {['draft', 'removed', 'sold', 'expired', 'rejected'].includes(l.status) && <p className="text-sm text-muted">No moderation actions for a {l.status} listing.</p>}
      </section>

      {l.flags?.length > 0 && (
        <section className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Flagged by the automatic checks{l.checkedAt && ` (${dateIN(l.checkedAt)})`}</p>
          <ul className="mt-1 list-disc pl-5">{l.flags.map((f, i) => <li key={i}>{f.message} {!f.sellerVisible && <span className="text-xs">(not shown to the seller)</span>}</li>)}</ul>
        </section>
      )}
      {l.rejectionReason && <p className="mt-3 text-sm"><b>Rejection reason:</b> {l.rejectionReason}</p>}
      {l.removedReason && <p className="mt-3 text-sm text-red-800"><b>Removed:</b> {l.removedReason}</p>}
      {l.editedAfterApprovalAt && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900">The seller edited this listing on {dt(l.editedAfterApprovalAt)} after it was approved. Check the photos and details still match.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          {l.images.length ? <>
            <img src={l.images[view]?.url} alt={`Photo ${view + 1}`} className="aspect-[4/3] w-full rounded-lg bg-line object-contain" />
            <div className="mt-2 flex gap-2 overflow-x-auto">{l.images.map((img, i) => <button key={img.url} onClick={() => setView(i)} aria-label={`Photo ${i + 1}`} className={`w-16 shrink-0 overflow-hidden rounded border-2 ${view === i ? 'border-forest' : 'border-transparent'}`}><img src={img.thumb} alt="" className="aspect-square w-full object-cover" /></button>)}</div>
          </> : <p className="rounded-lg border border-dashed border-line p-8 text-center text-muted">No photos</p>}
          <h3 className="mt-6 font-bold">Description</h3>
          <p className="mt-1 whitespace-pre-line text-sm">{l.description || '—'}</p>
          <dl className="mt-4 divide-y divide-line rounded-lg border border-line bg-white text-sm">
            {[['Price', `${money(l.totalPrice)} total`], ['Quantity', l.unit === 'lot' ? 'Stock lot' : `${num(l.quantity)} ${l.unit}`], ['Condition', l.condition], ['Brand / model', [l.brand, l.model].filter(Boolean).join(' · ') || '—'], ['Locality', `${l.locality}, ${l.city}`], ['Pickup', l.pickupDetails || '—'], ...Object.entries(l.specs)].map(([k, v]) => <div key={k} className="grid grid-cols-[130px_1fr] gap-2 px-3 py-2"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
        <div className="space-y-4 text-sm">
          <section className="rounded-lg border border-line bg-white p-4">
            <h3 className="font-bold">Seller</h3>
            <p className="mt-1"><Link to={`/admin/sellers/${s._id}`} className="font-semibold underline">{s.displayName}</Link> ({s.sellerType})</p>
            <p className="text-muted">{s.name} · {s.email} · {s.phone}</p>
            <p className="mt-2">Phone verified: <Yes ok={s.phoneVerified} /> · Shows phone: <Yes ok={s.showContact} /></p>
            <p>Identity: <Yes ok={s.idVerified} yes="verified" no="not verified" /> · Business: <Yes ok={s.bizVerified} yes="verified" no="not verified" /></p>
            {s.status === 'suspended' && <p className="mt-1 font-semibold text-red-800">Account suspended</p>}
          </section>
          <section className="rounded-lg border border-line bg-white p-4">
            <h3 className="font-bold">Timeline</h3>
            <p>Created {dateIN(l.createdAt)} · submitted {dateIN(l.submittedAt)} · reviewed {dateIN(l.reviewedAt)}</p>
            {l.activatedAt && <p>Live since {dateIN(l.activatedAt)}{l.autoPublished ? ' (published without review)' : ''}. Visible while the seller's plan lasts{l.sellerAccessUntil ? `, currently until ${dateIN(l.sellerAccessUntil)}` : ''}.</p>}
            <p className="text-muted">Photos use {bytes(l.storageBytes)} of the seller's storage.</p>
            <p className="mt-1 text-muted">{l.views} views · {l.contactClicks.call} calls · {l.contactClicks.whatsapp} WhatsApp</p>
          </section>
          <section className="rounded-lg border border-line bg-white p-4">
            <h3 className="font-bold">Reports ({reports.length})</h3>
            {reports.length === 0 ? <p className="text-muted">None.</p> : <ul className="mt-2 space-y-2">{reports.map((r) => <li key={r._id} className="border-t border-line pt-2 first:border-0 first:pt-0"><b>{r.reason}</b> <span className="text-muted">· {r.status} · {dt(r.createdAt)}</span>{r.details && <p>{r.details}</p>}{r.contact && <p className="text-muted">Reporter: {r.contact}</p>}{r.resolutionNote && <p className="text-muted">Resolution: {r.resolutionNote}</p>}</li>)}</ul>}
            {reports.some((r) => r.status === 'open') && <Link to="/admin/reports" className="mt-2 inline-block underline">Resolve in Reports</Link>}
          </section>
          <section className="rounded-lg border border-line bg-white p-4">
            <h3 className="font-bold">Admin history</h3>
            {history.length === 0 ? <p className="text-muted">No admin actions yet.</p> : <ul className="mt-2 space-y-1">{history.map((h, i) => <li key={i}><span className="text-muted">{dt(h.at)}</span> · {h.admin}: <b>{h.action}</b>{(h.details?.reason || h.details?.note) && ` — ${h.details.reason || h.details.note}`}</li>)}</ul>}
          </section>
        </div>
      </div>
    </div>
  );
}
