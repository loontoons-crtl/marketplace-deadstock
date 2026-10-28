import { useEffect, useRef } from 'react';

// Fades and lifts its content in the first time it scrolls into view.
// `i` staggers siblings (70 ms apart). Content stays visible if IntersectionObserver is missing.
export default function Reveal({ as: Tag = 'div', i = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.dataset.shown = ''; return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.dataset.shown = ''; io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${className}`} style={{ '--i': i }} {...rest}>{children}</Tag>;
}
