import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { isPersonalEmail, PERSONAL_EMAIL_MESSAGE } from '../../utils/emailDomains.js';
import { normalizeOrganizationCode } from '../../utils/organizationCode.js';

export const organizationCodeSchema = z
  .string()
  .trim()
  .transform(normalizeOrganizationCode)
  .pipe(z.string().regex(/^[A-Z0-9]{3}-[A-Z0-9]{5}$/, 'Organisation codes look like EVE-K7M2Q.'));

export const workEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254)
  .refine((email) => !isPersonalEmail(email), PERSONAL_EMAIL_MESSAGE);

export const newPasswordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

/** Optional form field: a blank input counts as "not given". */
const optionalField = (schema) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

export const organizationSignUpSchema = z.object({
  organization: z.object({
    name: z.string().trim().min(2, 'Enter your organisation name.').max(120),
    city: z.string().trim().min(2, 'Enter the city your mill is in.').max(80),
    phone: optionalField(z.string().trim().regex(/^[+\d][\d\s-]{6,19}$/, 'Enter a valid phone number.')),
    gstNumber: optionalField(
      z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, 'Enter a valid 15-character GSTIN.'),
    ),
    // data:image/...;base64 URL; size and real image type are checked in the service.
    logo: z.string().max(800_000, 'Logo must be 512 KB or smaller.').optional(),
  }),
  owner: z
    .object({
      fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
      email: workEmailSchema,
      password: newPasswordSchema,
      confirmPassword: z.string(),
    })
    .refine((owner) => owner.password === owner.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] }),
});

export const staffSignInSchema = z.object({
  organizationCode: organizationCodeSchema,
  role: z.enum(Object.values(ROLES), 'Choose your role.'),
  email: workEmailSchema,
  password: z.string().min(1, 'Password is required.').max(200),
});

export const organizationAdminSignInSchema = z.object({
  email: workEmailSchema,
  password: z.string().min(1, 'Password is required.').max(200),
});

export const platformSignInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.').max(200),
});

// Staff send their organisation code; organisation admins ("Welcome back" page) only their email.
export const requestCodeSchema = z.object({ organizationCode: organizationCodeSchema.optional(), email: workEmailSchema });

export const verifyCodeSchema = requestCodeSchema.extend({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') });

export const resetPasswordSchema = z
  .object({ resetToken: z.string().min(20).max(2000), newPassword: newPasswordSchema, confirmPassword: z.string() })
  .refine((body) => body.newPassword === body.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: newPasswordSchema });
