// Outgoing email. With SMTP_URL set, mail goes out through that server. Without it
// (local development) the message is printed to the API console so you can copy the code.
// In tests every message is also kept in `testOutbox` so tests can read verification codes.
import { config } from '../config/env.js';

export const testOutbox = [];
let transportPromise;

async function getTransport() {
  if (!config.SMTP_URL) return null;
  transportPromise ??= import('nodemailer').then(({ default: nodemailer }) => nodemailer.createTransport(config.SMTP_URL));
  return transportPromise;
}

export async function sendMail({ to, subject, text }) {
  if (config.NODE_ENV === 'test') {
    testOutbox.push({ to, subject, text });
    return;
  }
  const transport = await getTransport();
  if (transport) {
    await transport.sendMail({ from: config.MAIL_FROM, to, subject, text });
    return;
  }
  console.log(`\n──────── email (SMTP_URL not set, printed instead) ────────\nTo: ${to}\nSubject: ${subject}\n\n${text}\n──────────────────────────────────────────────────────────\n`);
}
