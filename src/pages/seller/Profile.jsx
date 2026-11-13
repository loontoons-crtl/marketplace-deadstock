import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Field from '../../components/Field.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useMeta } from '../../lib/meta.jsx';

function PhoneVerify() {
  const { user, setUser } = useAuth();
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [justVerified, setJustVerified] = useState(false);
  if (user.phoneVerified) return <p className="text-sm"><span className="font-semibold text-forest">✓ Verified</span> {user.phone}{justVerified && <span className="mt-2 block rounded bg-forest/10 p-2 text-forest">Your free trial has started. <Link to="/dashboard/subscription" className="font-semibold underline">See your plan</Link></span>}</p>;
  const send = async () => {
    setBusy(true); setError(null);
    try { const d = await api('/auth/phone/send-otp', { method: 'POST' }); setSent(true); setNote(d.devNote || `Code sent to ${user.phone}. It expires in 10 minutes.`); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { const d = await api('/auth/phone/verify', { method: 'POST', body: { code: new FormData(e.target).get('code').trim() } }); setJustVerified(true); setUser(d.user); }
    catch (err) { setError(err.fields?.code || err.message); } finally { setBusy(false); }
  };
  return (
    <div className="text-sm">
      <p>{user.phone} <span className="text-muted">— not verified</span></p>
      {!sent ? <button className="btn btn-primary mt-3" onClick={send} disabled={busy}>Send verification code</button> : (
        <form onSubmit={verify} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm"><span className="mb-1 block font-medium">6-digit code</span><input name="code" className="field w-36 tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
          <button className="btn btn-primary" disabled={busy}>Verify</button>
          <button type="button" className="btn btn-outline" onClick={send} disabled={busy}>Resend</button>
        </form>
      )}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
      {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
    </div>
  );
}

function DeleteAccountSection() {
  const { deleteAccount } = useAuth();
  const nav = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      nav('/?account_deleted=1', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not delete account. Please try again.');
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-red-200 bg-red-50/50 p-5 text-sm">
      <h2 className="text-lg font-bold text-red-950">Danger zone</h2>
      <p className="mt-1 text-xs text-red-800 leading-relaxed">
        Permanently delete your account, seller profile, active listings, and all uploaded photo files. This cannot be undone.
      </p>
      {error && <p className="mt-2 rounded bg-red-100 p-2 text-xs text-red-900" role="alert">{error}</p>}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-md border border-red-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
        >
          Delete account
        </button>
      ) : (
        <div className="mt-4 rounded-md border border-red-300 bg-white p-3.5 text-xs space-y-2">
          <p className="font-semibold text-red-900">Are you sure you want to permanently delete your account?</p>
          <p className="text-muted">All your listings will be removed from the marketplace immediately.</p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Yes, delete my account'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="btn btn-outline text-xs px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const { sellerTypes, localities } = useMeta();
  const [sp] = useSearchParams();
  const p = user.profile || {};
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});

  const save = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { displayName: f.get('displayName').trim(), sellerType: f.get('sellerType'), businessName: f.get('businessName').trim(), gstin: f.get('gstin').trim(), locality: f.get('locality'), about: f.get('about').trim(), showContact: f.get('showContact') === 'on' };
    setBusy(true); setMsg(null); setError(null); setFields({});
    try { const d = await api('/seller/profile', { method: 'PATCH', body }); setUser(d.user); setMsg('Profile saved.'); }
    catch (err) { setError(err.message); setFields(err.fields || {}); } finally { setBusy(false); }
  };

  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-6">
        {sp.get('welcome') && <p className="rounded-lg bg-forest p-4 text-sm text-white">Account created. Verify your mobile number next: it starts your free trial and is needed before you add photos.</p>}
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Mobile verification</h2>
          <p className="mt-1 mb-3 text-xs text-muted">Buyers call or WhatsApp this number. Only OTP-verified numbers are ever shown.</p>
          <PhoneVerify />
        </section>
        <section className="rounded-lg border border-line bg-white p-5 text-sm">
          <h2 className="text-lg font-bold">Verification by our team</h2>
          <p className="mt-2">Identity: {p.idVerified ? <span className="font-semibold text-forest">verified</span> : 'not yet verified'}</p>
          <p>Business: {p.bizVerified ? <span className="font-semibold text-forest">verified</span> : 'not yet verified'}</p>
          <p className="mt-2 text-xs text-muted">Our team checks these separately. Identity: a short phone or video call. Business: your GSTIN (add it in the form) or another registration such as Udyam. We don't ask you to upload ID documents.</p>
        </section>
        <section className="rounded-lg border border-line bg-white p-5 text-sm">
          <h2 className="text-lg font-bold">Account</h2>
          <p className="mt-2 font-medium">{user.name}</p>
          <p className="text-muted">{user.email}</p>
          {user.phone && <p className="text-muted">{user.phone}</p>}
          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
            <span className="text-xs text-muted">Signed in</span>
            <button
              type="button"
              onClick={async () => { await logout(); nav('/'); }}
              className="btn btn-outline text-xs px-3 py-1.5"
            >
              Log out
            </button>
          </div>
        </section>
        <DeleteAccountSection />
      </div>

      <form onSubmit={save} className="space-y-4 rounded-lg border border-line bg-white p-5" noValidate>
        <h2 className="text-lg font-bold">Seller profile</h2>
        {msg && <p className="rounded bg-forest/10 p-2 text-sm text-forest" role="status">{msg}</p>}
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-800" role="alert">{error}</p>}
        <Field label="Name shown to buyers" name="displayName" error={fields.displayName}>{(x) => <input {...x} defaultValue={p.displayName} maxLength={100} required />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seller type" name="sellerType" error={fields.sellerType}>{(x) => <select {...x} defaultValue={p.sellerType}>{sellerTypes.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
          <Field label="Locality" name="locality" error={fields.locality}>{(x) => <select {...x} defaultValue={p.locality}><option value="">Choose</option>{localities.map((l) => <option key={l}>{l}</option>)}</select>}</Field>
        </div>
        <Field label="Registered business name (optional)" name="businessName" error={fields.businessName}>{(x) => <input {...x} defaultValue={p.businessName} maxLength={120} />}</Field>
        <Field label="GSTIN (optional)" name="gstin" error={fields.gstin} hint="Used for business verification. Not shown to buyers.">{(x) => <input {...x} defaultValue={p.gstin} maxLength={15} className={`${x.className} uppercase`} />}</Field>
        <Field label="About your business (optional)" name="about" error={fields.about}>{(x) => <textarea {...x} rows={3} defaultValue={p.about} maxLength={1000} />}</Field>
        <label className="flex items-start gap-3 rounded-md border border-line p-3 text-sm">
          <input type="checkbox" name="showContact" defaultChecked={p.showContact} className="mt-1 h-4 w-4 accent-forest" />
          <span><span className="font-semibold">Show my verified mobile number on my live listings.</span><br /><span className="text-muted">Buyers will see it on Call and WhatsApp buttons. Required before submitting a listing. You can turn this off at any time, which hides the buttons.</span></span>
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
    </div>
  );
}
