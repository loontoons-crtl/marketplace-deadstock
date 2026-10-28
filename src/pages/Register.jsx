import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Field from '../components/Field.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useMeta } from '../lib/meta.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const { sellerTypes } = useMeta();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const local = {};
    if (form.password.length < 8) local.password = 'Use at least 8 characters.';
    if (form.password !== form.confirm) local.confirm = 'Passwords do not match.';
    if (Object.keys(local).length) { setFields(local); return; }
    delete form.confirm;
    setBusy(true); setError(null); setFields({});
    try { await register(form); nav('/dashboard/profile?welcome=1', { replace: true }); }
    catch (err) { setError(err.message); setFields(err.fields || {}); }
    finally { setBusy(false); }
  };
  return (
    <main className="mx-auto max-w-lg px-4 py-14">
      <h1 className="text-3xl font-bold">Create a seller account</h1>
      <p className="mt-2 text-sm text-muted">Free to register. Your free trial starts when you verify your mobile number; after that, one annual plan covers all your listings.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2" noValidate>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-800 sm:col-span-2" role="alert">{error}</p>}
        <Field label="Your name" name="name" error={fields.name} className="sm:col-span-2">{(p) => <input {...p} autoComplete="name" required />}</Field>
        <Field label="Business name (optional)" name="businessName" error={fields.businessName} className="sm:col-span-2" hint="Shown to buyers instead of your name, if given.">{(p) => <input {...p} autoComplete="organization" />}</Field>
        <Field label="Email" name="email" error={fields.email}>{(p) => <input {...p} type="email" autoComplete="email" required />}</Field>
        <Field label="Mobile number" name="phone" error={fields.phone} hint="10-digit Indian mobile. Verified by OTP.">{(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98450 12345" required />}</Field>
        <Field label="Seller type" name="sellerType" error={fields.sellerType} className="sm:col-span-2">{(p) => <select {...p} required defaultValue=""><option value="" disabled>Choose one</option>{sellerTypes.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
        <Field label="Password" name="password" error={fields.password} hint="At least 8 characters.">{(p) => <input {...p} type="password" autoComplete="new-password" required />}</Field>
        <Field label="Confirm password" name="confirm" error={fields.confirm}>{(p) => <input {...p} type="password" autoComplete="new-password" required />}</Field>
        <button className="btn btn-primary sm:col-span-2" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-sm">Already registered? <Link to="/login" className="font-semibold text-forest underline">Log in</Link></p>
    </main>
  );
}
