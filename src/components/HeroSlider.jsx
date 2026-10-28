import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Pause, Play } from './Icons.jsx';

// Editorial slides. Photos are mood images for each category, not listed products.
// Photography: Unsplash (free licence), self-hosted in /public/hero.
export const SLIDES = [
  {
    img: 'interior', short: 'Surfaces',
    eyebrow: 'Laminates · Veneers · Wall panels',
    title: ['Designer surfaces,', 'below MRP.'],
    body: 'End-of-range laminates, veneers and fluted panels, listed by Bengaluru dealers and manufacturers.',
    cta: { label: 'Explore surfaces', to: '/search?cat=laminates' },
    focus: '60% 50%',
  },
  {
    img: 'exterior', short: 'Exteriors',
    eyebrow: 'Cladding · Decking · Façades',
    title: ['The façade you', 'wanted, for less.'],
    body: 'Cladding and decking from cancelled orders and finished projects. Same material, a different price.',
    cta: { label: 'Explore exteriors', to: '/search?cat=cladding-decking' },
    focus: '50% 55%',
  },
  {
    img: 'bath', short: 'Bathrooms',
    eyebrow: 'Sanitaryware · Fittings · Tiles',
    title: ['Branded bathrooms,', 'without the markup.'],
    body: 'Boxed sanitaryware, fittings and tiles from showroom overstock and discontinued ranges.',
    cta: { label: 'Explore bathrooms', to: '/search?cat=sanitaryware' },
    focus: '45% 50%',
  },
  {
    img: 'terrace', short: 'Stone & floors',
    eyebrow: 'Marble · Granite · Flooring',
    title: ['Stone and flooring,', 'from the source.'],
    body: 'Slabs and boxes left over after the job was done. Inspect the batch, then deal with the seller directly.',
    cta: { label: 'Explore stone', to: '/search?cat=stone' },
    focus: '50% 50%',
  },
];

const DURATION = 7000;
const pad = (n) => String(n).padStart(2, '0');

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export default function HeroSlider({ children }) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false); // the pause button
  const [hoverPaused, setHoverPaused] = useState(false); // pointer over, or keyboard focus inside
  const [hidden, setHidden] = useState(false); // tab in the background
  const reduced = usePrefersReducedMotion();
  const drag = useRef(null);
  const n = SLIDES.length;

  const go = useCallback((i) => setIndex(((i % n) + n) % n), [n]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const autoplay = !reduced && !userPaused;
  const running = autoplay && !hoverPaused && !hidden;

  // Swipe: a quick flick counts even if it is short.
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e) => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    const v = Math.abs(dx) / Math.max(1, performance.now() - d.t);
    if (Math.abs(dx) > 60 || (Math.abs(dx) > 20 && v > 0.4)) (dx < 0 ? next : prev)();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured categories"
      className="relative isolate h-[min(86svh,860px)] min-h-[600px] select-none overflow-hidden bg-night text-white"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHoverPaused(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHoverPaused(false); }}
      onFocus={(e) => { if (e.target.matches?.(':focus-visible')) setHoverPaused(true); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoverPaused(false); }}
      onKeyDown={onKeyDown}
    >
      <div aria-live={running ? 'off' : 'polite'}>
        {SLIDES.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.img}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${s.short}`}
              aria-hidden={!active}
              data-active={active ? '' : undefined}
              className={`hero-slide absolute inset-0 ${active ? 'visible z-10 opacity-100' : 'invisible z-0 opacity-0'}`}
            >
              <img
                className="hero-img absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: s.focus }}
                src={`/hero/${s.img}-1920.webp`}
                srcSet={`/hero/${s.img}-960.webp 960w, /hero/${s.img}-1920.webp 1920w`}
                sizes="100vw"
                alt=""
                draggable="false"
                fetchpriority={i === 0 ? 'high' : 'low'}
                decoding="async"
              />
              {/* Scrim for legible text: darker at the bottom and, on wide screens, the left. */}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,14,12,.82)_0%,rgba(12,14,12,.35)_45%,rgba(12,14,12,.15)_100%)] lg:bg-[linear-gradient(to_right,rgba(12,14,12,.72)_0%,rgba(12,14,12,.3)_50%,rgba(12,14,12,0)_80%),linear-gradient(to_top,rgba(12,14,12,.55),transparent_45%)]" />
              <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-36 sm:pb-40 lg:justify-center lg:pb-16">
                <p className="eyebrow hero-rise text-white/75" style={{ '--i': 0 }}>{s.eyebrow}</p>
                <h1 className="serif-title mt-4 text-[44px] leading-[0.98] sm:text-7xl lg:text-[88px]">
                  {s.title.map((line, li) => (
                    <span key={line} className="hero-line block overflow-hidden pb-[0.08em]" style={{ '--i': li }}>
                      <span className={`block ${li === 1 ? 'italic text-white/90' : ''}`}>{line}</span>
                    </span>
                  ))}
                </h1>
                <p className="hero-rise mt-5 max-w-md text-base text-white/80 sm:text-lg" style={{ '--i': 1 }}>{s.body}</p>
                <div className="hero-rise mt-8 flex flex-wrap gap-3" style={{ '--i': 2 }}>
                  <Link to={s.cta.to} tabIndex={active ? 0 : -1} className="btn btn-light h-12 gap-2 rounded-full px-6">
                    {s.cta.label} <ArrowRight width={18} height={18} />
                  </Link>
                  <Link to="/search" tabIndex={active ? 0 : -1} className="btn btn-ghost-light h-12 rounded-full px-6">All materials</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="mx-auto flex max-w-6xl items-end gap-4 px-4 pb-6 sm:pb-8">
          <ol className="flex flex-1 gap-2 sm:gap-4">
            {SLIDES.map((s, i) => (
              <li key={s.img} className="flex-1">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show slide ${i + 1}: ${s.short}`}
                  aria-current={i === index ? 'true' : undefined}
                  className="group block w-full py-3 text-left"
                >
                  <span className="hidden pb-2 text-xs text-white/60 transition-colors group-hover:text-white sm:block">
                    <span className="font-serif text-sm text-white/80">{pad(i + 1)}</span>&ensp;{s.short}
                  </span>
                  <span className="relative block h-[2px] overflow-hidden rounded-full bg-white/25">
                    {i < index && <span className="absolute inset-0 bg-white/70" />}
                    {i === index && (
                      autoplay
                        ? <span
                            key={`p-${index}`}
                            className="hero-progress absolute inset-0 bg-white"
                            style={{ '--dur': `${DURATION}ms`, animationPlayState: running ? 'running' : 'paused' }}
                            onAnimationEnd={next}
                          />
                        : <span className="absolute inset-0 bg-white" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex shrink-0 items-center gap-2 pb-1">
            <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused || reduced ? 'Play slideshow' : 'Pause slideshow'} className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white disabled:opacity-40" disabled={reduced} title={reduced ? 'Autoplay is off because your device prefers reduced motion' : undefined}>
              {userPaused || reduced ? <Play width={16} height={16} /> : <Pause width={16} height={16} />}
            </button>
            <button type="button" onClick={prev} aria-label="Previous slide" className="btn btn-ghost-light h-11 w-11 rounded-full p-0"><ArrowLeft width={18} height={18} /></button>
            <button type="button" onClick={next} aria-label="Next slide" className="btn btn-ghost-light h-11 w-11 rounded-full p-0"><ArrowRight width={18} height={18} /></button>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
