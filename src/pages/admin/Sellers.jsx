import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { qs } from '../../lib/api.js';
import { useFetch } from '../../lib/useFetch.js';
import { ago, Pager, Tabs, Yes } from './ui.jsx';
import { bytes, dateIN } from '../../lib/format.js';

export const STATE_LABEL = { none: '—', trial: 'Trial', active: 'Paid', grace: 'Ended (grace)', expired: 'Ended (hidden)' };

export default function AdminSellers() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') || 'all';
  const page = Number(sp.get('page')) || 1;
  const q = sp.get('q') || '';
  const [qInput, setQInput] = useState(q);
  const { data, error, reload } = useFetch(`/admin/sellers${qs({ status: status === 'all' ? '' : status, page, q })}`);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n); };
  return (
    <>
      <Tabs value={status} onChange={(v) => set('status', v === 'all' ? '' : v)} options={[['all', 'All'], ['active', 'Active'], ['suspended', 'Suspended']]} />
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); set('q', qInput.trim()); }}>
        <input className="field w-full max-w-sm" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Name, email or phone" aria-label="Search sellers" />
        <button className="btn btn-outline">Search</button>
      </form>
      {error ? <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div> : !data ? <Loading /> : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs text-muted"><tr><th className="p-3 font-medium">Seller</th><th className="p-3 font-medium">Contact</th><th className="p-3 font-medium">Phone</th><th className="p-3 font-medium">Identity</th><th className="p-3 font-medium">Business</th><th className="p-3 font-medium">Plan</th><th className="p-3 font-medium">Storage</th><th className="p-3 font-medium">Listings</th><th className="p-3 font-medium">Joined</th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.items.map((u) => (
                  <tr key={u._id}>
                    <td className="p-3"><Link to={`/admin/sellers/${u._id}`} className="font-semibold underline">{u.profile?.displayName || u.name}</Link><div className="text-xs text-muted">{u.profile?.sellerType}{u.role === 'admin' && ' · admin'}{u.status === 'suspended' && <span className="font-semibold text-red-800"> · suspended</span>}</div></td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.phone} <Yes ok={u.phoneVerified} yes="" no="(unverified)" /></td>
                    <td className="p-3"><Yes ok={u.profile?.idVerified} yes="verified" no="—" /></td>
                    <td className="p-3"><Yes ok={u.profile?.bizVerified} yes="verified" no={u.profile?.gstin ? 'GSTIN given' : '—'} /></td>
                    <td className="p-3">{u.subscription?.state === 'none' ? <span className="text-muted">—</span> : <><span className={u.subscription.state === 'grace' || u.subscription.state === 'expired' ? 'font-semibold text-red-800' : ''}>{STATE_LABEL[u.subscription.state]}</span><div className="text-xs text-muted">{u.subscription.planName}{u.subscription.endsAt && ` · ends ${dateIN(u.subscription.endsAt)}`}</div></>}</td>
                    <td className="p-3 whitespace-nowrap">{bytes(u.subscription?.usedBytes || 0)}<span className="text-muted"> / {bytes(u.subscription?.allowanceBytes || 0)}</span></td>
                    <td className="p-3">{u.listingCount}</td>
                    <td className="p-3 text-muted">{ago(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.items.length === 0 && <p className="p-6 text-center text-muted">No sellers found.</p>}
          </div>
          <Pager page={data.page} pages={data.pages} onPage={(p) => set('page', String(p))} />
        </>
      )}
    </>
  );
}
