import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeroSlider from '../components/HeroSlider.jsx';
import ListingCard from '../components/ListingCard.jsx';
import Rail from '../components/Rail.jsx';
import Reveal from '../components/Reveal.jsx';
import Swatch from '../components/Swatch.jsx';
import { ArrowRight, Search as SearchIcon } from '../components/Icons.jsx';
import { ErrorBox, SkeletonCards } from '../components/States.jsx';
import { api } from '../lib/api.js';
import { useMeta } from '../lib/meta.jsx';

// Category photography lives in /public/cat (Unsplash, free licence). Categories without a photo use a drawn swatch.
const CAT_PHOTOS = new Set(['laminates', 'veneers', 'louvers', 'tiles', 'stone', 'sanitaryware', 'lighting', 'furniture-hardware', 'cladding-decking']);
const FEATURED_ORDER = ['stone', 'laminates', 'sanitaryware', 'louvers', 'tiles', 'veneers', 'lighting', 'cladding-decking', 'furniture-hardware'];

const PROMISES = [
  ['Straight from the source', 'Dealers, distributors, manufacturers and contractors list their own stock. No resellers in between.'],
  ['See it before you pay', 'Check the batch, shade and packaging in person. Agree the price and pickup with the seller directly.'],
  ['No commission, ever', 'Call or WhatsApp the seller. We never take a cut of the sale, so the price you agree is the price you pay.'],
];

const WHY = [
  ['Cancelled projects', 'Material ordered for a job that changed scope or never started.'],
  ['Discontinued ranges', 'A design leaves the catalogue. The boxes on the shelf are as good as they were.'],
  ['Showroom overstock', 'Dealers over-order to hit targets, then need the space back.'],
];

