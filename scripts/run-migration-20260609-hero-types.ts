/**
 * Migration: 20260609 — fix hero troop_type classifications
 *
 * Usage:
 *   npx tsx scripts/run-migration-20260609-hero-types.ts
 *
 * Plain DML (UPDATE) — applied directly via PostgREST with the service role key.
 * Mirrors supabase/migrations/20260609_fix_hero_troop_types.sql.
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

const FIXES: [string, string][] = [
  ['Hilde', 'cavalry'],
  ['Zoe', 'infantry'],
  ['Fahd', 'cavalry'],
  ['Amane', 'archer'],
  ['Gordon', 'cavalry'],
  ['Quinn', 'archer'],
  ['Howard', 'infantry'],
  ['Diana', 'archer'],
  ['Saul', 'archer'],
]

async function run() {
  let failed = false
  for (const [name, type] of FIXES) {
    const res = await fetch(`${url}/rest/v1/heroes?name=ilike.${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ troop_type: type }),
    })
    if (!res.ok) {
      console.error(`${name}: FAILED (HTTP ${res.status}) ${(await res.text()).slice(0, 200)}`)
      failed = true
      continue
    }
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn(`${name}: no matching hero row found`)
    } else {
      for (const r of rows) console.log(`${r.name} -> ${r.troop_type}`)
    }
  }
  if (failed) process.exit(1)
  console.log('\nHero troop_type fixes applied.')
}

run().catch(err => { console.error(err); process.exit(1) })
