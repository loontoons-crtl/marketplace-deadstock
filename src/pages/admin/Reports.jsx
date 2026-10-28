import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api, qs } from '../../lib/api.js';
import { useFetch } from '../../lib/useFetch.js';
import StatusBadge from '../seller/StatusBadge.jsx';
import { dt, Pager, ReasonAction, Tabs } from './ui.jsx';

function Resolve({ report, onDone }) {
  const [remove, setRemove] = useState(false);
  const live = report.listing && !['removed', 'draft'].includes(report.listing.status);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <ReasonAction label="Took action" tone="primary" min={3} prompt="What did you do? (recorded)" placeholder="e.g. Called seller; price corrected"
        extra={live && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} className="accent-forest" />Also remove the listing (seller sees the note as the reason)</label>}
        onSubmit={async (note) => { await api(`/admin/reports/${report._id}/resolve`, { method: 'POST', body: { outcome: 'actioned', note, removeListing: remove } }); onDone(); }} />
      <ReasonAction label="Dismiss report" min={3} prompt="Why dismiss? (recorded)" placeholder="e.g. Checked with seller, stock is available"
        onSubmit={async (note) => { await api(`/admin/reports/${report._id}/resolve`, { method: 'POST', body: { outcome: 'dismissed', note } }); onDone(); }} />
    </div>
  );
}

export default function AdminReports() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') || 'open';
  const page = Number(sp.get('page')) || 1;
  const { data, error, reload } = useFetch(`/admin/reports${qs({ status, page })}`);
  return (
    <>
      <Tabs value={status} onChange={(v) => setSp({ status: v })} options={[['open', 'Open'], ['actioned', 'Action taken'], ['dismissed', 'Dismissed'], ['all', 'All']]} />
      <p className="mt-3 text-xs text-muted">Reports never hide a listing automatically. Check with the seller or buyer, then act.</p>
      {error ? <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div> : !data ? <Loading /> : (
        <>
          {data.items.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-line p-8 text-center text-muted">No {status === 'all' ? '' : status} reports.</p> : (
            <ul className="mt-4 space-y-3">
              {data.items.map((r) => (
                <li key={r._id} className="rounded-lg border border-line bg-white p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><b>{r.reason}</b><span className="text-muted">· {dt(r.createdAt)} · {r.status}</span></div>
                  {r.listing ? <p className="mt-1"><Link to={`/admin/listings/${r.listing._id}`} className="underline">{r.listing.id} · {r.listing.title}</Link> <StatusBadge status={r.listing.status} /></p> : <p className="mt-1 text-muted">Listing deleted</p>}
                  {r.details && <p className="mt-2 whitespace-pre-line">{r.details}</p>}
                  {r.contact && <p className="mt-1 text-muted">Reporter contact: {r.contact}</p>}
                  {r.status === 'open' ? <Resolve report={r} onDone={reload} /> : <p className="mt-2 text-muted">{r.resolvedBy}: {r.resolutionNote} ({dt(r.resolvedAt)})</p>}
                </li>
              ))}
            </ul>
          )}
          <Pager page={data.page} pages={data.pages} onPage={(p) => setSp({ status, page: String(p) })} />
        </>
      )}
    </>
  );
}
