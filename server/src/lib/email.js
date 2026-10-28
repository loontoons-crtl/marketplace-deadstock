import { config } from '../config.js';

export const testEmails = [];

// Development: emails are printed. A real provider (e.g. Amazon SES, Postmark) is connected before launch.
export async function sendEmail(to, subject, text) {
  if (config.isTest) { testEmails.push({ to, subject, text }); return true; }
  if (config.emailProvider === 'console') {
    console.log(`\n[DEV EMAIL] to ${to}: ${subject}\n${text}\n`);
    return true;
  }
  console.warn(`[email] provider "${config.emailProvider}" not implemented; not sent: ${subject}`);
  return false;
}
