import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { qs } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useFetch } from '../../lib/useFetch.js';
import StatusBadge from '../seller/StatusBadge.jsx';
import { ago, ListingLink, Pager, Tabs } from './ui.jsx';

const TABS = [['pending_review', 'Flagged / review queue'], ['active', 'Live'], ['edited', 'Edited after approval'], ['rejected', 'Rejected'], ['removed', 'Removed'], ['all', 'All']];

export default function AdminListings() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') || 'pending_review';
  const page = Number(sp.get('page')) || 1;
  const q = sp.get('q') || '';
  const [qInput, setQInput] = useState(q);
  const { data, error, reload } = useFetch(`/admin/listings${qs({ status, page, q })}`);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n); };
  return (
    <>
      <Tabs value={status} onChange={(v) => set('status', v)} options={TABS} />
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); set('q', qInput.trim()); }}>
        <input className="field w-full max-w-sm" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Listing number or title" aria-label="Search listings" />
        <button className="btn btn-outline">Search</button>
      </form>
      {error ? <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div> : !data ? <Loading /> : (
        <>
          <p className="mt-4 text-sm text-muted">{data.total} listing{data.total === 1 ? '' : 's'}{status === 'pending_review' && data.total > 0 && ', oldest first'}</p>
          {data.items.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-line p-8 text-center text-muted">Nothing here.</p> : (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
              {data.items.map((l) => (
                <li key={l._id} className="flex gap-3 p-3">
                  {l.images[0] ? <img src={l.images[0].thumb} alt="" className="h-16 w-20 shrink-0 rounded object-cover" /> : <div className="h-16 w-20 shrink-0 rounded bg-line" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><StatusBadge status={l.status} /><span>{l.id}</span><span>{l.category}</span>{l.flags?.length > 0 && <span className="rounded bg-amber-100 px-1.5 text-amber-900">{[...new Set(l.flags.map((f) => f.code.replace(/_/g, ' ')))].join(', ')}</span>}{l.openReports > 0 && <span className="rounded bg-red-100 px-1.5 font-semibold text-red-800">{l.openReports} report{l.openReports > 1 ? 's' : ''}</span>}{l.editedAfterApprovalAt && <span className="rounded bg-amber-100 px-1.5 text-amber-900">edited {ago(l.editedAfterApprovalAt)}</span>}{l.sellerSuspended && <span className="rounded bg-red-800 px-1.5 text-white">seller suspended</span>}{l.autoPublished && <span className="rounded bg-line px-1.5">no review</span>}</div>
                    <p className="mt-0.5 truncate"><ListingLink l={l} /></p>
                    <p className="text-sm text-muted">{money(l.totalPrice)} · {l.locality} · {l.seller?.displayName} ({l.seller?.email}){l.submittedAt && ` · submitted ${ago(l.submittedAt)}`}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pager page={data.page} pages={data.pages} onPage={(p) => set('page', String(p))} />
        </>
      )}
    </>
  );
}
