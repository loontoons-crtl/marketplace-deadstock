import { Link } from 'react-router-dom';
import Swatch from './Swatch.jsx';
import { useMeta } from '../lib/meta.jsx';
import { discountPct, money, num, unitPrice } from '../lib/format.js';

const FALLBACK = { pattern: 'plain', c: ['#BDB6A6', '#9D9684'], name: '' };

export default function ListingCard({ l, className = '' }) {
  const { catBySlug } = useMeta();
  const cat = catBySlug(l.cat) || FALLBACK;
  const up = unitPrice(l);
  const off = discountPct(l);
  const cover = l.images?.[0];
  return (
    <Link to={`/product/${l.id}`} className={`group block select-none transition-transform duration-150 ease-out active:scale-[0.985] ${className}`}>
      <div className="relative overflow-hidden rounded-md bg-sand">
        {cover
          ? <img
              src={cover.thumb || cover.url}
              srcSet={cover.thumb ? `${cover.thumb} 640w, ${cover.url} 1600w` : undefined}
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 80vw"
              alt=""
              loading="lazy"
              decoding="async"
              width="640" height="800"
              draggable="false"
              className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          : <Swatch pattern={cat.pattern} c={cat.c} className="aspect-[4/5] transition-transform duration-700 ease-out group-hover:scale-[1.04]" />}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {off != null && off >= 5 ? <span className="rounded-full bg-forest px-2.5 py-1 text-xs font-semibold text-white">{off}% below MRP</span> : <span />}
          {l.status === 'reserved' && <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink">Reserved</span>}
        </div>
      </div>
      <div className="pt-3.5">
        <p className="eyebrow truncate text-muted">{l.brand || cat.name}</p>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug text-ink transition-colors group-hover:text-forest">{l.title}</h3>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-semibold tabular-nums">{money(l.total)}</span>
          {off != null && <span className="text-sm tabular-nums text-muted line-through decoration-muted/60">{money(l.mrp)}</span>}
        </p>
        <p className="mt-0.5 text-[13px] text-muted">
          {l.unit === 'lot' ? 'Single stock lot' : `${num(l.qty)} ${l.unit}`}{up && ` · ${up}`}
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {l.condition} · {l.locality}
          {l.distanceKm != null && <span> · {l.distanceKm < 1 ? 'under 1 km' : `about ${Math.round(l.distanceKm)} km`}</span>}
        </p>
      </div>
    </Link>
  );
}
