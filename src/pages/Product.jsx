import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Swatch from '../components/Swatch.jsx';
import ListingCard from '../components/ListingCard.jsx';
import Rail from '../components/Rail.jsx';
import ReportForm from '../components/ReportForm.jsx';
import { ArrowLeft, ArrowRight, Chat, Check, Dash, Phone } from '../components/Icons.jsx';
import { ErrorBox, Loading } from '../components/States.jsx';
import { api, qs } from '../lib/api.js';
import { useMeta } from '../lib/meta.jsx';
import { daysAgo, discountPct, money, num, unitPrice, waLink } from '../lib/format.js';

const FALLBACK = { slug: '', name: 'Listings', pattern: 'plain', c: ['#BDB6A6', '#9D9684'] };

function Gallery({ images, title, cat, isSample }) {
  const [view, setView] = useState(0);
  const drag = useRef(null);
  const n = images.length;
  if (!n) {
    return (
      <div>
        <Swatch pattern={cat.pattern} c={cat.c} className="aspect-[4/3] rounded-md" />
        <p className="mt-2 text-xs text-muted">{isSample ? 'Sample listing: placeholder image.' : 'No photos for this listing.'}</p>
      </div>
    );
  }
  const go = (i) => setView(((i % n) + n) % n);
  const onUp = (e) => {
    const d = drag.current; drag.current = null;
    if (!d || n < 2) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - d.y)) go(view + (dx < 0 ? 1 : -1));
  };
  return (
    <div>
      <div
        className="group relative overflow-hidden rounded-md bg-sand"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={onUp}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(view + 1); if (e.key === 'ArrowLeft') go(view - 1); }}
      >
        <img key={view} src={images[view].url} alt={`${title}, photo ${view + 1} of ${n}`} draggable="false" className="fade-in aspect-[4/3] w-full select-none object-contain" />
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(view - 1)} aria-label="Previous photo" className="btn absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/85 p-0 text-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-sm:hidden"><ArrowLeft width={18} height={18} /></button>
            <button type="button" onClick={() => go(view + 1)} aria-label="Next photo" className="btn absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/85 p-0 text-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-sm:hidden"><ArrowRight width={18} height={18} /></button>
            <span className="absolute bottom-3 right-3 rounded-full bg-night/70 px-2.5 py-1 text-xs tabular-nums text-white">{view + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button key={img.url} type="button" onClick={() => setView(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={view === i}
              className={`w-20 shrink-0 overflow-hidden rounded transition-opacity ${view === i ? 'opacity-100 ring-2 ring-forest ring-offset-2 ring-offset-paper' : 'opacity-60 hover:opacity-100'}`}>
              <img src={img.thumb || img.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Verified = ({ ok, children }) => (
  <li className="flex items-center gap-2.5">
    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${ok ? 'bg-forest text-white' : 'bg-line text-muted'}`}>{ok ? <Check width={13} height={13} strokeWidth={2.2} /> : <Dash width={13} height={13} strokeWidth={2.2} />}</span>
    <span className={ok ? '' : 'text-muted'}>{children}</span>
  </li>
);

export default function Product() {
  const { id } = useParams();
  const { catBySlug } = useMeta();
  const [l, setL] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [related, setRelated] = useState([]);
  const [reporting, setReporting] = useState(false);

  const load = () => {
    setState('loading'); setReporting(false);
    api(`/listings/${encodeURIComponent(id)}`)
      .then((d) => { setL(d.listing); setState('ready'); return api(`/listings${qs({ cat: d.listing.cat, exclude: d.listing.id, limit: 8 })}`); })
      .then((d) => setRelated(d.items))
      .catch((e) => { setError(e); setState(e.status === 404 ? 'missing' : 'error'); });
  };
  useEffect(load, [id]);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  if (state === 'loading') return <main className="mx-auto max-w-6xl px-4 py-8"><Loading /></main>;
  if (state === 'missing') return <main className="mx-auto max-w-2xl px-4 py-20"><h1 className="serif-title text-4xl">Listing not available</h1><p className="mt-3 text-muted">It may have sold or been removed.</p><Link to="/search" className="btn btn-outline mt-6">Browse materials</Link></main>;
  if (state === 'error') return <main className="mx-auto max-w-2xl px-4 py-16"><ErrorBox message={error.message} onRetry={load} /></main>;

  const cat = catBySlug(l.cat) || FALLBACK;
  const up = unitPrice(l);
  const off = discountPct(l);
  const rows = [l.brand && ['Brand', l.brand], l.model && ['Model', l.model], ['Condition', l.condition], ['Quantity', l.unit === 'lot' ? 'Single stock lot' : `${num(l.qty)} ${l.unit}`], l.minOrder && ['Minimum order', `${num(l.minOrder)} ${l.unit}`], ...Object.entries(l.specs), l.pickup && ['Pickup and delivery', l.pickup]].filter(Boolean);
  const track = (channel) => { api(`/listings/${encodeURIComponent(l.id)}/contact`, { method: 'POST', body: { channel } }).catch(() => {}); };
  const s = l.seller || {};
  const contact = s.phone ? {
    call: { href: `tel:+${s.phone}`, onClick: () => track('call') },
    wa: { href: waLink(s.phone, l.title), target: '_blank', rel: 'noopener noreferrer', onClick: () => track('whatsapp') },
  } : null;

  return (
    <main className={`mx-auto max-w-6xl px-4 pt-6 ${contact ? 'pb-28 lg:pb-8' : 'pb-8'}`}>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link to="/search" className="hover:text-ink">Materials</Link><span className="mx-2 text-line">/</span><Link to={`/search?cat=${cat.slug}`} className="hover:text-ink">{cat.name}</Link>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <Gallery images={l.images} title={l.title} cat={cat} isSample={l.isSample} />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow text-olive">{[l.brand, l.condition].filter(Boolean).join(' · ')}</p>
          <h1 className="serif-title mt-3 text-4xl leading-[1.05] sm:text-[44px]">{l.title}</h1>
          <p className="mt-3 text-sm text-muted">{l.locality}, {l.city} · Updated {daysAgo(l.updated)} · {l.id}</p>
          {l.status === 'reserved' && <p className="mt-4 rounded-md bg-olive/10 px-3 py-2 text-sm font-medium text-olive">Reserved by another buyer. You can still enquire.</p>}

          <div className="mt-6 border-y border-line py-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[34px] font-semibold leading-none tabular-nums">{money(l.total)}</span>
              {off != null && <span className="text-lg tabular-nums text-muted line-through decoration-muted/60">{money(l.mrp)}</span>}
              {off != null && <span className="rounded-full bg-forest px-2.5 py-1 text-xs font-semibold text-white">{off}% below MRP</span>}
            </div>
            <p className="mt-2 text-sm text-muted">
              Total asking price{l.unit === 'lot' ? ' for the lot' : ` for ${num(l.qty)} ${l.unit}`}{up && ` · ${up}`}
            </p>
            {off != null && <p className="mt-1 text-sm text-forest">You save {money(l.mrp - l.total)} against the seller's stated MRP.</p>}
          </div>

          {contact ? (
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              <a className="btn btn-primary h-12 gap-2 rounded-full" {...contact.call}><Phone width={18} height={18} />Call seller</a>
              <a className="btn btn-outline h-12 gap-2 rounded-full" {...contact.wa}><Chat width={18} height={18} />WhatsApp</a>
            </div>
          ) : (
            <p className="mt-6 rounded-md bg-white p-4 text-sm text-muted ring-1 ring-line">{l.isSample ? 'This is a sample listing, so no seller phone number is shown.' : 'The seller has not published a phone number for this listing.'}</p>
          )}

          <div className="mt-6 rounded-md bg-white p-5 text-sm ring-1 ring-line">
            <p className="eyebrow text-muted">Sold by</p>
            <p className="mt-2 text-base font-semibold">{s.name} <span className="font-normal text-muted">· {s.type}</span></p>
            <ul className="mt-4 space-y-2.5">
              <Verified ok={s.phoneVerified}>Phone {s.phoneVerified ? 'verified by OTP' : 'not verified'}</Verified>
              <Verified ok={s.idVerified}>Identity {s.idVerified ? 'verified' : 'not verified'}</Verified>
              <Verified ok={s.bizVerified}>Business {s.bizVerified ? 'verified' : 'not verified'}</Verified>
            </ul>
            {l.isSample && <p className="mt-3 text-xs text-muted">Sample seller. Verification labels are demonstration values.</p>}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">Inspect the stock before you pay. Payment, pickup and delivery are agreed directly with the seller.</p>
          {reporting ? <ReportForm listingId={l.id} onClose={() => setReporting(false)} /> : <button className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink" onClick={() => setReporting(true)}>Report listing</button>}
        </div>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <div>
          {l.desc && <>
            <h2 className="serif-title text-3xl">About this stock</h2>
            <p className="mt-4 max-w-prose whitespace-pre-line leading-relaxed text-muted">{l.desc}</p>
          </>}
          <h2 className={`serif-title text-3xl ${l.desc ? 'mt-12' : ''}`}>Specifications</h2>
          <dl className="mt-4 divide-y divide-line border-y border-line text-[15px]">
            {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[140px_1fr] gap-4 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <div className="mb-8">
            <p className="eyebrow text-olive">{cat.name}</p>
            <h2 className="serif-title mt-3 text-4xl">More like this</h2>
          </div>
          <Rail label="Related listings">{related.map((x) => <ListingCard key={x.id} l={x} />)}</Rail>
        </section>
      )}

      {/* Phones: contact stays within thumb reach */}
      {contact && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pt-3 backdrop-blur-md lg:hidden" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tabular-nums">{money(l.total)}{off != null && <span className="ml-2 font-normal text-muted line-through">{money(l.mrp)}</span>}</p>
              <p className="truncate text-xs text-muted">{s.name}</p>
            </div>
            <a className="btn btn-outline h-11 w-11 rounded-full p-0" aria-label="WhatsApp seller" {...contact.wa}><Chat width={18} height={18} /></a>
            <a className="btn btn-primary h-11 gap-2 rounded-full px-5" {...contact.call}><Phone width={18} height={18} />Call</a>
          </div>
        </div>
      )}
    </main>
  );
}
