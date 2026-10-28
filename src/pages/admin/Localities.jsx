import { useState } from 'react';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api } from '../../lib/api.js';
import { useMeta } from '../../lib/meta.jsx';
import { useFetch } from '../../lib/useFetch.js';

// Accepts "12.9250, 77.5938" as copied from Google Maps (right-click a point → click the coordinates).
const parse = (s) => {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
};

function Row({ l, onDone }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(l.lat != null ? `${l.lat}, ${l.lng}` : '');
  const [err, setErr] = useState(null);
  const save = async () => {
    const coords = val.trim() === '' ? null : parse(val);
    if (val.trim() && !coords) { setErr('Use "latitude, longitude", e.g. 12.9250, 77.5938'); return; }
    try { await api(`/admin/localities/${l._id}`, { method: 'PATCH', body: { coords } }); setEdit(false); setErr(null); onDone(); } catch (e) { setErr(e.message); }
  };
  return (
    <li className={`flex flex-wrap items-center gap-3 p-3 text-sm ${l.active ? '' : 'opacity-60'}`}>
      <div className="min-w-[10rem] flex-1"><p className="font-semibold">{l.name}{!l.active && <span className="font-normal text-muted"> (hidden)</span>}</p><p className="text-xs text-muted">{l.listingCount} listings</p></div>
      {edit ? (
        <div className="flex flex-wrap items-center gap-2">
          <input className="field w-56" value={val} onChange={(e) => setVal(e.target.value)} placeholder="12.9250, 77.5938" aria-label={`Centre point for ${l.name}`} />
          <button className="btn btn-primary px-3 py-1" onClick={save}>Save</button><button className="btn btn-outline px-3 py-1" onClick={() => { setEdit(false); setErr(null); }}>Cancel</button>
          {err && <span className="w-full text-xs text-red-700">{err}</span>}
        </div>
      ) : (
        <>
          <span className="text-xs text-muted">{l.lat != null ? `Centre ${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}` : 'No centre point (excluded from distance sort)'}</span>
          <button className="btn btn-outline px-3 py-1" onClick={() => setEdit(true)}>Set centre</button>
          <button className="btn btn-outline px-3 py-1" onClick={async () => { await api(`/admin/localities/${l._id}`, { method: 'PATCH', body: { active: !l.active } }); onDone(); }}>{l.active ? 'Hide' : 'Show'}</button>
        </>
      )}
    </li>
  );
}

export default function AdminLocalities() {
  const { data, error, reload } = useFetch('/admin/localities?city=Bengaluru');
  const meta = useMeta();
  const [name, setName] = useState('');
  const [coords, setCoords] = useState('');
  const [err, setErr] = useState(null);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const done = () => { reload(); meta.reload(); };
  const add = async (e) => {
    e.preventDefault(); setErr(null);
    const c = coords.trim() ? parse(coords) : null;
    if (coords.trim() && !c) { setErr('Centre must be "latitude, longitude".'); return; }
    try { await api('/admin/localities', { method: 'POST', body: { city: 'Bengaluru', name: name.trim(), coords: c } }); setName(''); setCoords(''); done(); } catch (e2) { setErr(e2.message); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Bengaluru localities. The centre point is used only for “nearest” sorting; distances shown to buyers are approximate. To copy a point from Google Maps, right-click the area's middle and click the coordinates. Localities can't be renamed because listings store the name; hide one and add the new name instead.</p>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-white p-3 text-sm">
        <label><span className="mb-1 block font-medium">New locality</span><input className="field w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kengeri" required minLength={2} /></label>
        <label><span className="mb-1 block font-medium">Centre (optional)</span><input className="field w-56" value={coords} onChange={(e) => setCoords(e.target.value)} placeholder="12.9100, 77.4850" /></label>
        <button className="btn btn-primary">Add</button>
        {err && <p className="w-full text-xs text-red-700" role="alert">{err}</p>}
      </form>
      <ul className="divide-y divide-line rounded-lg border border-line bg-white">{data.items.map((l) => <Row key={l._id} l={l} onDone={done} />)}</ul>
    </div>
  );
}
