import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, uploadPhoto } from '../../lib/api.js';
import { bytes } from '../../lib/format.js';
import { useFetch } from '../../lib/useFetch.js';

const MAX = 8;
const MAX_MB = 8;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Photos save immediately (they don't wait for the form's Save button).
// The first photo is the cover shown on search results.
export default function PhotoManager({ listingId, images, onChange, error: fieldError }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(null); // e.g. "Uploading 2 of 3…"
  const [error, setError] = useState(null);
  const [needsPlan, setNeedsPlan] = useState(null); // 'storage_full' | 'subscription_required'
  const billing = useFetch('/billing');
  const ent = billing.data?.entitlement;

  const add = async (files) => {
    setError(null); setNeedsPlan(null);
    const list = [...files];
    const room = MAX - images.length;
    if (list.length > room) setError(`Only ${room} more photo${room === 1 ? '' : 's'} can be added (maximum ${MAX}).`);
    const problems = [];
    let latest = null;
    for (const [i, f] of list.slice(0, room).entries()) {
      if (!TYPES.includes(f.type)) { problems.push(`${f.name}: use JPG, PNG or WebP.`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { problems.push(`${f.name}: larger than ${MAX_MB} MB.`); continue; }
      setBusy(`Uploading ${i + 1} of ${Math.min(list.length, room)}…`);
      try { latest = (await uploadPhoto(`/seller/listings/${listingId}/images`, f)).listing; onChange(latest); }
      catch (e) {
        problems.push(`${f.name}: ${e.message}`);
        if (e.code === 'storage_full' || e.code === 'subscription_required') { setNeedsPlan(e.code); break; }
      }
    }
    setBusy(null);
    billing.reload();
    if (problems.length) setError(problems.join(' '));
    if (input.current) input.current.value = '';
  };

  const remove = async (img) => {
    setBusy('Removing…'); setError(null);
    try { onChange((await api(`/seller/listings/${listingId}/images/${img._id}`, { method: 'DELETE' })).listing); billing.reload(); }
    catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  const makeCover = async (img) => {
    const ids = [img._id, ...images.filter((x) => x._id !== img._id).map((x) => x._id)];
    setBusy('Saving order…'); setError(null);
    try { onChange((await api(`/seller/listings/${listingId}/images/order`, { method: 'PUT', body: { ids } })).listing); }
    catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <fieldset className={`mt-4 rounded-lg border bg-white p-5 ${fieldError ? 'border-red-500' : 'border-line'}`}>
      <legend className="px-1 text-sm font-semibold">Photos ({images.length}/{MAX})</legend>
      <p className="text-sm text-muted">Photograph the actual stock: a wide shot of the lot, a close-up of the finish, and labels or batch numbers. JPG, PNG or WebP, up to {MAX_MB} MB each. Location data in photos is removed.</p>
      {fieldError && <p className="mt-2 text-xs text-red-700">{fieldError}</p>}
      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img._id} className="overflow-hidden rounded-md border border-line">
              <div className="relative">
                <img src={img.thumb || img.url} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-forest px-1.5 py-0.5 text-[11px] font-semibold text-white">Cover</span>}
              </div>
              <div className="flex justify-between gap-1 p-1.5 text-xs">
                {i > 0 ? <button type="button" className="rounded px-1.5 py-1 hover:bg-ink/5" onClick={() => makeCover(img)} disabled={Boolean(busy)}>Make cover</button> : <span />}
                <button type="button" className="rounded px-1.5 py-1 text-red-800 hover:bg-red-50" onClick={() => remove(img)} disabled={Boolean(busy)} aria-label={`Remove photo ${i + 1}`}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length < MAX && (
        <label className={`mt-4 inline-flex cursor-pointer btn btn-outline ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy || 'Add photos'}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => e.target.files.length && add(e.target.files)} disabled={Boolean(busy)} />
        </label>
      )}
      {busy && images.length >= MAX && <p className="mt-2 text-sm text-muted">{busy}</p>}
      {ent && <p className="mt-3 text-xs text-muted">Storage: {bytes(ent.usedBytes)} of {bytes(ent.allowanceBytes)} used, {bytes(ent.remainingBytes)} left.</p>}
      {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
      {needsPlan && <p className="mt-2 text-sm"><Link to="/dashboard/subscription" className="font-semibold text-forest underline">{needsPlan === 'storage_full' ? 'Add storage' : 'See subscription'}</Link>{needsPlan === 'storage_full' && ' or remove photos you no longer need.'}</p>}
    </fieldset>
  );
}
