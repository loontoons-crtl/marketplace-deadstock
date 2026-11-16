import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useMeta } from '../../lib/meta.jsx';

function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let cur = '';

  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      row.push(cur.trim());
      cur = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(cur.trim());
      if (row.some((cell) => cell !== '')) lines.push(row);
      row = [];
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur || row.length) {
    row.push(cur.trim());
    if (row.some((cell) => cell !== '')) lines.push(row);
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return lines.slice(1).map((r, idx) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] || '';
    });
    return {
      _id: `row-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      selected: true,
      title: obj.title || '',
      category: obj.category || obj.categoryslug || '',
      subcategory: obj.subcategory || '',
      condition: obj.condition || '',
      quantity: obj.quantity || obj.qty || '',
      unit: obj.unit || '',
      totalPrice: obj.totalprice || obj.price || '',
      mrp: obj.mrp || '',
      minOrderQty: obj.minorderqty || obj.minorder || '',
      brand: obj.brand || '',
      model: obj.model || '',
      locality: obj.locality || '',
      pickupDetails: obj.pickupdetails || obj.pickup || '',
      description: obj.description || obj.desc || '',
    };
  });
}

function EditRowModal({ row, categories, localities, conditions, units, onSave, onClose }) {
  const [form, setForm] = useState({ ...row });
  const [err, setErr] = useState(null);

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.title || form.title.trim().length < 5) {
      setErr('Title must have at least 5 characters.');
      return;
    }
    if (!form.category) {
      setErr('Please select a category.');
      return;
    }
    if (!form.condition) {
      setErr('Please select a condition.');
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      setErr('Quantity must be greater than 0.');
      return;
    }
    if (!form.unit) {
      setErr('Please select a unit.');
      return;
    }
    if (!form.totalPrice || Number(form.totalPrice) <= 0) {
      setErr('Asking price must be greater than 0.');
      return;
    }
    if (form.mrp && Number(form.mrp) <= Number(form.totalPrice)) {
      setErr('MRP must be higher than asking price.');
      return;
    }
    if (!form.locality) {
      setErr('Please choose a locality.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-line bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Edit listing before upload</h2>
            <p className="text-xs text-muted">Make quick updates to this listing row.</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink text-xl">✕</button>
        </div>
        <form onSubmit={handleSave} className="mt-4 space-y-4 max-h-[72vh] overflow-y-auto px-1">
          {err && <p className="rounded bg-red-50 p-2.5 text-xs text-red-800" role="alert">{err}</p>}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="field w-full text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="field w-full text-sm"
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Subcategory</label>
              <input
                type="text"
                value={form.subcategory}
                onChange={(e) => handleChange('subcategory', e.target.value)}
                className="field w-full text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Condition *</label>
              <select
                value={form.condition}
                onChange={(e) => handleChange('condition', e.target.value)}
                className="field w-full text-sm"
                required
              >
                <option value="">Select condition</option>
                {conditions.map((cd) => (
                  <option key={cd} value={cd}>{cd}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Quantity *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={form.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                className="field w-full text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Unit *</label>
              <select
                value={form.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                className="field w-full text-sm"
                required
              >
                <option value="">Select unit</option>
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Asking Price (₹) *</label>
              <input
                type="number"
                min="1"
                value={form.totalPrice}
                onChange={(e) => handleChange('totalPrice', e.target.value)}
                className="field w-full text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">MRP (₹ optional)</label>
              <input
                type="number"
                min="1"
                value={form.mrp}
                onChange={(e) => handleChange('mrp', e.target.value)}
                placeholder="Higher than asking"
                className="field w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Min Order Qty</label>
              <input
                type="number"
                min="1"
                value={form.minOrderQty}
                onChange={(e) => handleChange('minOrderQty', e.target.value)}
                className="field w-full text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Locality (Bengaluru) *</label>
              <select
                value={form.locality}
                onChange={(e) => handleChange('locality', e.target.value)}
                className="field w-full text-sm"
                required
              >
                <option value="">Choose locality</option>
                {localities.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Brand</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                className="field w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Model / Code</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                className="field w-full text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Pickup / Delivery notes</label>
            <input
              type="text"
              value={form.pickupDetails}
              onChange={(e) => handleChange('pickupDetails', e.target.value)}
              className="field w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="field w-full text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onClose} className="btn btn-outline text-xs px-4 py-2">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary text-xs px-5 py-2">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MassUpload() {
  const { categories, localities, conditions, units } = useMeta();
  const nav = useNavigate();
  const [mode, setMode] = useState('file'); // 'file' or 'paste'
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const selectedCount = parsed.filter((r) => r.selected).length;
  const allSelected = parsed.length > 0 && selectedCount === parsed.length;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const rows = parseCSV(text);
      if (!rows.length) {
        setError('No valid data rows found in the CSV file. Please check the template format.');
        setParsed([]);
      } else {
        setParsed(rows);
      }
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (text) => {
    setRawText(text);
    setError(null);
    if (!text.trim()) {
      setParsed([]);
      return;
    }
    const rows = parseCSV(text);
    setParsed(rows);
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/seller/listings/bulk-template';
  };

  const toggleSelectRow = (id) => {
    setParsed((rows) =>
      rows.map((r) => (r._id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAll = () => {
    const nextState = !allSelected;
    setParsed((rows) => rows.map((r) => ({ ...r, selected: nextState })));
  };

  const deleteRow = (id) => {
    setParsed((rows) => rows.filter((r) => r._id !== id));
  };

  const handleSaveRow = (updatedRow) => {
    setParsed((rows) =>
      rows.map((r) => (r._id === updatedRow._id ? { ...updatedRow, selected: true } : r))
    );
    setEditingRow(null);
  };

  const submitBatch = async () => {
    const itemsToUpload = parsed.filter((r) => r.selected);
    if (!itemsToUpload.length) {
      setError('Please select at least one listing to upload.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const d = await api('/seller/listings/bulk', {
        method: 'POST',
        body: { items: itemsToUpload },
      });
      setResult(d);
    } catch (err) {
      setError(err.message || 'Mass upload failed. Check your data and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mass upload listings</h1>
          <p className="mt-1 text-sm text-muted">
            Quickly create dozens of listings at once from a CSV or Excel spreadsheet.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="btn btn-outline flex items-center gap-2 text-sm"
        >
          <svg className="h-4 w-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download CSV template
        </button>
      </div>

      {editingRow && (
        <EditRowModal
          row={editingRow}
          categories={categories}
          localities={localities}
          conditions={conditions}
          units={units}
          onSave={handleSaveRow}
          onClose={() => setEditingRow(null)}
        />
      )}

      {result ? (
        <div className="space-y-6 rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-full ${result.failedCount === 0 ? 'bg-forest/10 text-forest' : 'bg-amber-100 text-amber-800'}`}>
              {result.failedCount === 0 ? '✓' : '⚠️'}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {result.createdCount} listing{result.createdCount === 1 ? '' : 's'} created successfully!
              </h2>
              {result.failedCount > 0 && (
                <p className="text-sm text-amber-800">
                  {result.failedCount} row{result.failedCount === 1 ? '' : 's'} had errors and were skipped.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/dashboard" className="btn btn-primary">
              View all listings
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setParsed([]);
                setRawText('');
                setFileName('');
              }}
              className="btn btn-outline"
            >
              Upload another batch
            </button>
          </div>

          {result.results?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-ink">Batch Details:</h3>
              <ul className="mt-3 divide-y divide-line rounded-lg border border-line text-sm max-h-96 overflow-y-auto">
                {result.results.map((r, i) => (
                  <li key={i} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono ${r.success ? 'bg-forest/10 text-forest font-semibold' : 'bg-red-100 text-red-800'}`}>
                        {r.success ? r.listingNo : `Row ${r.row}`}
                      </span>
                      <span className="font-medium text-ink">{r.title}</span>
                    </div>
                    {r.success ? (
                      <Link
                        to={`/dashboard/listings/${r.id}/edit`}
                        className="text-xs font-semibold text-forest underline hover:text-ink"
                      >
                        Add photos →
                      </Link>
                    ) : (
                      <span className="text-xs text-red-700">{r.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Instructions card */}
          <section className="rounded-xl border border-line bg-white p-5 text-sm">
            <h2 className="font-semibold text-ink">How mass upload works:</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted">
              <li>Click <strong>Download CSV template</strong> to get the standard format with example rows.</li>
              <li>Fill in your surplus stock (Title, Category, Condition, Quantity, Unit, Price, Locality, etc.).</li>
              <li>Upload your completed CSV or paste the copied rows below.</li>
              <li>Use the <strong>checkboxes</strong> to pick which listings to upload, and click <strong>Edit</strong> on any row to fix errors before saving.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3 text-xs text-muted">
              <span><strong>Supported units:</strong> {units.join(', ')}</span>
              <span><strong>Conditions:</strong> {conditions.join(', ')}</span>
            </div>
          </section>

          {/* Mode switch */}
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${mode === 'file' ? 'bg-forest text-white' : 'text-muted hover:text-ink'}`}
            >
              Upload CSV file
            </button>
            <button
              type="button"
              onClick={() => setMode('paste')}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${mode === 'paste' ? 'bg-forest text-white' : 'text-muted hover:text-ink'}`}
            >
              Paste spreadsheet data
            </button>
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

          {mode === 'file' ? (
            <div className="rounded-xl border-2 border-dashed border-line bg-white p-8 text-center">
              <input
                type="file"
                id="csvFile"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="csvFile"
                className="cursor-pointer inline-flex flex-col items-center justify-center"
              >
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-forest/10 text-forest">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <span className="font-semibold text-ink">
                  {fileName ? fileName : 'Click to select CSV file'}
                </span>
                <span className="mt-1 text-xs text-muted">Supports .csv files up to 200 items per batch</span>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink">
                Paste CSV or Excel text (including header row):
              </label>
              <textarea
                rows={8}
                value={rawText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={'Title,Category,Subcategory,Condition,Quantity,Unit,TotalPrice,MRP,MinOrderQty,Brand,Model,Locality,PickupDetails,Description\n"Decorative Laminate Sheets",laminates,"Decorative laminates","Unused surplus",100,sheets,140000,220000,10,"CenturyPly","WG-101","Peenya","Pickup only","Sealed bundles"'}
                className="field font-mono text-xs w-full"
              />
            </div>
          )}

          {/* Preview & Edit Table */}
          {parsed.length > 0 && (
            <div className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded accent-forest cursor-pointer"
                    />
                    <span>Select all ({selectedCount} of {parsed.length} selected)</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || selectedCount === 0}
                    onClick={submitBatch}
                    className="btn btn-primary rounded-full px-6 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {busy ? 'Creating listings…' : `Upload ${selectedCount} selected listing${selectedCount === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-paper text-ink font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="h-3.5 w-3.5 rounded accent-forest cursor-pointer"
                          aria-label="Select all listings"
                        />
                      </th>
                      <th className="p-3">#</th>
                      <th className="p-3">Title</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Condition</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Asking Price</th>
                      <th className="p-3">MRP</th>
                      <th className="p-3">Locality</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-muted">
                    {parsed.map((row, i) => (
                      <tr
                        key={row._id}
                        className={`transition-colors ${row.selected ? 'hover:bg-sand/30' : 'bg-sand/15 opacity-60'}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => toggleSelectRow(row._id)}
                            className="h-3.5 w-3.5 rounded accent-forest cursor-pointer"
                            aria-label={`Select listing ${row.title || i + 1}`}
                          />
                        </td>
                        <td className="p-3 font-mono">{i + 1}</td>
                        <td className="p-3 font-medium text-ink max-w-xs truncate">
                          {row.title || <span className="text-red-600 italic">Missing title</span>}
                        </td>
                        <td className="p-3">
                          {row.category || <span className="text-red-600 italic">Missing</span>}
                        </td>
                        <td className="p-3">{row.condition || '—'}</td>
                        <td className="p-3">{row.quantity ? `${row.quantity} ${row.unit}` : '—'}</td>
                        <td className="p-3 font-medium text-ink">
                          {row.totalPrice ? `₹${Number(row.totalPrice).toLocaleString('en-IN')}` : <span className="text-red-600 italic">Missing</span>}
                        </td>
                        <td className="p-3">{row.mrp ? `₹${Number(row.mrp).toLocaleString('en-IN')}` : '—'}</td>
                        <td className="p-3">
                          {row.locality || <span className="text-red-600 italic">Missing</span>}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingRow(row)}
                              className="font-semibold text-forest underline hover:text-ink text-xs"
                            >
                              Edit
                            </button>
                            <span className="text-line">|</span>
                            <button
                              type="button"
                              onClick={() => deleteRow(row._id)}
                              className="text-red-700 hover:text-red-900 text-xs"
                              title="Remove from batch"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
