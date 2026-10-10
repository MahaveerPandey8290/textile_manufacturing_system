// Staff must sign in with their employer's email. Free mailbox providers are refused
// everywhere (sign-up, invitations, sign-in) so accounts always belong to a company domain.
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.in', 'live.com', 'live.in', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me',
  'zoho.com', 'zohomail.com', 'zohomail.in', 'rediffmail.com', 'rediff.com', 'yandex.com', 'yandex.ru',
  'mail.com', 'gmx.com', 'gmx.net', 'tutanota.com', 'tuta.io', 'fastmail.com', 'hey.com', 'inbox.com',
]);

export const PERSONAL_EMAIL_MESSAGE = 'Use your company email. Personal addresses such as Gmail, Yahoo or Outlook are not accepted.';

export function emailDomainOf(email) {
  return String(email).trim().toLowerCase().split('@').pop();
}

export function isPersonalEmail(email) {
  const domain = emailDomainOf(email);
  return PERSONAL_EMAIL_DOMAINS.has(domain) || /^(yahoo|hotmail|outlook|live)\.[a-z.]+$/.test(domain);
}

/** True when `email` is on `domain` or one of its sub-domains (e.g. mill.everestmills.in). */
export function belongsToDomain(email, domain) {
  const emailDomain = emailDomainOf(email);
  return emailDomain === domain || emailDomain.endsWith(`.${domain}`);
}
