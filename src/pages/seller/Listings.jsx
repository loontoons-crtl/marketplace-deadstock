import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { bytes, dateIN, money } from '../../lib/format.js';
import { plural } from '../../lib/format.js';
import StatusBadge from './StatusBadge.jsx';

// Mirrors the server's rules; the server still decides.
const AVAIL = { active: ['reserved', 'sold', 'unavailable'], reserved: ['active', 'sold', 'unavailable'], unavailable: ['active', 'sold'] };
const AVAIL_LABEL = { active: 'Mark available', reserved: 'Mark reserved', sold: 'Mark sold', unavailable: 'Pause' };
const DELETABLE = ['draft', 'pending_review', 'active', 'reserved', 'sold', 'unavailable', 'rejected'];

function Checklist({ user, listings }) {
  const steps = [
    { done: user.phoneVerified, text: 'Verify your mobile number', to: '/dashboard/profile' },
    { done: user.profile?.showContact, text: 'Allow buyers to see your verified number', to: '/dashboard/profile' },
    { done: listings.length > 0, text: 'Create your first listing', to: '/dashboard/listings/new' },
    { done: listings.some((l) => l.status !== 'draft'), text: 'Submit a listing', to: null },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <section className="mb-8 rounded-lg border border-line bg-white p-5">
      <h2 className="text-lg font-bold">Getting started</h2>
      <ol className="mt-3 space-y-2 text-sm">
        {steps.map((s) => (
          <li key={s.text} className="flex items-center gap-2">
            <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${s.done ? 'bg-forest text-white' : 'border border-line'}`}>{s.done ? '✓' : ''}</span>
            {s.to && !s.done ? <Link to={s.to} className="underline">{s.text}</Link> : <span className={s.done ? 'text-muted line-through' : ''}>{s.text}</span>}
            <span className="sr-only">{s.done ? '(done)' : '(to do)'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ l, onChange, onRemove }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const act = async (fn) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const submit = () => act(async () => onChange((await api(`/seller/listings/${l._id}/submit`, { method: 'POST' })).listing));
  const avail = (status) => act(async () => onChange((await api(`/seller/listings/${l._id}/availability`, { method: 'POST', body: { status } })).listing));
  const del = () => act(async () => { await api(`/seller/listings/${l._id}`, { method: 'DELETE' }); onRemove(l._id); });
  const editable = !['sold', 'expired', 'removed'].includes(l.status);
  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {l.images?.[0] ? <img src={l.images[0].thumb || l.images[0].url} alt="" className="h-16 w-20 shrink-0 rounded object-cover" /> : <div className="grid h-16 w-20 shrink-0 place-items-center rounded border border-dashed border-line text-[11px] text-muted">No photo</div>}
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={l.status} /><span className="text-xs text-muted">{l.id} · {l.categoryName}</span></div>
          <p className="mt-1 font-semibold">{l.title}</p>
          <p className="text-sm text-muted">{money(l.totalPrice)} · {l.unit === 'lot' ? 'Stock lot' : `${l.quantity} ${l.unit}`} · {l.locality}</p>
          {l.status === 'rejected' && l.rejectionReason && <p className="mt-1 text-sm text-red-800">Reason: {l.rejectionReason}</p>}
          {l.status === 'pending_review' && (l.reviewReasons?.length
            ? <div className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-950"><p className="font-semibold">Waiting for a quick check by our team. To speed it up, edit the listing:</p><ul className="list-disc pl-4">{l.reviewReasons.map((m) => <li key={m}>{m}</li>)}</ul></div>
            : <p className="mt-1 text-xs text-muted">Submitted {dateIN(l.submittedAt)}. Our team is giving it a quick check before it goes live, usually within one working day.</p>)}
          <p className="mt-1 text-xs text-muted">{plural(l.images?.length || 0, 'photo')} · {bytes(l.storageBytes || 0)}</p>
          {l.status === 'removed' && <p className="mt-1 text-sm text-red-800">Removed by our team{l.removedReason ? `: ${l.removedReason}` : '.'} Contact support if you think this is a mistake.</p>}
          </div>
        </div>
        <div className="text-right text-xs text-muted">
          <p>{l.views} views</p><p>{l.contactClicks.call} calls · {l.contactClicks.whatsapp} WhatsApp</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {editable && <Link to={`/dashboard/listings/${l._id}/edit`} className="btn btn-outline px-3 py-1.5">Edit</Link>}
        {['draft', 'rejected'].includes(l.status) && <button className="btn btn-primary px-3 py-1.5" onClick={submit} disabled={busy}>Submit</button>}
        {(AVAIL[l.status] || []).map((s) => <button key={s} className="btn btn-outline px-3 py-1.5" onClick={() => avail(s)} disabled={busy}>{AVAIL_LABEL[s]}</button>)}
        {DELETABLE.includes(l.status) && (confirmDel
          ? <><button className="btn px-3 py-1.5 bg-red-700 text-white" onClick={del} disabled={busy}>Confirm delete</button><button className="btn btn-outline px-3 py-1.5" onClick={() => setConfirmDel(false)}>Cancel</button></>
          : <button className="btn px-3 py-1.5 text-red-800 hover:bg-red-50" onClick={() => setConfirmDel(true)}>Delete</button>)}
      </div>
      {err && <p className="mt-2 text-sm text-red-800" role="alert">{err} {/phone|Allow buyers/.test(err) && <Link to="/dashboard/profile" className="underline">Open profile</Link>}{/subscription|Renew/.test(err) && <Link to="/dashboard/subscription" className="underline">Subscription</Link>}</p>}
    </li>
  );
}

export default function SellerListings() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = () => { setError(null); api('/seller/listings').then((d) => setItems(d.items)).catch((e) => setError(e.message)); };
  useEffect(load, []);
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!items) return <Loading />;
  const replace = (nl) => setItems((xs) => xs.map((x) => (x._id === nl._id ? nl : x)));
  const remove = (id) => setItems((xs) => xs.filter((x) => x._id !== id));
  return (
    <>
      <Checklist user={user} listings={items} />
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">My listings ({items.length})</h2><Link to="/dashboard/listings/new" className="btn btn-primary">Add listing</Link></div>
      {items.length === 0
        ? <div className="mt-4 rounded-lg border border-dashed border-line p-10 text-center"><p className="font-semibold">No listings yet</p><p className="mt-1 text-sm text-muted">Start with a draft. Listings are free to add within your storage.</p></div>
        : <ul className="mt-4 space-y-3">{items.map((l) => <Row key={l._id} l={l} onChange={replace} onRemove={remove} />)}</ul>}
      <p className="mt-6 text-xs text-muted">No fee per listing. Submitted listings are checked automatically and go live straight away; a few are held for a quick check by our team. Listings stay live while your plan is active.</p>
    </>
  );
}
