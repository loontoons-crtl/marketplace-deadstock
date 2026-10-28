import { config } from '../config.js';

// CSRF defence for cookie sessions. Browsers send an Origin header on cross-site
// state-changing requests; reject any that is not on our allowlist.
// Combined with SameSite=Lax cookies and JSON-only bodies.
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function checkOrigin(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // non-browser clients (curl, server jobs) cannot carry a victim's cookie
  if (config.clientOrigins.includes(origin)) return next();
  return res.status(403).json({ error: 'Request origin not allowed' });
}
