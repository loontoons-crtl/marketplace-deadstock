// Indian mobile numbers only for now: 10 digits starting 6-9, stored as +91XXXXXXXXXX.
export function normalizeIndianMobile(input) {
  if (typeof input !== 'string') return null;
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.startsWith('0091')) d = d.slice(4);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}
// "91XXXXXXXXXX" form used by tel: and wa.me links on the frontend.
export const phoneDigits = (e164) => (e164 ? e164.replace(/^\+/, '') : null);
export const maskPhone = (e164) => (e164 ? `${e164.slice(0, 3)} ••••• ${e164.slice(-4)}` : null);
