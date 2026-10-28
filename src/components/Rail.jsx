import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from './Icons.jsx';

// Horizontal, natively scrolling row with snap points. Arrow buttons appear on wide screens.
export default function Rail({ children, label, itemClass = 'w-[72%] sm:w-[44%] lg:w-[calc(25%-18px)]' }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = ref.current; if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useEffect(() => {
    update();
    const el = ref.current;
    const ro = 'ResizeObserver' in window ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [children]);
  const by = (dir) => {
    const el = ref.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? 'auto' : 'smooth' });
  };
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -top-14 right-0 hidden gap-2 lg:flex">
        <button type="button" onClick={() => by(-1)} disabled={edge.start} aria-label={`Scroll ${label} back`} className="btn btn-outline pointer-events-auto h-10 w-10 rounded-full p-0 disabled:opacity-30"><ArrowLeft width={18} height={18} /></button>
        <button type="button" onClick={() => by(1)} disabled={edge.end} aria-label={`Scroll ${label} forward`} className="btn btn-outline pointer-events-auto h-10 w-10 rounded-full p-0 disabled:opacity-30"><ArrowRight width={18} height={18} /></button>
      </div>
      <ul
        ref={ref}
        onScroll={update}
        aria-label={label}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 lg:mx-0 lg:gap-6 lg:scroll-px-0 lg:px-0"
        style={{ overscrollBehaviorX: 'contain' }}
      >
        {items.map((c, i) => <li key={c?.key ?? i} className={`shrink-0 snap-start ${itemClass}`}>{c}</li>)}
      </ul>
    </div>
  );
}
