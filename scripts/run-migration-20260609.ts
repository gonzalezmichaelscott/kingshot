/**
 * Migration: 20260609 — Tri-Alliance Clash assignments table
 *
 * Usage:
 *   npx tsx scripts/run-migration-20260609.ts
 *
 * Attempts to run the DDL via the `_run_ddl` helper RPC over PostgREST (plain
 * fetch — avoids supabase-js realtime/WebSocket requirements on Node 20). If the
 * helper does not exist in the database, prints the SQL to run manually.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
    }
  } catch {}
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

async function run() {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260609_tri_alliance_assignments.sql'), 'utf8')
  console.log('Running migration: 20260609_tri_alliance_assignments')

  const res = await fetch(`${url}/rest/v1/rpc/_run_ddl`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ddl: sql }),
  })

  if (res.ok) {
    console.log('Migration applied via _run_ddl.')
  } else {
    const body = await res.text()
    console.log(`_run_ddl unavailable or failed (HTTP ${res.status}): ${body.slice(0, 300)}`)
    console.log('\nRun this SQL in the Supabase dashboard SQL Editor:')
    console.log('  https://supabase.com/dashboard/project/ucvenfzvpmhfnjhdrmcw/sql/new')
    console.log('\n--- SQL ---\n' + sql + '\n--- End ---')
  }

  // Verify the table is reachable.
  const verify = await fetch(`${url}/rest/v1/tri_alliance_assignments?select=id&limit=1`, { headers })
  if (verify.ok) {
    console.log('\nVerification: tri_alliance_assignments table exists and is readable.')
  } else {
    console.log(`\nVerification: table NOT reachable yet (HTTP ${verify.status}: ${(await verify.text()).slice(0, 200)})`)
    process.exitCode = 1
  }
}

run().catch(err => { console.error(err); process.exit(1) })
