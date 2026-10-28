// Shared loading / error / empty blocks so every page handles them the same way.
export const Loading = ({ label = 'Loading…' }) => <p className="py-10 text-center text-sm text-muted" role="status">{label}</p>;

export const ErrorBox = ({ message, onRetry }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
    <p>{message}</p>
    {onRetry && <button className="mt-2 font-semibold underline" onClick={onRetry}>Try again</button>}
  </div>
);

export const SkeletonCards = ({ n = 4 }) => (
  <>{Array.from({ length: n }, (_, i) => <div key={i} aria-hidden="true"><div className="aspect-[4/5] animate-pulse rounded-md bg-sand" /><div className="space-y-2 pt-3.5"><div className="h-2.5 w-1/3 rounded bg-line" /><div className="h-4 w-4/5 rounded bg-line" /><div className="h-5 w-2/5 rounded bg-line" /></div></div>)}</>
);