function CategoryTile({ c, big = false, className = '' }) {
  return (
    <Link to={`/search?cat=${c.slug}`} className={`group relative block overflow-hidden rounded-md bg-sand ${className}`}>
      {CAT_PHOTOS.has(c.slug)
        ? <img src={`/cat/${c.slug}.webp`} alt="" loading="lazy" decoding="async" draggable="false" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]" />
        : <Swatch pattern={c.pattern} c={c.c} className="absolute inset-0 [&>span]:hidden" label="" />}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,14,12,.7),rgba(12,14,12,0)_55%)]" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white sm:p-5">
        <span className={`serif-title leading-[1.05] ${big ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>{c.name}</span>
        <span className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 transition-colors duration-300 group-hover:bg-white group-hover:text-ink"><ArrowRight width={16} height={16} /></span>
      </div>
    </Link>
  );
}

export default function Home() {
  const nav = useNavigate();
  const { categories, localities, pricing } = useMeta();
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);
  const load = () => { setError(null); api('/listings?limit=10&sort=newest').then((d) => setRecent(d.items)).catch((e) => setError(e.message)); };
  useEffect(load, []);

  const go = (e) => {
    e.preventDefault();
    const f = new FormData(e.target); const p = new URLSearchParams();
    if (f.get('q')) p.set('q', f.get('q'));
    if (f.get('locality')) p.set('locality', f.get('locality'));
    nav(`/search?${p}`);
  };

  const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const featured = FEATURED_ORDER.map((s) => bySlug[s]).filter(Boolean);
  const rest = categories.filter((c) => !FEATURED_ORDER.includes(c.slug));

  return (
    <main>
      <HeroSlider />

      {/* Search, overlapping the bottom of the hero */}
      <div className="relative z-30 mx-auto -mt-8 max-w-6xl px-4">
        <form onSubmit={go} role="search" className="fade-in flex flex-col gap-2 rounded-xl bg-white p-2 shadow-[0_24px_60px_-24px_rgba(20,24,21,.35)] ring-1 ring-black/5 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
            <SearchIcon className="shrink-0 text-muted" />
            <input name="q" aria-label="Search materials" placeholder="Search a material, brand or finish" className="h-12 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" enterKeyHint="search" />
          </label>
          <select name="locality" aria-label="Locality" className="h-12 rounded-md border-0 bg-paper px-3 sm:w-52">
            <option value="">All of Bengaluru</option>{localities.map((l) => <option key={l}>{l}</option>)}
          </select>
          <button className="btn btn-primary h-12 rounded-md px-7">Search</button>
        </form>
      </div>

      {/* Promises */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-20">
        <div className="grid gap-8 border-b border-line pb-14 sm:grid-cols-3 sm:gap-10">
          {PROMISES.map(([t, d], i) => (
            <Reveal key={t} i={i}>
              <p className="font-serif text-sm text-brass">0{i + 1}</p>
              <h2 className="mt-2 font-sans text-lg font-semibold tracking-normal">{t}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <Reveal className="flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-olive">Shop by material</p>
            <h2 className="serif-title mt-3 text-4xl leading-tight sm:text-5xl">Materials for every room,<br className="hidden sm:block" /> <span className="italic">and the outside too.</span></h2>
          </div>
          <Link to="/search" className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-forest sm:flex">All materials <ArrowRight width={16} height={16} /></Link>
        </Reveal>

        {/* Phones: swipeable row. Larger screens: editorial grid. */}
        <div className="mt-8 sm:hidden">
          <Rail label="Categories" itemClass="w-[68%]">
            {featured.map((c) => <CategoryTile key={c.slug} c={c} className="aspect-[4/5]" />)}
          </Rail>
        </div>
        <div className="mt-10 hidden auto-rows-[220px] grid-cols-3 gap-4 sm:grid lg:auto-rows-[240px] lg:grid-cols-4 lg:gap-5">
          {featured.map((c, i) => (
            <Reveal key={c.slug} i={i % 4} className={i === 0 ? 'col-span-2 row-span-2' : ''}>
              <CategoryTile c={c} big={i === 0} className="h-full" />
            </Reveal>
          ))}
        </div>
        {rest.length > 0 && (
          <p className="mt-6 text-sm text-muted">
            Also:{' '}
            {rest.map((c, i) => <span key={c.slug}>{i > 0 && ' · '}<Link to={`/search?cat=${c.slug}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-forest">{c.name}</Link></span>)}
          </p>
        )}
      </section>

      {/* New listings */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-olive">Just in</p>
              <h2 className="serif-title mt-3 text-4xl sm:text-5xl">New this week</h2>
            </div>
            <Link to="/search" className="flex shrink-0 items-center gap-2 text-sm font-semibold text-forest lg:mr-28">View all <ArrowRight width={16} height={16} /></Link>
          </Reveal>
          {error ? <ErrorBox message={error} onRetry={load} /> : recent && recent.length === 0 ? (
            <p className="text-muted">No live listings yet. Check back soon.</p>
          ) : (
            <Rail label="New listings">
              {recent ? recent.map((l) => <ListingCard key={l.id} l={l} />) : [<SkeletonCards key="s" n={1} />, <SkeletonCards key="t" n={1} />, <SkeletonCards key="u" n={1} />, <SkeletonCards key="v" n={1} />]}
            </Rail>
          )}
        </div>
      </section>

      {/* Why it costs less */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <Reveal className="relative aspect-[4/5] overflow-hidden rounded-md bg-sand lg:aspect-[5/6]">
          <img src="/hero/bath-960.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        </Reveal>
        <div>
          <Reveal>
            <p className="eyebrow text-olive">Why it costs less</p>
            <h2 className="serif-title mt-3 text-4xl leading-[1.05] sm:text-5xl">Same material.<br /><span className="italic">Different story.</span></h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">Good stock gets stranded all the time. Sellers would rather recover its value than store it for another year.</p>
          </Reveal>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {WHY.map(([t, d], i) => (
              <Reveal as="li" key={t} i={i + 1} className="grid gap-1 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
                <span className="font-semibold">{t}</span>
                <span className="text-muted">{d}</span>
              </Reveal>
            ))}
          </ul>
          <Reveal i={4}>
            <p className="mt-6 text-sm text-muted">Every listing states its condition: unused surplus, discontinued, opened packaging, used or damaged. Discounts are worked out from the MRP the seller enters.</p>
          </Reveal>
        </div>
      </section>

      {/* Sellers */}
      <section className="px-4 pb-4">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-xl bg-night text-white">
          <img src="/hero/exterior-960.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:p-16">
            <Reveal>
              <p className="eyebrow text-white/60">For dealers, manufacturers and contractors</p>
              <h2 className="serif-title mt-3 text-4xl leading-[1.05] sm:text-6xl">Turn stock on the shelf<br /><span className="italic">into cash in hand.</span></h2>
              <p className="mt-5 max-w-lg text-white/75">One annual plan{pricing?.fromPrice ? ` from ₹${pricing.fromPrice.toLocaleString('en-IN')} a year` : ''}. Unlimited listings within your storage, no commission on your sales, and buyers who call you directly.</p>
            </Reveal>
            <Reveal i={1} className="flex flex-wrap gap-3 lg:justify-end">
              <Link to="/sell" className="btn btn-light h-12 rounded-full px-6">Start your free {pricing?.trialDays || 30}-day trial</Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 md:grid-cols-2">
        <Reveal>
          <h2 className="serif-title text-3xl">How buying works</h2>
          <ol className="mt-5 space-y-4">
            {['Search by material, brand or locality.', 'Check photos, specifications, condition and quantity.', 'Call or WhatsApp the seller. Agree payment, inspection and pickup directly.'].map((t, i) => (
              <li key={t} className="flex gap-4"><span className="font-serif text-lg text-brass">{i + 1}</span><span className="pt-0.5 text-muted">{t}</span></li>
            ))}
          </ol>
        </Reveal>
        <Reveal i={1}>
          <h2 className="serif-title text-3xl">Buy with care</h2>
          <p className="mt-5 leading-relaxed text-muted">Each seller shows phone, identity and business verification separately, so you can see what has been checked. Inspect stock before paying, and use Report listing on anything that looks wrong. We don't hold money or guarantee sales.</p>
        </Reveal>
      </section>
    </main>
  );
}
