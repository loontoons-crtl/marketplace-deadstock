import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import Field from '../components/Field.jsx';
import { useAuth } from '../lib/auth.jsx';

// Only allow redirects to paths on this site.
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard');

export default function Login() {
  const { user, login } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  if (user) return <Navigate to={safeNext(sp.get('next'))} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setBusy(true); setError(null); setFields({});
    try { await login(f.get('identifier').trim(), f.get('password')); nav(safeNext(sp.get('next')), { replace: true }); }
    catch (err) { setError(err.message); setFields(err.fields || {}); }
    finally { setBusy(false); }
  };
  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-3xl font-bold">Seller login</h1>
      <p className="mt-2 text-sm text-muted">Buyers don't need an account. This is for sellers managing listings.</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-line bg-white p-5" noValidate>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-800" role="alert">{error}</p>}
        <Field label="Email or mobile number" name="identifier" error={fields.identifier}>{(p) => <input {...p} autoComplete="username" required />}</Field>
        <Field label="Password" name="password" error={fields.password}>{(p) => <input {...p} type="password" autoComplete="current-password" required />}</Field>
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="text-xs text-muted">Forgot your password? Password reset arrives before launch. For now, contact support.</p>
      </form>
      <p className="mt-4 text-sm">New seller? <Link to="/register" className="font-semibold text-forest underline">Create an account</Link></p>
    </main>
  );
}
