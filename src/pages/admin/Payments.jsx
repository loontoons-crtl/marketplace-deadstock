import { Link, useSearchParams } from 'react-router-dom';
import { ErrorBox, Loading } from '../../components/States.jsx';
import { api, qs } from '../../lib/api.js';
import { bytes, rupees } from '../../lib/format.js';
import { useFetch } from '../../lib/useFetch.js';
import { dt, Pager, ReasonAction, Tabs } from './ui.jsx';

const TONE = { paid: 'text-forest', failed: 'text-red-800', refunded: 'text-muted', created: 'text-amber-800' };

export default function AdminPayments() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') || 'all';
  const page = Number(sp.get('page')) || 1;
  const { data, error, reload } = useFetch(`/admin/payments${qs({ status: status === 'all' ? '' : status, page })}`);
  return (
    <>
      <Tabs value={status} onChange={(v) => setSp(v === 'all' ? {} : { status: v })} options={[['all', 'All'], ['paid', 'Paid'], ['failed', 'Failed'], ['created', 'Started, not paid'], ['refunded', 'Refunded']]} />
      <p className="mt-3 text-xs text-muted">Razorpay payments are confirmed by signature and webhook. Offline payments are recorded from a seller's page. Refunds are issued in the Razorpay dashboard, then recorded here.</p>
      {error ? <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div> : !data ? <Loading /> : (
        <>
          <ul className="mt-4 space-y-2">
            {data.items.length === 0 && <li className="rounded-lg border border-dashed border-line p-8 text-center text-muted">No payments here.</li>}
            {data.items.map((p) => (
              <li key={p._id} className="rounded-lg border border-line bg-white p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p><b>{rupees(p.amount)}</b> · {p.item}{p.storageBytes ? ` (${bytes(p.storageBytes)})` : ''} · <span className={`font-semibold ${TONE[p.status]}`}>{p.status}</span> · {p.method === 'manual' ? 'offline' : 'Razorpay'}</p>
                  <p className="text-muted">{dt(p.paidAt || p.createdAt)}</p>
                </div>
                <p className="text-muted"><Link to={`/admin/sellers/${p.seller}`} className="underline">{p.sellerName}</Link> · {p.sellerEmail}{p.razorpayPaymentId && ` · ${p.razorpayPaymentId}`}{p.razorpayOrderId && ` · ${p.razorpayOrderId}`}{p.reference && ` · ref ${p.reference}`}</p>
                {(p.note || p.failureReason) && <p className="mt-1">{p.failureReason || p.note}</p>}
                {p.status === 'paid' && <div className="mt-2"><ReasonAction label="Record refund" min={5} prompt="What was refunded, and how? (recorded; this does not move money)" placeholder="e.g. Full refund issued in Razorpay on 20 Oct" onSubmit={async (note) => { await api(`/admin/payments/${p._id}/record-refund`, { method: 'POST', body: { note } }); reload(); }} /></div>}
              </li>
            ))}
          </ul>
          <Pager page={data.page} pages={data.pages} onPage={(n) => setSp({ ...(status !== 'all' ? { status } : {}), page: String(n) })} />
        </>
      )}
    </>
  );
}
