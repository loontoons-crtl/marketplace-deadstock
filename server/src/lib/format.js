export function formatBytes(n) {
  if (!n) return '0 MB';
  const gb = n / 1024 ** 3;
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  return `${Math.round(n / 1024 ** 2)} MB`;
}
