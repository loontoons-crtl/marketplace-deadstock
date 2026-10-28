// Label + control + error message, wired for screen readers.
export default function Field({ label, name, error, hint, children, className = '' }) {
  const id = `f-${name}`;
  return (
    <div className={`text-sm ${className}`}>
      <label htmlFor={id} className="mb-1 block font-medium">{label}</label>
      {children({ id, name, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined, className: `field w-full ${error ? 'border-red-500' : ''}` })}
      {error ? <p id={`${id}-err`} className="mt-1 text-xs text-red-700">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
