import { STATUS_LABEL } from '../../lib/format.js';

const TONE = {
  draft: 'bg-line text-ink', pending_review: 'bg-amber-100 text-amber-900', pending_payment: 'bg-forest text-white',
  active: 'bg-forest text-white', reserved: 'bg-olive/20 text-olive', sold: 'bg-ink text-white', unavailable: 'bg-line text-muted',
  rejected: 'bg-red-100 text-red-800', expired: 'bg-line text-muted', removed: 'bg-red-800 text-white',
};
export default function StatusBadge({ status }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${TONE[status] || 'bg-line'}`}>{STATUS_LABEL[status] || status}</span>;
}
