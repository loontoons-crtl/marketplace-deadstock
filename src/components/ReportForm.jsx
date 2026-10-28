import { useState } from 'react';
import { api } from '../lib/api.js';
import { useMeta } from '../lib/meta.jsx';

// Buyers can report a listing without an account. An admin reviews every report.
export default function ReportForm({ listingId, onClose }) {
  const { reportReasons } = useMeta();
  const [state, setState] = useState('form'); // form | sending | done
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setState('sending'); setError(null); setFields({});
    try {
      await api(`/listings/${encodeURIComponent(listingId)}/report`, { method: 'POST', body: { reason: f.get('reason'), details: f.get('details').trim(), contact: f.get('contact').trim() } });
      setState('done');
    } catch (err) { setError(err.message); setFields(err.fields || {}); setState('form'); }
  };
  if (state === 'done') return (
    <div className="mt-4 rounded-lg border border-line bg-white p-4 text-sm" role="status">
      <p className="font-semibold">Thanks. Our team will look at this listing.</p>
      <p className="mt-1 text-muted">We don't hide listings automatically, so it may stay visible while we check.</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-line bg-white p-4 text-sm" noValidate>
      <p className="font-semibold">Report this listing</p>
      {error && <p className="rounded bg-red-50 p-2 text-red-800" role="alert">{error}</p>}
      <label className="block"><span className="mb-1 block font-medium">What's wrong?</span>
        <select name="reason" className="field w-full" required defaultValue=""><option value="" disabled>Choose a reason</option>{reportReasons.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="block"><span className="mb-1 block font-medium">Details</span>
        <textarea name="details" rows={3} maxLength={1000} className={`field w-full ${fields.details ? 'border-red-500' : ''}`} placeholder="What happened? Required if you choose “Other”." />
        {fields.details && <span className="text-xs text-red-700">{fields.details}</span>}</label>
      <label className="block"><span className="mb-1 block font-medium">Your phone or email (optional)</span>
        <input name="contact" maxLength={120} className="field w-full" placeholder="Only if you're happy for us to follow up" /></label>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send report'}</button>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
