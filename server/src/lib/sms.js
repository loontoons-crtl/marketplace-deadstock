import { config } from '../config.js';
import { maskPhone } from './phone.js';

// Test-only outbox so automated tests can read the OTP without printing it.
export const testOutbox = [];

export async function sendOtpSms(phone, code) {
  if (config.isTest) {
    testOutbox.push({ phone, code });
    return;
  }
  if (config.smsProvider === 'console') {
    // Development only. config.js refuses to start in production with this provider.
    console.log(`\n[DEV OTP] ${maskPhone(phone)} → ${code}  (not sent by SMS; console provider)\n`);
    return;
  }
  // A real provider (e.g. MSG91 or Twilio with a DLT-registered template) is wired in before launch.
  throw new Error(`SMS provider "${config.smsProvider}" is not implemented yet`);
}
