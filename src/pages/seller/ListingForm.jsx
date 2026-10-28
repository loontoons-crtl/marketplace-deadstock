import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Field from '../../components/Field.jsx';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api } from '../../lib/api.js';
import { useMeta } from '../../lib/meta.jsx';
import { money, unitPrice } from '../../lib/format.js';
import StatusBadge from './StatusBadge.jsx';
import PhotoManager from './PhotoManager.jsx';

const BLANK = { title: '', categorySlug: '', subcategory: '', brand: '', model: '', description: '', condition: '', quantity: '', unit: '', totalPrice: '', mrp: '', minOrderQty: '', specs: {}, locality: '', pickupDetails: '' };
const CONDITION_HINT = {
  'Unused surplus': 'New, never used, left over from a project or order.',
  'Discontinued stock': 'New, but the design or model is no longer made.',
  'Opened packaging': 'New, but some packs have been opened.',
  Used: 'Previously installed or used. Describe the condition.',
  Damaged: 'Has defects. Describe exactly what is damaged.',
};

export default function ListingForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const location = useLocation();
  const meta = useMeta();
  const [form, setForm] = useState(BLANK);
  const [status, setStatus] = useState('draft');
  const [listingNo, setListingNo] = useState(null);
  const [images, setImages] = useState([]);
  const [notice, setNotice] = useState(location.state?.notice || null);
  const [loadState, setLoadState] = useState(editing ? 'loading' : 'ready');
  const [busy, setBusy] = useState(false);
  // A failed "save and submit" on a new listing lands here with its error carried over.
  const [error, setError] = useState(location.state?.error || null);
  const [fields, setFields] = useState(location.state?.fields || {});

  useEffect(() => {
    if (!editing) return;
    api(`/seller/listings/${id}`)
      .then(({ listing: l }) => {
        setForm({ ...BLANK, ...l, minOrderQty: l.minOrderQty ?? '', mrp: l.mrp ?? '', specs: l.specs || {} });
        setStatus(l.status); setListingNo(l.id); setImages(l.images || []); setLoadState('ready');
      })
      .catch((e) => { setError(e.message); setLoadState('error'); });
  }, [id, editing]);

  if (loadState === 'loading' || meta.loading) return <Loading />;
  if (loadState === 'error') return <ErrorBox message={error} />;
  if (['sold', 'expired', 'removed'].includes(status)) return <ErrorBox message={`This listing is ${status} and can no longer be edited.`} />;

  const cat = meta.catBySlug(form.categorySlug);
  const catLocked = !['draft', 'rejected'].includes(status);
  const titleLocked = ['active', 'reserved', 'unavailable'].includes(status);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSpec = (k) => (e) => setForm((f) => ({ ...f, specs: { ...f.specs, [k]: e.target.value } }));
  const preview = unitPrice({ qty: Number(form.quantity), total: Number(form.totalPrice), unit: form.unit });

  const validate = () => {
    const e = {};
    if (form.title.trim().length < 5) e.title = 'Title needs at least 5 characters.';
    if (!form.categorySlug) e.categorySlug = 'Choose a category.';
    if (!form.condition) e.condition = 'Choose a condition.';
    if (!form.unit) e.unit = 'Choose a unit.';
    if (form.unit !== 'lot' && !(Number(form.quantity) > 0)) e.quantity = 'Quantity must be more than 0.';
    if (!(Number.isInteger(Number(form.totalPrice)) && Number(form.totalPrice) > 0)) e.totalPrice = 'Enter the total asking price in whole rupees.';
    if (form.mrp !== '' && form.mrp != null && Number(form.mrp) <= Number(form.totalPrice)) e.mrp = 'MRP must be higher than your asking price, or leave it blank.';
    if (!form.locality) e.locality = 'Choose a locality.';
    return e;
  };

  const save = async (andSubmit) => {
    const local = validate();
    if (Object.keys(local).length) { setFields(local); setError('Please check the highlighted fields.'); return; }
    setBusy(true); setError(null); setFields({});
    const body = { ...form, quantity: form.unit === 'lot' ? 1 : Number(form.quantity), totalPrice: Number(form.totalPrice), mrp: form.mrp === '' || form.mrp == null ? null : Number(form.mrp), minOrderQty: form.minOrderQty === '' ? null : Number(form.minOrderQty), city: 'Bengaluru' };
    for (const k of ['_id', 'id', 'categoryName', 'status', 'images', 'rejectionReason', 'removedReason', 'autoPublished', 'storageBytes', 'submittedAt', 'activatedAt', 'expiresAt', 'views', 'contactClicks', 'createdAt', 'updatedAt']) delete body[k];
    if (catLocked) delete body.categorySlug;
    if (titleLocked) delete body.title;
    let saved = null;
    try {
      const { listing } = editing ? await api(`/seller/listings/${id}`, { method: 'PATCH', body }) : await api('/seller/listings', { method: 'POST', body });
      saved = listing;
      if (andSubmit) await api(`/seller/listings/${listing._id}/submit`, { method: 'POST' });
      // A new draft opens in edit mode so photos can be added straight away.
      if (!editing && !andSubmit) nav(`/dashboard/listings/${listing._id}/edit`, { replace: true, state: { notice: 'Draft saved. Add photos below, then submit.' } });
      else nav('/dashboard');
    } catch (e) {
      const msg = saved && !editing ? `Saved as a draft, but not submitted: ${e.message}` : e.message;
      // The draft exists now, so further changes must edit it rather than create another one.
      if (saved && !editing) nav(`/dashboard/listings/${saved._id}/edit`, { replace: true, state: { error: msg, fields: e.fields || {} } });
      else { setError(msg); setFields(e.fields || {}); }
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(false); }} noValidate className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">{editing ? 'Edit listing' : 'New listing'}</h2>
        {editing && <><StatusBadge status={status} /><span className="text-xs text-muted">{listingNo}</span></>}
      </div>
      <p className="mt-1 text-sm text-muted">One listing can be a single product or a defined stock lot. Give the total quantity and total asking price; the unit price is worked out for buyers.</p>
      {notice && !error && <p className="mt-4 rounded bg-forest/10 p-3 text-sm text-forest" role="status">{notice}</p>}
      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{error} {/phone|Allow buyers/.test(error) && <Link to="/dashboard/profile" className="font-semibold underline">Open profile</Link>}{/subscription|Renew|trial/.test(error) && <Link to="/dashboard/subscription" className="font-semibold underline">Subscription</Link>}</p>}

      <fieldset className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Product</legend>
        <Field label="Title" name="title" error={fields.title} className="sm:col-span-2" hint={titleLocked ? 'Locked after approval.' : 'What buyers will search for, e.g. “1 mm walnut laminate sheets, 8 x 4”.'}>{(p) => <input {...p} value={form.title} onChange={set('title')} maxLength={120} disabled={titleLocked} />}</Field>
        <Field label="Category" name="categorySlug" error={fields.categorySlug} hint={catLocked ? 'Locked after submission.' : undefined}>{(p) => (
          <select {...p} value={form.categorySlug} onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value, subcategory: '', specs: {} }))} disabled={catLocked}>
            <option value="">Choose a category</option>{meta.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>)}</Field>
        <Field label="Type (optional)" name="subcategory" error={fields.subcategory}>{(p) => <><input {...p} value={form.subcategory} onChange={set('subcategory')} list="subcats" maxLength={80} /><datalist id="subcats">{(cat?.subcategories || []).map((s) => <option key={s} value={s} />)}</datalist></>}</Field>
        <Field label="Brand (optional)" name="brand" error={fields.brand}>{(p) => <input {...p} value={form.brand} onChange={set('brand')} maxLength={80} placeholder="Leave blank if unbranded" />}</Field>
        <Field label="Model / design code (optional)" name="model" error={fields.model}>{(p) => <input {...p} value={form.model} onChange={set('model')} maxLength={80} />}</Field>
        <Field label="Condition" name="condition" error={fields.condition} className="sm:col-span-2" hint={CONDITION_HINT[form.condition]}>{(p) => (
          <select {...p} value={form.condition} onChange={set('condition')}><option value="">Choose a condition</option>{meta.conditions.map((c) => <option key={c}>{c}</option>)}</select>)}</Field>
      </fieldset>

      {cat && cat.specFields.length > 0 && (
        <fieldset className="mt-4 grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Specifications for {cat.name.toLowerCase()}</legend>
          {cat.specFields.map((s) => (
            <Field key={s.key} label={`${s.label}${s.required ? '' : ' (optional)'}`} name={`spec-${s.key}`} error={fields[`specs.${s.key}`]}>{(p) => <input {...p} value={form.specs[s.key] || ''} onChange={setSpec(s.key)} placeholder={s.placeholder} maxLength={200} />}</Field>
          ))}
        </fieldset>
      )}

      <fieldset className="mt-4 grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold">Quantity and price</legend>
        <Field label="Unit" name="unit" error={fields.unit}>{(p) => <select {...p} value={form.unit} onChange={set('unit')}><option value="">Choose</option>{meta.units.map((u) => <option key={u} value={u}>{u === 'lot' ? 'Whole stock lot' : u}</option>)}</select>}</Field>
        {form.unit !== 'lot' && <Field label="Total quantity" name="quantity" error={fields.quantity}>{(p) => <input {...p} inputMode="decimal" value={form.quantity} onChange={set('quantity')} />}</Field>}
        <Field label="Total asking price (₹)" name="totalPrice" error={fields.totalPrice} hint={form.totalPrice > 0 ? money(Number(form.totalPrice)) + (preview ? ` · ${preview}` : '') : undefined}>{(p) => <input {...p} inputMode="numeric" value={form.totalPrice} onChange={(e) => setForm((f) => ({ ...f, totalPrice: e.target.value.replace(/\D/g, '') }))} />}</Field>
        <Field label="MRP for the same quantity (₹, optional)" name="mrp" error={fields.mrp} hint={Number(form.mrp) > Number(form.totalPrice) && Number(form.totalPrice) > 0 ? `Buyers see ${money(Number(form.mrp))} struck through, ${Math.floor((1 - Number(form.totalPrice) / Number(form.mrp)) * 100)}% below MRP` : 'The printed or list price for this whole quantity. Shown struck through next to your price.'}>{(p) => <input {...p} inputMode="numeric" value={form.mrp ?? ''} onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value.replace(/\D/g, '') }))} />}</Field>
        {form.unit !== 'lot' && <Field label="Minimum order (optional)" name="minOrderQty" error={fields.minOrderQty}>{(p) => <input {...p} inputMode="numeric" value={form.minOrderQty} onChange={(e) => setForm((f) => ({ ...f, minOrderQty: e.target.value.replace(/\D/g, '') }))} />}</Field>}
      </fieldset>

      <fieldset className="mt-4 grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Location and pickup</legend>
        <Field label="City" name="city">{(p) => <input {...p} value="Bengaluru" disabled />}</Field>
        <Field label="Locality" name="locality" error={fields.locality}>{(p) => <select {...p} value={form.locality} onChange={set('locality')}><option value="">Choose a locality</option>{meta.localities.map((l) => <option key={l}>{l}</option>)}</select>}</Field>
        <Field label="Pickup and delivery (optional)" name="pickupDetails" error={fields.pickupDetails} className="sm:col-span-2">{(p) => <input {...p} value={form.pickupDetails} onChange={set('pickupDetails')} maxLength={500} placeholder="e.g. Pickup from godown; loading help available" />}</Field>
      </fieldset>

      <fieldset className="mt-4 rounded-lg border border-line bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Description</legend>
        <Field label="Describe the stock" name="description" error={fields.description} hint={`${form.description.length}/3000 · Needed before submitting: storage, packaging, any defects.`}>{(p) => <textarea {...p} rows={5} value={form.description} onChange={set('description')} maxLength={3000} />}</Field>
      </fieldset>

      {editing
        ? <PhotoManager listingId={id} images={images} error={fields.images} onChange={(l) => { setImages(l.images); setNotice(null); if (fields.images) setError(null); setFields((f) => ({ ...f, images: undefined })); }} />
        : <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-sm text-muted">Save the draft first, then add photos. At least one photo is needed before you submit.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-outline" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save draft'}</button>
        {['draft', 'rejected'].includes(status) && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(true)}>Save and submit</button>}
        <Link to="/dashboard" className="btn">Cancel</Link>
      </div>
    </form>
  );
}
