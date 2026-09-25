/**
 * Keeps a Supabase Free-plan project from being paused.
 *
 *   npm run keep-alive
 *
 * Supabase pauses a Free project after ~7 days with too little database
 * activity, and a project left paused long enough is eventually deleted. This
 * script performs a tiny real query, which counts as activity and resets that
 * clock. It is scheduled twice a week by .github/workflows/keep-alive.yml.
 *
 * It only reads. It never writes, and it never touches attendance data.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

function loadEnvFile() {
  // In CI the values come from repository secrets; locally, from .env.local.
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

async function main() {
  loadEnvFile();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
        'In GitHub Actions, add them as repository secrets.',
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const startedAt = Date.now();

  // A real query against a real table. head:true means no rows travel back.
  const { count, error } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  const ms = Date.now() - startedAt;
  console.log(`Supabase reachable in ${ms}ms — ${count ?? 0} employee record(s).`);

  // A cold start well over a second usually means the project had been paused
  // or idled down, which is worth noticing in the job log.
  if (ms > 2000) {
    console.log('Note: slow response — the project may have been waking up.');
  }
}

main().catch((error) => {
  console.error('KEEP-ALIVE FAILED:', error instanceof Error ? error.message : error);
  console.error(
    '\nIf the project is already paused, restore it from the Supabase dashboard:\n' +
      '  Supabase → your project → Restore project\n',
  );
  process.exit(1);
});
