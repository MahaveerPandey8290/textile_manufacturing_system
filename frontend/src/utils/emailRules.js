// Mirrors the server's rules so people see the problem while typing. The server still decides.
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.in', 'live.com', 'live.in', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me',
  'zoho.com', 'zohomail.com', 'zohomail.in', 'rediffmail.com', 'rediff.com', 'yandex.com', 'yandex.ru',
  'mail.com', 'gmx.com', 'gmx.net', 'tutanota.com', 'tuta.io', 'fastmail.com', 'hey.com', 'inbox.com',
]);

export const PERSONAL_EMAIL_MESSAGE = 'Use your company email. Gmail, Yahoo, Outlook and other personal addresses are not accepted.';

export const emailDomainOf = (email) => String(email).trim().toLowerCase().split('@')[1] ?? '';

export function isPersonalEmail(email) {
  const domain = emailDomainOf(email);
  return PERSONAL_EMAIL_DOMAINS.has(domain) || /^(yahoo|hotmail|outlook|live)\.[a-z.]+$/.test(domain);
}

/** A message to show under an email field, or '' when the address looks fine so far. */
export function workEmailProblem(email, { requiredDomain } = {}) {
  const value = email.trim();
  if (!value.includes('@') || !emailDomainOf(value).includes('.')) return '';
  if (isPersonalEmail(value)) return PERSONAL_EMAIL_MESSAGE;
  const domain = emailDomainOf(value);
  if (requiredDomain && domain !== requiredDomain && !domain.endsWith(`.${requiredDomain}`)) {
    return `Staff sign in with their @${requiredDomain} email.`;
  }
  return '';
}

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 10 characters', test: (password) => password.length >= 10 },
  { id: 'letter', label: 'A letter', test: (password) => /[A-Za-z]/.test(password) },
  { id: 'number', label: 'A number', test: (password) => /\d/.test(password) },
];
export const isStrongPassword = (password) => PASSWORD_RULES.every((rule) => rule.test(password));
