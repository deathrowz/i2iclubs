/**
 * Seeds real Supabase Auth accounts for every platform persona so the
 * email + password login works.
 *
 * Usage (server-side only — needs the service-role key):
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   SEED_PASSWORD='<any password over 8 chars>' \
 *   npx tsx scripts/seed-auth-users.ts
 *
 * Safe to re-run: existing accounts are left untouched.
 *
 * Accounts seeded this way all share SEED_PASSWORD. Follow up with
 * scripts/set-category-passwords.py to give each category its own password.
 */
import { createClient } from '@supabase/supabase-js';
import { DEMO_USERS } from '../src/lib/store/seed-data';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SEED_PASSWORD = process.env.SEED_PASSWORD || '';

async function main() {
  if (!SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required. Aborting.');
    process.exit(1);
  }
  if (SEED_PASSWORD.length < 8) {
    console.error('❌ Set SEED_PASSWORD (min 8 chars). Aborting.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const targets = DEMO_USERS.filter((u) => Boolean(u.email));
  console.log(`Seeding ${targets.length} accounts at ${SUPABASE_URL}…\n`);

  let created = 0;
  let existed = 0;
  let failed = 0;

  for (const user of targets) {
    const email = user.email.toLowerCase();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.full_name, role: user.role },
    });

    if (error) {
      if (/already (registered|exists)/i.test(error.message)) {
        existed += 1;
        console.log(`• exists  ${email}`);
      } else {
        failed += 1;
        console.log(`✗ failed  ${email} — ${error.message}`);
      }
      continue;
    }

    created += 1;
    console.log(`✓ created ${email} (${user.role})`);

    // Link the auth user to the profile row when the table is present.
    if (data?.user?.id) {
      await supabase
        .from('users')
        .update({ auth_user_id: data.user.id })
        .eq('email', email);
    }
  }

  console.log(`\nDone. created=${created} existed=${existed} failed=${failed}`);
  console.log(`Sign in with any email above and the SEED_PASSWORD you supplied.`);
}

main().catch((e) => {
  console.error('Seeder crashed:', e);
  process.exit(1);
});
