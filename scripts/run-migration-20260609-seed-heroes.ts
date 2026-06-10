/**
 * Migration: 20260609 — seed standard starter heroes onto all existing members
 *
 * Usage:
 *   npx tsx scripts/run-migration-20260609-seed-heroes.ts
 *
 * Plain DML — applied directly via PostgREST with the service role key. STRICTLY
 * ADDITIVE: rows are inserted with Prefer: resolution=ignore-duplicates on the
 * (member_id, hero_id) unique key, so any hero data players already entered
 * (levels, stars, widgets, skills) is never modified.
 *
 * Mirrors supabase/migrations/20260609_seed_starter_heroes.sql.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { STARTER_HERO_NAMES } from '../lib/starter-heroes'

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

const baseHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

async function getAll(path: string): Promise<any[]> {
  const out: any[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: { ...baseHeaders, Range: `${from}-${from + pageSize - 1}` },
    })
    if (!res.ok) throw new Error(`GET ${path} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

async function run() {
  const inList = STARTER_HERO_NAMES.map(n => `"${n}"`).join(',')
  const heroes = await getAll(`heroes?select=id,name&name=in.(${encodeURIComponent(inList)})`)
  console.log(`Found ${heroes.length} of ${STARTER_HERO_NAMES.length} starter heroes in the catalog.`)
  if (heroes.length === 0) { console.error('No starter heroes found — aborting.'); process.exit(1) }
  const missing = STARTER_HERO_NAMES.filter(n => !heroes.some((h: any) => h.name === n))
  if (missing.length) console.warn(`WARNING: not in catalog (skipped): ${missing.join(', ')}`)

  const members = await getAll('members?select=id')
  console.log(`Seeding ${members.length} members × ${heroes.length} heroes...`)

  const rows = members.flatMap((m: any) => heroes.map((h: any) => ({ member_id: m.id, hero_id: h.id })))

  // Insert in batches with duplicate resolution = ignore (additive, never updates).
  const batchSize = 1000
  let attempted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const res = await fetch(`${url}/rest/v1/member_heroes?on_conflict=member_id,hero_id`, {
      method: 'POST',
      headers: { ...baseHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    })
    if (!res.ok) throw new Error(`Insert batch failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    attempted += batch.length
    process.stdout.write(`\r  ${attempted}/${rows.length} pairs processed`)
  }
  console.log('\nDone. Existing hero entries were preserved (duplicates ignored).')
}

run().catch(err => { console.error('\n' + err.message); process.exit(1) })
