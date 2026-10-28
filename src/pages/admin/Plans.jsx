import { useState } from 'react';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api } from '../../lib/api.js';
import { useMeta } from '../../lib/meta.jsx';
import { bytes, approxPhotos, num, rupees } from '../../lib/format.js';
import { useFetch } from '../../lib/useFetch.js';

const toMB = (amount, unit) => Math.round(Number(amount) * (unit === 'GB' ? 1024 : 1));

function ProductForm({ kind, product, onDone, onCancel }) {
  const startGB = product && product.storageMB >= 1024 && product.storageMB % 1024 === 0;
  const [f, setF] = useState({
    name: product?.name || '', description: product?.description || '',
    amount: product ? (startGB ? product.storageMB / 1024 : product.storageMB) : '', unit: product ? (startGB || !product.storageMB ? 'GB' : 'MB') : 'GB',
    annualPrice: product?.annualPrice ?? (kind === 'plan' ? 5000 : ''), durationDays: product?.durationDays ?? 365, active: product?.active ?? false,
  });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async (e) => {
    e.preventDefault(); setErr(null);
    const storageMB = toMB(f.amount, f.unit);
    if (!storageMB) { setErr('Enter the storage allowance.'); return; }
    const body = { name: f.name.trim(), description: f.description.trim(), storageMB, annualPrice: Number(f.annualPrice), active: f.active, ...(kind === 'plan' ? { durationDays: Number(f.durationDays) } : {}) };
    setBusy(true);
    try {
      if (product) await api(`/admin/storage-products/${product._id}`, { method: 'PATCH', body });
      else await api('/admin/storage-products', { method: 'POST', body: { ...body, kind } });
      onDone();
    } catch (e2) { setErr(e2.fields ? Object.values(e2.fields).join(' ') : e2.message); } finally { setBusy(false); }
  };
  const mb = toMB(f.amount || 0, f.unit);
  return (
    <form onSubmit={save} className="grid gap-3 rounded-lg border border-forest bg-white p-4 text-sm sm:grid-cols-2">
      <label><span className="mb-1 block font-medium">Name</span><input className="field w-full" value={f.name} onChange={set('name')} required placeholder={kind === 'plan' ? 'e.g. Starter' : 'e.g. Extra 1 GB'} /></label>
      <label><span className="mb-1 block font-medium">Annual price (₹)</span><input className="field w-full" inputMode="numeric" value={f.annualPrice} onChange={(e) => setF((x) => ({ ...x, annualPrice: e.target.value.replace(/\D/g, '') }))} required /></label>
      <div><span className="mb-1 block font-medium">Storage allowance</span>
        <div className="flex gap-2"><input className="field w-full" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="e.g. 2" /><select className="field" value={f.unit} onChange={set('unit')}><option>GB</option><option>MB</option></select></div>
        {mb > 0 && <span className="mt-1 block text-xs text-muted">Roughly {num(approxPhotos(mb * 1024 * 1024))} photos at about 300 KB each.</span>}</div>
      {kind === 'plan' && <label><span className="mb-1 block font-medium">Length (days)</span><input className="field w-full" inputMode="numeric" value={f.durationDays} onChange={(e) => setF((x) => ({ ...x, durationDays: e.target.value.replace(/\D/g, '') }))} /></label>}
      <label className="sm:col-span-2"><span className="mb-1 block font-medium">Description (shown to sellers)</span><input className="field w-full" value={f.description} onChange={set('description')} maxLength={300} /></label>
      <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" className="accent-forest" checked={f.active} onChange={set('active')} />On sale (sellers can buy it)</label>
      {product && <p className="text-xs text-muted sm:col-span-2">Changes apply to new purchases only. Sellers who already bought keep what they paid for.</p>}
      {err && <p className="rounded bg-red-50 p-2 text-red-800 sm:col-span-2" role="alert">{err}</p>}
      <div className="flex gap-2 sm:col-span-2"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function ProductList({ kind, items, onChange }) {
  const [editing, setEditing] = useState(null);
  const done = () => { setEditing(null); onChange(); };
  const list = items.filter((p) => p.kind === kind);
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{kind === 'plan' ? 'Annual plans' : 'Extra storage add-ons'}</h2>
        {!editing && <button className="btn btn-outline px-3 py-1.5" onClick={() => setEditing('new')}>Add {kind === 'plan' ? 'plan' : 'add-on'}</button>}
      </div>
      <p className="mt-1 text-sm text-muted">{kind === 'plan' ? 'Sellers choose one plan a year. Unlimited listings within its storage.' : 'Sellers on a paid plan can add storage; it ends with their plan and is charged for the days left.'}</p>
      {editing === 'new' && <div className="mt-3"><ProductForm kind={kind} onDone={done} onCancel={() => setEditing(null)} /></div>}
      <ul className="mt-3 space-y-2">
        {list.length === 0 && editing !== 'new' && <li className="text-sm text-muted">None yet.</li>}
        {list.map((p) => editing === p._id ? <li key={p._id}><ProductForm kind={kind} product={p} onDone={done} onCancel={() => setEditing(null)} /></li> : (
          <li key={p._id} className={`flex flex-wrap items-center gap-3 rounded-md border border-line p-3 text-sm ${p.active ? '' : 'bg-paper'}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name} <span className={`ml-1 rounded px-1.5 text-xs ${p.active ? 'bg-forest text-white' : 'bg-line'}`}>{p.active ? 'on sale' : 'off sale'}</span></p>
              <p className="text-muted">{rupees(p.annualPrice)} / year · {p.storageBytes ? bytes(p.storageBytes) : <span className="font-semibold text-red-800">storage not set</span>}{kind === 'plan' && p.durationDays !== 365 ? ` · ${p.durationDays} days` : ''}</p>
            </div>
            <button className="btn btn-outline px-3 py-1" onClick={() => setEditing(p._id)}>Edit</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SettingsForm({ settings, onSaved }) {
  const [f, setF] = useState({ ...settings, reminderDays: settings.reminderDays.join(', ') });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const int = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value.replace(/\D/g, '') }));
  const save = async (e) => {
    e.preventDefault(); setMsg(null); setErr(null);
    const body = {
      trialDays: Number(f.trialDays), trialStorageMB: Number(f.trialStorageMB), graceDays: Number(f.graceDays), retentionDays: Number(f.retentionDays),
      reviewFirstListings: Number(f.reviewFirstListings), moderationMode: f.moderationMode || 'auto',
      blockedWords: String(f.blockedWordsText ?? (f.blockedWords || []).join(', ')).split(',').map((w) => w.trim()).filter(Boolean),
      reminderDays: String(f.reminderDays).split(',').map((x) => Number(x.trim())).filter(Boolean),
      gstNote: f.gstNote || '', refundTerms: f.refundTerms || '',
    };
    try { await api('/admin/settings', { method: 'PATCH', body }); setMsg('Saved.'); onSaved(); } catch (e2) { setErr(e2.fields ? Object.entries(e2.fields).map(([k, v]) => `${k}: ${v}`).join(' ') : e2.message); }
  };
  const F = ({ k, label, hint, ...p }) => <label className="text-sm"><span className="mb-1 block font-medium">{label}</span><input className="field w-full" value={f[k] ?? ''} onChange={int(k)} inputMode="numeric" {...p} />{hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}</label>;
  return (
    <form onSubmit={save} className="grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
      <h2 className="text-lg font-bold sm:col-span-2 lg:col-span-3">Rules</h2>
      {F({ k: 'trialDays', label: 'Free trial (days)', hint: '0 switches the trial off for new sellers.' })}
      {F({ k: 'trialStorageMB', label: 'Trial storage (MB)', hint: `Roughly ${num(approxPhotos((Number(f.trialStorageMB) || 0) * 1024 * 1024))} photos.` })}
      <label className="text-sm"><span className="mb-1 block font-medium">Listing checks</span>
        <select className="field w-full" value={f.moderationMode || 'auto'} onChange={(e) => setF((x) => ({ ...x, moderationMode: e.target.value }))}>
          <option value="auto">Automatic: clean listings go live, flagged ones wait for you</option>
          <option value="manual">Manual: every listing waits for you</option>
        </select>
        <span className="mt-1 block text-xs text-muted">Checks: contact details in text, blocked words, odd prices, photos copied from another seller, seller’s report and removal history.</span></label>
      {F({ k: 'reviewFirstListings', label: 'Also check each seller’s first … listings by hand', hint: '0 = rely on the automatic checks only.' })}
      <label className="text-sm sm:col-span-2 lg:col-span-3"><span className="mb-1 block font-medium">Blocked words (comma-separated)</span><input className="field w-full" value={f.blockedWordsText ?? (f.blockedWords || []).join(', ')} onChange={(e) => setF((x) => ({ ...x, blockedWordsText: e.target.value }))} placeholder="e.g. a banned product, a phrase used in scams" /><span className="mt-1 block text-xs text-muted">A listing containing any of these goes to your review queue instead of going live.</span></label>
      {F({ k: 'graceDays', label: 'Grace period after a plan ends (days)', hint: 'Listings stay visible, no new photos.' })}
      {F({ k: 'retentionDays', label: 'Keep data after a plan ends (days)', hint: 'Shown to sellers. Nothing is deleted automatically.' })}
      <label className="text-sm"><span className="mb-1 block font-medium">Renewal reminders (days before)</span><input className="field w-full" value={f.reminderDays} onChange={(e) => setF((x) => ({ ...x, reminderDays: e.target.value }))} placeholder="30, 7, 1" /></label>
      <label className="text-sm sm:col-span-2 lg:col-span-3"><span className="mb-1 block font-medium">GST note shown with prices</span><input className="field w-full" value={f.gstNote || ''} onChange={(e) => setF((x) => ({ ...x, gstNote: e.target.value }))} maxLength={200} placeholder="e.g. Prices include 18% GST (confirm with your CA)" /></label>
      <label className="text-sm sm:col-span-2 lg:col-span-3"><span className="mb-1 block font-medium">Refund terms shown to sellers</span><textarea className="field w-full" rows={2} value={f.refundTerms || ''} onChange={(e) => setF((x) => ({ ...x, refundTerms: e.target.value }))} maxLength={1000} placeholder="Leave empty until your refund policy is decided" /></label>
      {err && <p className="rounded bg-red-50 p-2 text-sm text-red-800 sm:col-span-2 lg:col-span-3" role="alert">{err}</p>}
      {msg && <p className="rounded bg-forest/10 p-2 text-sm text-forest sm:col-span-2 lg:col-span-3" role="status">{msg}</p>}
      <div className="sm:col-span-2 lg:col-span-3"><button className="btn btn-primary">Save rules</button></div>
    </form>
  );
}

export default function AdminPlans() {
  const products = useFetch('/admin/storage-products');
  const settings = useFetch('/admin/settings');
  const meta = useMeta();
  if (products.error || settings.error) return <ErrorBox message={products.error || settings.error} onRetry={() => { products.reload(); settings.reload(); }} />;
  if (!products.data || !settings.data) return <Loading />;
  const changed = () => { products.reload(); meta.reload(); };
  const unset = products.data.items.filter((p) => p.kind === 'plan' && !p.storageBytes);
  return (
    <div className="space-y-6">
      {unset.length > 0 && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Set the storage allowance for {unset.map((p) => p.name).join(', ')} and switch it on sale. Until then sellers can't subscribe.</p>}
      <ProductList kind="plan" items={products.data.items} onChange={changed} />
      <ProductList kind="addon" items={products.data.items} onChange={changed} />
      <SettingsForm settings={settings.data.settings} onSaved={() => { settings.reload(); meta.reload(); }} />
    </div>
  );
}
