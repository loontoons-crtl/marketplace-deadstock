import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const refresh = useCallback(async () => {
    try { const d = await api('/auth/me'); setUser(d.user); } catch { setUser(null); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (identifier, password) => { const d = await api('/auth/login', { method: 'POST', body: { identifier, password } }); setUser(d.user); return d.user; };
  const register = async (form) => { const d = await api('/auth/register', { method: 'POST', body: form }); setUser(d.user); return d.user; };
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); };
  const deleteAccount = async () => { await api('/seller/profile', { method: 'DELETE' }); setUser(null); };
  return <AuthCtx.Provider value={{ user, setUser, refresh, login, register, logout, deleteAccount }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function RequireAuth({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) return <main className="mx-auto max-w-6xl px-4 py-16 text-muted">Loading…</main>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return children;
}

// Hides admin screens from non-admins. The server enforces the same rule on every admin API call.
export function RequireAdmin({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) return <main className="mx-auto max-w-6xl px-4 py-16 text-muted">Loading…</main>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (user.role !== 'admin') return <main className="mx-auto max-w-2xl px-4 py-16"><h1 className="text-2xl font-bold">No access</h1><p className="mt-2 text-muted">This area is for marketplace administrators.</p></main>;
  return children;
}
