import { User } from '../models/User.js';
import { HttpError } from './errors.js';

// Loads the logged-in user from the session on every request, so a suspension
// or role change takes effect immediately. The frontend never supplies the user ID.
export async function loadUser(req, res, next) {
  req.user = null;
  const id = req.session?.userId;
  if (!id) return next();
  const user = await User.findById(id);
  if (!user || user.status !== 'active') {
    req.session.userId = null;
    return next();
  }
  req.user = user;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please log in to continue.'));
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please log in to continue.'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this.'));
  next();
};
