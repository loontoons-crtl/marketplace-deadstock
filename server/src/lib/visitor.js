import crypto from 'node:crypto';
import { config } from '../config.js';

// Salted, one-way hash of IP + user agent so repeat clicks and reports can be grouped
// without storing anyone's IP address.
export const visitorHash = (req) =>
  crypto.createHmac('sha256', config.sessionSecret).update(`${req.ip}|${req.get('user-agent') || ''}`).digest('hex').slice(0, 32);
