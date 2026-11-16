import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useMeta } from '../../lib/meta.jsx';

function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let cur = '';

  // Determine delimiter: tab or comma
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
  return lines.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] || '';
    });
    return {
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

export default function MassUpload() {
  const { categories, localities, conditions, units } = useMeta();
  const nav = useNavigate();
  const [mode, setMode] = useState('file'); // 'file' or 'paste'
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

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

  const submitBatch = async () => {
    if (!parsed.length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const d = await api('/seller/listings/bulk', {
        method: 'POST',
        body: { items: parsed },
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
              <li>All items are saved directly to your dashboard as drafts so you can add photos and publish them!</li>
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

          {/* Preview Table */}
          {parsed.length > 0 && (
            <div className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">
                  Preview ({parsed.length} item{parsed.length === 1 ? '' : 's'} ready)
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={submitBatch}
                  className="btn btn-primary rounded-full px-6 py-2 text-sm font-semibold"
                >
                  {busy ? 'Creating listings…' : `Upload ${parsed.length} listings`}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-paper text-ink font-semibold">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Title</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Condition</th>
                      <th className="p-2.5">Quantity</th>
                      <th className="p-2.5">Asking Price</th>
                      <th className="p-2.5">MRP</th>
                      <th className="p-2.5">Locality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-muted">
                    {parsed.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-sand/30">
                        <td className="p-2.5 font-mono">{i + 1}</td>
                        <td className="p-2.5 font-medium text-ink max-w-xs truncate">{row.title || '—'}</td>
                        <td className="p-2.5">{row.category || '—'}</td>
                        <td className="p-2.5">{row.condition || '—'}</td>
                        <td className="p-2.5">{row.quantity ? `${row.quantity} ${row.unit}` : '—'}</td>
                        <td className="p-2.5 font-medium text-ink">{row.totalPrice ? `₹${Number(row.totalPrice).toLocaleString('en-IN')}` : '—'}</td>
                        <td className="p-2.5">{row.mrp ? `₹${Number(row.mrp).toLocaleString('en-IN')}` : '—'}</td>
                        <td className="p-2.5">{row.locality || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.length > 10 && (
                <p className="text-center text-xs text-muted pt-2">
                  Showing first 10 of {parsed.length} rows. All {parsed.length} will be uploaded.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
