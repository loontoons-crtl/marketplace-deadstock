import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dateIN } from '../../lib/format.js';

export const dt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
export const ago = (iso) => {
  if (!iso) return '—';
  const h = Math.floor((Date.now() - new Date(iso)) / 36e5);
  return h < 1 ? 'under an hour ago' : h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} days ago`;
};
export { dateIN };

export function Pager({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center gap-2 text-sm">
      <button className="btn btn-outline px-3 py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="text-muted">Page {page} of {pages}</span>
      <button className="btn btn-outline px-3 py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 text-sm ${value === v ? 'bg-ink text-white' : 'border border-line bg-white hover:bg-ink/5'}`}>{label}</button>
      ))}
    </div>
  );
}

// A button that opens a small inline form asking for a reason or note before running the action.
export function ReasonAction({ label, prompt, placeholder, min = 10, tone = 'outline', onSubmit, extra }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const btn = tone === 'danger' ? 'btn bg-red-800 text-white hover:bg-red-900' : tone === 'primary' ? 'btn btn-primary' : 'btn btn-outline';
  if (!open) return <button className={`${btn} px-3 py-1.5`} onClick={() => setOpen(true)}>{label}</button>;
  const go = async (e) => {
    e.preventDefault();
    if (text.trim().length < min) { setError(`At least ${min} characters.`); return; }
    setBusy(true); setError(null);
    try { await onSubmit(text.trim()); setOpen(false); setText(''); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="w-full rounded-md border border-line bg-paper p-3 text-sm">
      <label className="block"><span className="mb-1 block font-medium">{prompt}</span>
        <textarea autoFocus rows={2} className="field w-full" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={500} /></label>
      {extra}
      {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
      <div className="mt-2 flex gap-2"><button className={`${btn} px-3 py-1.5`} disabled={busy}>{busy ? 'Saving…' : `Confirm: ${label.toLowerCase()}`}</button><button type="button" className="btn btn-outline px-3 py-1.5" onClick={() => { setOpen(false); setError(null); }}>Cancel</button></div>
    </form>
  );
}

export const Yes = ({ ok, yes = 'Yes', no = 'No' }) => <span className={ok ? 'font-semibold text-forest' : 'text-muted'}>{ok ? `✓ ${yes}` : no}</span>;

export const ListingLink = ({ l }) => <Link to={`/admin/listings/${l._id}`} className="font-semibold hover:text-forest hover:underline">{l.title}</Link>;
