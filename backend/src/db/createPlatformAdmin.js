// CLI: create (or reset the password of) a platform super admin.
//   npm run platform:admin -- --email you@yourcompany.com --name "Your Name"
// The password is asked for in the terminal, or read from PLATFORM_ADMIN_PASSWORD for scripted setups.
// Super admins see every organisation in the console at /platform/login; they never belong to one.
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, query } from './pool.js';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Pass a valid --email.'),
  name: z.string().trim().min(2, 'Pass your full name with --name.').max(120),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
});

/** Reads a line without echoing it, so the password doesn't stay on screen or in scrollback. */
function askHidden(prompt) {
  return new Promise((resolve) => {
    const reader = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    reader._writeToOutput = (text) => {
      if (text.includes(prompt)) process.stdout.write(text);
    };
    reader.question(prompt, (answer) => {
      reader.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  let password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden('Password for the super admin: ');
    const confirmation = await askHidden('Type it again: ');
    if (password !== confirmation) throw new Error('Passwords do not match.');
  }
  const parsed = inputSchema.safeParse({ email: values.email, name: values.name, password });
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join('\n'));
  const { email, name } = parsed.data;

  const { rows } = await query(
    `INSERT INTO platform.platform_admins (full_name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash, is_active = true
     RETURNING (xmax = 0) AS created`,
    [name, email, await bcrypt.hash(password, 12)],
  );
  console.log(rows[0].created ? `Super admin ${email} created.` : `Super admin ${email} updated with the new password.`);
  console.log('Sign in at /platform/login.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
