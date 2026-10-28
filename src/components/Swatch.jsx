// Stand-in for product photography in Phase 1 (CSS-drawn material swatches).
export default function Swatch({ pattern, c, variant = 0, className = '', label }) {
  const [a, b] = variant % 2 ? [c[1], c[0]] : c;
  const bg = {
    wood: `repeating-linear-gradient(${90 + variant * 4}deg, ${a} 0 9px, ${b} 9px 11px, ${a} 11px 22px, ${b}99 22px 23px)`,
    louver: `repeating-linear-gradient(90deg, ${a} 0 16px, ${b} 16px 20px)`,
    tile: `linear-gradient(#0002 2px, transparent 2px) 0 0/50% 50%, linear-gradient(90deg, #0002 2px, transparent 2px) 0 0/50% 50%, ${a}`,
    stone: `linear-gradient(${115 + variant * 20}deg, transparent 46%, ${b}88 47%, transparent 49%), radial-gradient(circle at 30% 20%, #fff8, transparent 55%), ${a}`,
    plain: `linear-gradient(135deg, ${a}, ${b})`,
  }[pattern] || a;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: bg }} role="img" aria-label={label || 'Sample product image placeholder'}>
      <span className="absolute bottom-1.5 left-1.5 rounded bg-white/85 px-1.5 py-0.5 text-[11px] text-muted">Sample image</span>
    </div>
  );
}
