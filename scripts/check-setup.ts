/**
 * Pre-flight check for a real Supabase project.
 *
 *   npm run check:setup
 *
 * Confirms the environment is complete, the schema is in place, the storage
 * bucket exists, at least one administrator can sign in — and, most
 * importantly, that Row Level Security really does stop the public anon key
 * from reading staff data. Run it after setting up Supabase and again after
 * every deployment.
 *
 * Read-only: it never writes to your database.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

type Status = 'pass' | 'fail' | 'warn';
const results: { status: Status; label: string; detail?: string }[] = [];

const record = (status: Status, label: string, detail?: string) =>
  results.push({ status, label, detail });

function loadEnv() {
  // Next.js loads .env.local automatically; a plain node script does not.
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] === undefined) {
        process.env[key] = rawValue.replace(/^["']|["']$/g, '');
      }
    }
  }
}

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.EMPLOYEE_SESSION_SECRET;

  // --- 1. Environment ------------------------------------------------------
  for (const [name, value] of [
    ['NEXT_PUBLIC_SUPABASE_URL', url],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceKey],
    ['EMPLOYEE_SESSION_SECRET', sessionSecret],
  ] as const) {
    if (!value || value.startsWith('your-') || value.startsWith('replace-')) {
      record('fail', `${name} is set`, 'still missing or a placeholder');
    } else {
      record('pass', `${name} is set`);
    }
  }

  if (sessionSecret && sessionSecret.length < 32) {
    record('fail', 'EMPLOYEE_SESSION_SECRET is long enough', `${sessionSecret.length} chars, need 32+`);
  } else if (sessionSecret) {
    record('pass', 'EMPLOYEE_SESSION_SECRET is long enough');
  }

  if (url?.includes('127.0.0.1') || url?.includes('localhost')) {
    record('warn', 'Supabase URL points at a real project', 'currently a local address — demo config');
  } else if (url) {
    record('pass', 'Supabase URL points at a real project');
  }

  if (anonKey && serviceKey && anonKey === serviceKey) {
    record('fail', 'anon and service-role keys differ', 'they are identical — check which you pasted where');
  }

  if (!url || !anonKey || !serviceKey) {
    report();
    return;
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  // --- 2. Schema -----------------------------------------------------------
  for (const table of ['employees', 'attendance', 'profiles'] as const) {
    const { error } = await service.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      record('fail', `table "${table}" exists`, `${error.message} — run supabase/migrations/0001_init.sql`);
    } else {
      record('pass', `table "${table}" exists`);
    }
  }

  // --- 3. Storage ----------------------------------------------------------
  const { data: buckets, error: bucketError } = await service.storage.listBuckets();
  if (bucketError) {
    record('fail', 'storage is reachable', bucketError.message);
  } else {
    const bucket = buckets?.find((b) => b.name === 'employee-photos');
    if (!bucket) {
      record('fail', 'bucket "employee-photos" exists', 'run supabase/migrations/0002_storage.sql');
    } else {
      record('pass', 'bucket "employee-photos" exists');
      record(
        bucket.public ? 'pass' : 'warn',
        'bucket is publicly readable',
        bucket.public ? undefined : 'photos will not display unless you switch to signed URLs',
      );
    }
  }

  // --- 4. Row Level Security: the check that matters -----------------------
  // The anon key is public. If it can read employees, anyone can download the
  // whole staff list, so this is the single most important assertion here.
  const { data: leaked, error: anonError } = await anon.from('employees').select('computer_code').limit(5);
  if (anonError) {
    record('pass', 'anon key is blocked from reading employees', `refused: ${anonError.message}`);
  } else if ((leaked?.length ?? 0) > 0) {
    record(
      'fail',
      'anon key is blocked from reading employees',
      `LEAK: returned ${leaked!.length} row(s). Re-run 0001_init.sql and remove any policy granting the anon role access.`,
    );
  } else {
    record('pass', 'anon key is blocked from reading employees');
  }

  const { data: leakedAttendance, error: anonAttendanceError } = await anon
    .from('attendance')
    .select('id')
    .limit(5);
  if (anonAttendanceError || (leakedAttendance?.length ?? 0) === 0) {
    record('pass', 'anon key is blocked from reading attendance');
  } else {
    record('fail', 'anon key is blocked from reading attendance', 'LEAK: attendance is publicly readable');
  }

  // --- 5. Data -------------------------------------------------------------
  const { count: employeeCount } = await service
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  record(
    (employeeCount ?? 0) > 0 ? 'pass' : 'warn',
    'active employees exist',
    employeeCount ? `${employeeCount} active` : 'none yet — import your spreadsheet',
  );

  const { count: adminCount } = await service
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');
  record(
    (adminCount ?? 0) > 0 ? 'pass' : 'fail',
    'at least one administrator exists',
    adminCount ? `${adminCount} admin(s)` : "create one, then: update profiles set role='admin' where email='…'",
  );

  const { count: demoCount } = await service
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .like('computer_code', 'NP1000%');
  if ((demoCount ?? 0) > 0) {
    record(
      'warn',
      'no demo records in the database',
      `${demoCount} fictional seed row(s) present — delete before real use`,
    );
  } else {
    record('pass', 'no demo records in the database');
  }

  report();
}

function report() {
  const icon = { pass: '  ✓', fail: '  ✗', warn: '  !' };
  console.log('\nSupabase setup check\n');
  for (const { status, label, detail } of results) {
    console.log(`${icon[status]} ${label}${detail ? ` — ${detail}` : ''}`);
  }

  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  console.log(
    `\n${results.length - failed - warned} passed, ${warned} warning(s), ${failed} failure(s)\n`,
  );

  if (failed > 0) {
    console.log('Not ready for production. Fix the ✗ items above.\n');
    process.exitCode = 1;
  } else if (warned > 0) {
    console.log('Usable, but review the ! items before going live.\n');
  } else {
    console.log('Ready for production.\n');
  }
}

main().catch((error) => {
  console.error('\nThe check could not complete:', error instanceof Error ? error.message : error);
  console.error('Is NEXT_PUBLIC_SUPABASE_URL reachable from this machine?\n');
  process.exitCode = 1;
});
