import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ListingCard from '../components/ListingCard.jsx';
import { ErrorBox, SkeletonCards } from '../components/States.jsx';
import { api, qs } from '../lib/api.js';
import { useMeta } from '../lib/meta.jsx';

const PAGE = 12;
const KEYS = ['q', 'cat', 'locality', 'cond', 'brand', 'min', 'max', 'sort', 'near'];

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const { categories, localities, nearLocalities = [], conditions, brands } = useMeta();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState('loading'); // loading | more | ready | error
  const [error, setError] = useState(null);
  const g = (k) => sp.get(k) || '';
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n); };
  const key = KEYS.map(g).join('|');

  const fetchPage = (p, signal) => {
    const params = Object.fromEntries(KEYS.map((k) => [k, g(k)]));
    return api(`/listings${qs({ ...params, page: p, limit: PAGE })}`, { signal });
  };

  const needsOrigin = g('sort') === 'near' && !g('near');
  useEffect(() => {
    if (needsOrigin) { setItems([]); setTotal(0); setState('ready'); return undefined; }
    const ctl = new AbortController();
    setState('loading'); setError(null); setPage(1);
    fetchPage(1, ctl.signal)
      .then((d) => { setItems(d.items); setTotal(d.total); setState('ready'); })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setState('error'); } });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const more = async () => {
    setState('more');
    try { const d = await fetchPage(page + 1); setItems((x) => [...x, ...d.items]); setPage(page + 1); setState('ready'); }
    catch (e) { setError(e.message); setState('error'); }
  };

  const Sel = ({ k, label, opts, all }) => (
    <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>
      <select className="field w-full" value={g(k)} onChange={(e) => set(k, e.target.value)}>
        <option value="">{all}</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select></label>
  );
  const map = (a) => a.map((x) => ({ v: x, t: x }));
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[240px_1fr] lg:gap-10">
      <div className="lg:col-span-2">
        <p className="eyebrow text-olive">{g('q') ? `Results for “${g('q')}”` : 'Browse'}</p>
        <h1 className="serif-title mt-2 text-4xl sm:text-5xl">{categories.find((c) => c.slug === g('cat'))?.name || 'All materials'}</h1>
      </div>
      <aside className="space-y-4">
        <label className="block text-sm"><span className="mb-1 block font-medium">Search</span>
          <input key={`q-${g('q')}`} className="field w-full" defaultValue={g('q')} onKeyDown={(e) => e.key === 'Enter' && set('q', e.target.value)} onBlur={(e) => e.target.value !== g('q') && set('q', e.target.value)} placeholder="Product, brand, keyword" /></label>
        <Sel k="cat" label="Category" all="All categories" opts={categories.map((c) => ({ v: c.slug, t: c.name }))} />
        <Sel k="locality" label="Locality" all="All of Bengaluru" opts={map(localities)} />
        <Sel k="cond" label="Condition" all="Any condition" opts={map(conditions)} />
        <Sel k="brand" label="Brand" all="Any brand" opts={map(brands)} />
        <div className="text-sm"><span className="mb-1 block font-medium">Total price (₹)</span>
          <div className="flex gap-2">
            <input key={`min-${g('min')}`} className="field w-full" inputMode="numeric" placeholder="Min" defaultValue={g('min')} onBlur={(e) => set('min', e.target.value.replace(/\D/g, ''))} />
            <input key={`max-${g('max')}`} className="field w-full" inputMode="numeric" placeholder="Max" defaultValue={g('max')} onBlur={(e) => set('max', e.target.value.replace(/\D/g, ''))} />
          </div></div>
        <button className="btn btn-outline w-full" onClick={() => setSp({})}>Clear filters</button>
      </aside>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" aria-live="polite">{state === 'loading' ? 'Searching…' : `${total} ${total === 1 ? 'listing' : 'listings'}`}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select aria-label="Sort" className="field" value={g('sort') || (g('q') ? 'relevance' : 'newest')} onChange={(e) => {
              const n = new URLSearchParams(sp); n.set('sort', e.target.value);
              if (e.target.value === 'near' && !n.get('near') && nearLocalities.includes(g('locality'))) n.set('near', g('locality'));
              if (e.target.value !== 'near') n.delete('near');
              setSp(n);
            }}>
              {g('q') && <option value="relevance">Best match</option>}
              <option value="newest">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
              {nearLocalities.length > 0 && <option value="near">Nearest to a locality</option>}
            </select>
            {g('sort') === 'near' && (
              <select aria-label="Measure distance from" className="field" value={g('near')} onChange={(e) => set('near', e.target.value)}>
                <option value="">Distance from…</option>{nearLocalities.map((l) => <option key={l}>{l}</option>)}
              </select>
            )}
          </div>
        </div>
        {needsOrigin && <p className="mt-6 rounded-lg border border-dashed border-line p-6 text-center text-sm">Choose a locality to measure distance from.</p>}
        {state === 'error' ? <div className="mt-6"><ErrorBox message={error} onRetry={() => setSp(new URLSearchParams(sp))} /></div>
          : state === 'loading' ? <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 xl:grid-cols-3"><SkeletonCards n={6} /></div>
          : needsOrigin ? null
          : items.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-line p-10 text-center"><p className="font-semibold">No listings match these filters</p><p className="mt-1 text-sm text-muted">Remove a filter or search a broader term. Search matches whole words, such as “laminate” or “granite”.</p></div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 xl:grid-cols-3">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
              {items.length < total && <button className="btn btn-outline mt-6" onClick={more} disabled={state === 'more'}>{state === 'more' ? 'Loading…' : 'Load more'}</button>}
            </>
          )}
        {g('sort') === 'near' && g('near') && <p className="mt-6 text-xs text-muted">Distances are approximate, measured between locality centres. We never use a seller's exact address or your location.</p>}
      </section>
    </main>
  );
}
