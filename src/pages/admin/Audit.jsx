import { useSearchParams } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { qs } from '../../lib/api.js';
import { useFetch } from '../../lib/useFetch.js';
import { dt, Pager, Tabs } from './ui.jsx';

const summary = (d = {}) => [d.reason, d.note, d.method, d.item, d.amountReceived != null && `received ₹${d.amountReceived}`, d.reference, d.changed && `changed: ${d.changed.join(', ')}`, d.after && `now ₹${d.after.annualPrice}, ${d.after.storageMB} MB, ${d.after.active ? 'on sale' : 'off sale'}`].filter(Boolean).join(' · ');

export default function AdminAudit() {
  const [sp, setSp] = useSearchParams();
  const type = sp.get('type') || 'all';
  const page = Number(sp.get('page')) || 1;
  const { data, error, reload } = useFetch(`/admin/audit${qs({ type: type === 'all' ? '' : type, page })}`);
  return (
    <>
      <Tabs value={type} onChange={(v) => setSp(v === 'all' ? {} : { type: v })} options={[['all', 'All'], ['listing', 'Listings'], ['user', 'Sellers'], ['report', 'Reports'], ['category', 'Categories'], ['locality', 'Localities'], ['pricing', 'Plans'], ['settings', 'Settings']]} />
      <p className="mt-3 text-xs text-muted">Every admin action is recorded here and can't be edited from the app.</p>
      {error ? <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div> : !data ? <Loading /> : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs text-muted"><tr><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Admin</th><th className="p-3 font-medium">Action</th><th className="p-3 font-medium">On</th><th className="p-3 font-medium">Details</th></tr></thead>
              <tbody className="divide-y divide-line">{data.items.map((a) => <tr key={a._id}><td className="whitespace-nowrap p-3 text-muted">{dt(a.at)}</td><td className="p-3">{a.admin}</td><td className="p-3 font-mono text-xs">{a.action}</td><td className="p-3">{a.targetLabel}</td><td className="p-3">{summary(a.details)}</td></tr>)}</tbody>
            </table>
            {data.items.length === 0 && <p className="p-6 text-center text-muted">No actions recorded yet.</p>}
          </div>
          <Pager page={data.page} pages={data.pages} onPage={(p) => setSp({ ...(type !== 'all' ? { type } : {}), page: String(p) })} />
        </>
      )}
    </>
  );
}
