import { randomInt } from 'node:crypto';

// No 0/O or 1/I, so a code read aloud or copied from a phone screen can't be mistyped.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** e.g. "Everest Textile Mills" -> "EVE-K7M2Q". The prefix helps people recognise their code. */
export function generateOrganizationCode(organizationName) {
  const prefix = (organizationName.toUpperCase().replace(/[^A-Z]/g, '') + 'XXX').slice(0, 3);
  let suffix = '';
  for (let index = 0; index < 5; index += 1) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${prefix}-${suffix}`;
}

export const normalizeOrganizationCode = (code) => String(code).trim().toUpperCase();

export const schemaNameForCode = (code) => `tenant_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
