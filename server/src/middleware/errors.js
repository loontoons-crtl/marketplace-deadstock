import { ZodError } from 'zod';

export class HttpError extends Error {
  // code: optional machine-readable reason the frontend can act on (e.g. storage_full, subscription_required).
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

export const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

// Single place that turns errors into JSON. Never sends stack traces or internals to the client.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const i of err.issues) {
      const k = i.path.join('.') || '_';
      if (!fields[k]) fields[k] = i.message;
    }
    return res.status(400).json({ error: 'Please check the highlighted fields.', fields });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { fields: err.details } : {}), ...(err.code ? { code: err.code } : {}) });
  }
  if (err?.code === 11000) {
    const key = Object.keys(err.keyPattern || {})[0];
    const msg = key === 'email' ? 'An account with this email already exists.' : key === 'phone' ? 'An account with this phone number already exists.' : 'This record already exists.';
    return res.status(409).json({ error: msg, ...(key ? { fields: { [key]: msg } } : {}) });
  }
  if (err?.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is larger than 8 MB. Use a smaller photo.' : 'Upload one photo at a time using the photo field.';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: msg });
  }
  if (err?.name === 'CastError') return res.status(404).json({ error: 'Not found' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });

  console.error('[error]', req.method, req.originalUrl, err?.message);
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') console.error(err?.stack);
  return res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
