// Small fetch wrapper. Session cookie is httpOnly; the browser sends it automatically.
export class ApiError extends Error {
  constructor(status, message, fields, code) { super(message); this.status = status; this.fields = fields || {}; this.code = code; }
}

const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data.fields, data.code);
  return data;
}

export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

// Multipart upload of one file (field "photo"). The browser sets the Content-Type boundary.
// The Idempotency-Key lets the server recognise a retry of the same upload and not count it twice.
export async function uploadPhoto(path, file, key = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '')) {
  const fd = new FormData();
  fd.append('photo', file);
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method: 'POST', credentials: 'include', body: fd, headers: { 'Idempotency-Key': key } });
  } catch {
    throw new ApiError(0, 'Upload failed. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Upload failed (${res.status})`, data.fields, data.code);
  return data;
}
