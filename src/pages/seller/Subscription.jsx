import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api } from '../../lib/api.js';
import { payWithRazorpay } from '../../lib/checkout.js';
import { approxPhotos, bytes, dateIN, num, rupees } from '../../lib/format.js';
import { plural } from '../../lib/format.js';
import { useFetch } from '../../lib/useFetch.js';

const STATE = {
  none: ['Not started', 'bg-line text-ink'],
  trial: ['Free trial', 'bg-amber-100 text-amber-900'],
  active: ['Active', 'bg-forest text-white'],
  grace: ['Ended: grace period', 'bg-red-100 text-red-800'],
  expired: ['Ended: listings hidden', 'bg-red-800 text-white'],
};

function UsageBar({ used, total }) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const tone = pct >= 95 ? 'bg-red-700' : pct >= 80 ? 'bg-amber-500' : 'bg-forest';
  return (
    <div>
      <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
        <div className={`h-full ${tone}`} style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{pct}% used</p>
    </div>
  );
}

// Shows the server's price quote for an option and runs the payment.
function Buy({ body, label, enabled, onPaid }) {
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const loadQuote = async () => {
    setErr(null); setMsg(null); setBusy(true);
    try { setQuote(await api('/billing/quote', { method: 'POST', body })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const pay = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await payWithRazorpay(body);
      if (r.status === 'paid') { setMsg('Payment confirmed.'); setQuote(null); onPaid(r.billing); }
      else setMsg('Payment window closed. Nothing was charged.');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  if (!quote) return (
    <div><button className="btn btn-primary px-3 py-1.5" onClick={loadQuote} disabled={busy}>{busy ? 'Working out the price…' : label}</button>
      {err && <p className="mt-2 text-sm text-red-800" role="alert">{err}</p>}{msg && <p className="mt-2 text-sm text-forest" role="status">{msg}</p>}</div>
  );
  const s = quote.summary;
  return (
    <div className="rounded-md border border-forest bg-paper p-3 text-sm">
      <p className="font-semibold">{s.plan || s.addon}: {s.storage}</p>
      {s.plan && <p>Plan {rupees(s.planPrice)}{s.addonsPrice ? ` + add-on storage ${rupees(s.addonsPrice)}` : ''}. Runs {dateIN(s.periodStart)} to {dateIN(s.periodEnd)}.</p>}
      {s.addon && <p>Until {dateIN(s.periodEnd)} ({s.days} days).</p>}
      <p className="text-muted">{s.note}</p>
      <p className="mt-2 text-lg font-bold">To pay: {rupees(quote.amount)}</p>
      {enabled
        ? <div className="mt-2 flex gap-2"><button className="btn btn-primary px-3 py-1.5" onClick={pay} disabled={busy}>{busy ? 'Waiting for payment…' : `Pay ${rupees(quote.amount)}`}</button><button className="btn btn-outline px-3 py-1.5" onClick={() => setQuote(null)} disabled={busy}>Cancel</button></div>
        : <p className="mt-2 rounded bg-amber-50 p-2 text-amber-900">Online payment isn't switched on yet. Contact us to pay by UPI or bank transfer and we'll activate it.</p>}
      {err && <p className="mt-2 text-red-800" role="alert">{err}</p>}
    </div>
  );
}

export default function Subscription() {
  const { data: b, error, reload, setData } = useFetch('/billing');
  const [keep, setKeep] = useState(null);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!b) return <Loading />;
  const e = b.entitlement;
  const [label, tone] = STATE[e.state];
  const paid = e.state !== 'none' && e.kind === 'paid';
  const pct = e.allowanceBytes ? (e.usedBytes / e.allowanceBytes) * 100 : 0;
  const liveAddons = b.addonsOwned.filter((a) => new Date(a.expiresAt) > new Date());
  const keepIds = keep ?? liveAddons.map((a) => a._id);
  const onPaid = (billing) => { if (billing) setData(billing); else reload(); };
  const t = b.terms;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">Your plan</h2><span className={`rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span></div>
          {e.state === 'none' ? (
            <p className="mt-2 text-sm">Verify your mobile number to start your free {t.trialDays}-day trial. <Link to="/dashboard/profile" className="font-semibold underline">Verify now</Link></p>
          ) : (
            <dl className="mt-3 grid grid-cols-[130px_1fr] gap-y-1 text-sm">
              <dt className="text-muted">Plan</dt><dd>{e.planName}</dd>
              <dt className="text-muted">Started</dt><dd>{dateIN(e.startsAt)}</dd>
              <dt className="text-muted">{e.state === 'trial' || e.state === 'active' ? 'Ends' : 'Ended'}</dt><dd>{dateIN(e.endsAt)}{e.daysLeft ? ` (${e.daysLeft} days left)` : ''}</dd>
              {(e.state === 'grace' || e.state === 'expired') && <><dt className="text-muted">Listings</dt><dd className="text-red-800">{e.state === 'grace' ? `Visible until ${dateIN(e.graceEndsAt)}, then hidden` : `Hidden since ${dateIN(e.graceEndsAt)}. Kept until ${dateIN(e.retentionUntil)}.`}</dd></>}
            </dl>
          )}
          {e.state === 'trial' && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900">Choose a plan before {dateIN(e.endsAt)} to keep your listings visible without a break.</p>}
          {(e.state === 'grace' || e.state === 'expired') && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">You can't add photos or publish listings until you renew. Nothing has been deleted.</p>}
        </div>

        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Storage</h2>
          <p className="mt-2 text-2xl font-bold">{bytes(e.usedBytes)} <span className="text-base font-normal text-muted">of {bytes(e.allowanceBytes)} used</span></p>
          <div className="mt-2"><UsageBar used={e.usedBytes} total={e.allowanceBytes} /></div>
          <p className="mt-2 text-sm">{bytes(e.remainingBytes)} left, roughly {num(approxPhotos(e.remainingBytes, b.counts.avgPhotoBytes))} more photos{b.counts.avgPhotoBytes ? ` at your average of ${bytes(b.counts.avgPhotoBytes)} each` : ''}.</p>
          {pct >= 95 ? <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-800">Storage is full or nearly full. Add storage, or delete photos or listings you no longer need.</p>
            : pct >= 80 ? <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900">Storage is over 80% used.</p> : null}
          <p className="mt-3 text-sm text-muted">{plural(b.counts.liveListings, 'live listing')} · {plural(b.counts.totalListings, 'listing')} in total · {plural(b.counts.photos, 'photo')}. There is no limit on the number of listings.</p>
        </div>
      </section>

      {e.state !== 'none' && (
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">{paid ? 'Renew your plan' : 'Choose a plan'}</h2>
          <p className="mt-1 text-sm text-muted">Annual plans. List as many products as your storage allows; no fee per listing and no commission on sales.</p>
          {b.plans.length === 0 ? <p className="mt-3 text-sm">Plans are being set up. Contact us to subscribe.</p> : (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {b.plans.map((p) => (
                <li key={p._id} className="rounded-lg border border-line p-4">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-2xl font-bold">{rupees(p.annualPrice)}<span className="text-sm font-normal text-muted"> / year</span></p>
                  <p className="text-sm">{bytes(p.storageBytes)} storage (roughly {num(approxPhotos(p.storageBytes))} photos)</p>
                  {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
                  {paid && liveAddons.length > 0 && (
                    <fieldset className="mt-2 text-sm"><legend className="text-muted">Renew add-on storage too:</legend>
                      {liveAddons.map((a) => <label key={a._id} className="mt-1 flex items-center gap-2"><input type="checkbox" className="accent-forest" checked={keepIds.includes(a._id)} onChange={(ev) => setKeep(ev.target.checked ? [...keepIds, a._id] : keepIds.filter((x) => x !== a._id))} />{a.name} ({bytes(a.storageBytes)})</label>)}
                    </fieldset>
                  )}
                  <div className="mt-3"><Buy body={{ purpose: 'subscription', productId: p._id, keepAddonIds: paid ? keepIds : [] }} label={paid ? 'Renew for a year' : 'Subscribe'} enabled={b.paymentsEnabled} onPaid={onPaid} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {e.state === 'active' && b.addons.length > 0 && (
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Add storage</h2>
          <p className="mt-1 text-sm text-muted">Extra storage runs until your plan ends on {dateIN(e.endsAt)}; you pay only for the days left. It can be renewed with your plan.</p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {b.addons.map((a) => (
              <li key={a._id} className="rounded-lg border border-line p-4">
                <p className="font-semibold">{a.name}: {bytes(a.storageBytes)}</p>
                <p className="text-sm text-muted">{rupees(a.annualPrice)} a year, charged for the days left on your plan</p>
                <div className="mt-3"><Buy body={{ purpose: 'addon', productId: a._id }} label="See price" enabled={b.paymentsEnabled} onPaid={onPaid} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-line bg-white p-5 text-sm">
        <h2 className="text-lg font-bold">How plans work</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Plans last one year and don't renew automatically. We remind you {t.reminderDays.join(', ')} day(s) before the end.</li>
          <li>Renewing early adds a year from your current end date.</li>
          <li>If a plan ends, your listings stay visible for {t.graceDays} days. After that they're hidden from buyers. Your listings and photos are kept for {Math.round(t.retentionDays / 30)} months and come back when you renew.</li>
          <li>Storage counts the photos we store for you (compressed copies). Deleting photos or listings frees space immediately.</li>
          <li>Add-on storage ends with your plan and is priced for the days left.</li>
          {t.gstNote && <li>{t.gstNote}</li>}
          <li>{t.refundTerms || 'Refund terms will be published before payments go live.'}</li>
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Payment history</h2>
        {b.payments.length === 0 ? <p className="mt-2 text-sm text-muted">No payments yet.</p> : (
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="py-2 font-medium">Date</th><th className="font-medium">For</th><th className="font-medium">Amount</th><th className="font-medium">Status</th><th className="font-medium">Reference</th></tr></thead>
            <tbody className="divide-y divide-line">{b.payments.map((p) => <tr key={p._id}><td className="py-2">{dateIN(p.paidAt || p.createdAt)}</td><td>{p.name}{p.storageBytes ? ` (${bytes(p.storageBytes)})` : ''}</td><td>{rupees(p.amount)}</td><td className={p.status === 'failed' ? 'text-red-800' : ''}>{p.status}{p.failureReason ? `: ${p.failureReason}` : ''}</td><td className="text-muted">{p.razorpayPaymentId || p.reference || '—'}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      {b.storageByListing.length > 0 && (
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Storage by listing</h2>
          <p className="mt-1 text-sm text-muted">Your listings using the most storage.</p>
          <ul className="mt-3 divide-y divide-line text-sm">{b.storageByListing.map((l) => <li key={l._id} className="flex justify-between gap-3 py-2"><Link to={`/dashboard/listings/${l._id}/edit`} className="truncate underline">{l.listingNo} · {l.title}</Link><span className="shrink-0 text-muted">{l.photos} photos · {bytes(l.bytes)}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
