import { useState } from 'react';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api } from '../../lib/api.js';
import { useMeta } from '../../lib/meta.jsx';
import { useFetch } from '../../lib/useFetch.js';

const toKey = (label) => label.toLowerCase().replace(/[^a-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^[^a-z]+/, '').slice(0, 40);
const toSlug = (name) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function Editor({ cat, onSaved, onCancel }) {
  const isNew = !cat._id;
  const [name, setName] = useState(cat.name || '');
  const [slug, setSlug] = useState(cat.slug || '');
  const [subs, setSubs] = useState((cat.subcategories || []).join(', '));
  const [fields, setFields] = useState(cat.specFields?.length ? cat.specFields : [{ key: '', label: '', placeholder: '', required: false }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const upd = (i, k, v) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, [k]: v, ...(k === 'label' && (isNew || !cat.specFields?.[i]) ? { key: toKey(v) } : {}) } : f)));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const body = {
      name: name.trim(),
      subcategories: subs.split(',').map((s) => s.trim()).filter(Boolean),
      specFields: fields.filter((f) => f.label.trim()).map((f) => ({ key: f.key || toKey(f.label), label: f.label.trim(), placeholder: (f.placeholder || '').trim(), required: Boolean(f.required) })),
    };
    try {
      if (isNew) await api('/admin/categories', { method: 'POST', body: { ...body, slug: slug || toSlug(name) } });
      else await api(`/admin/categories/${cat._id}`, { method: 'PATCH', body });
      onSaved();
    } catch (err) { setError(err.fields ? `${err.message} ${Object.values(err.fields).join(' ')}` : err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="space-y-3 rounded-lg border border-forest bg-white p-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block font-medium">Name</span><input className="field w-full" value={name} onChange={(e) => { setName(e.target.value); if (isNew) setSlug(toSlug(e.target.value)); }} required /></label>
        <label><span className="mb-1 block font-medium">Slug (used in URLs{isNew ? '' : ', fixed'})</span><input className="field w-full" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!isNew} /></label>
      </div>
      <label className="block"><span className="mb-1 block font-medium">Types (comma-separated, suggested on the listing form)</span><input className="field w-full" value={subs} onChange={(e) => setSubs(e.target.value)} placeholder="e.g. Hinges, Drawer channels, Handles" /></label>
      <div>
        <p className="mb-1 font-medium">Specification fields</p>
        <p className="mb-2 text-xs text-muted">Changing a field's label is safe. Removing a field hides that value on existing listings (the data stays).</p>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
              <input className="field" aria-label="Label" placeholder="Label, e.g. Thickness" value={f.label} onChange={(e) => upd(i, 'label', e.target.value)} />
              <input className="field" aria-label="Example" placeholder="Example, e.g. 18 mm" value={f.placeholder || ''} onChange={(e) => upd(i, 'placeholder', e.target.value)} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(f.required)} onChange={(e) => upd(i, 'required', e.target.checked)} className="accent-forest" />Required</label>
              <button type="button" className="px-2 text-red-800" aria-label="Remove field" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        {fields.length < 15 && <button type="button" className="mt-2 text-forest underline" onClick={() => setFields((fs) => [...fs, { key: '', label: '', placeholder: '', required: false }])}>+ Add field</button>}
      </div>
      {error && <p className="rounded bg-red-50 p-2 text-red-800" role="alert">{error}</p>}
      <div className="flex gap-2"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save category'}</button><button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export default function AdminCategories() {
  const { data, error, reload } = useFetch('/admin/categories');
  const meta = useMeta();
  const [editing, setEditing] = useState(null);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const done = () => { setEditing(null); reload(); meta.reload(); };
  const toggle = async (c) => { await api(`/admin/categories/${c._id}`, { method: 'PATCH', body: { active: !c.active } }); done(); };
  const move = async (c, dir) => {
    const list = data.items; const i = list.indexOf(c); const other = list[i + dir];
    if (!other) return;
    await api(`/admin/categories/${c._id}`, { method: 'PATCH', body: { order: other.order } });
    await api(`/admin/categories/${other._id}`, { method: 'PATCH', body: { order: c.order } });
    done();
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">Hidden categories disappear from the site and the listing form. Existing listings keep their category.</p>
        {!editing && <button className="btn btn-primary" onClick={() => setEditing({})}>Add category</button>}</div>
      {editing && !editing._id && <Editor cat={{}} onSaved={done} onCancel={() => setEditing(null)} />}
      <ul className="space-y-2">
        {data.items.map((c, i) => editing?._id === c._id ? <li key={c._id}><Editor cat={c} onSaved={done} onCancel={() => setEditing(null)} /></li> : (
          <li key={c._id} className={`flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3 text-sm ${c.active ? '' : 'opacity-60'}`}>
            <div className="min-w-0 flex-1"><p className="font-semibold">{c.name} {!c.active && <span className="font-normal text-muted">(hidden)</span>}</p><p className="text-xs text-muted">/{c.slug} · {c.listingCount} listings · {c.specFields.length} spec fields{c.specFields.some((f) => f.required) && ` (${c.specFields.filter((f) => f.required).map((f) => f.label).join(', ')} required)`}</p></div>
            <div className="flex gap-1">
              <button className="btn btn-outline px-2 py-1" aria-label="Move up" disabled={i === 0} onClick={() => move(c, -1)}>↑</button>
              <button className="btn btn-outline px-2 py-1" aria-label="Move down" disabled={i === data.items.length - 1} onClick={() => move(c, 1)}>↓</button>
              <button className="btn btn-outline px-3 py-1" onClick={() => setEditing(c)}>Edit</button>
              <button className="btn btn-outline px-3 py-1" onClick={() => toggle(c)}>{c.active ? 'Hide' : 'Show'}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
