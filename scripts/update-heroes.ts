/**
 * PART 2 — Hero seed/update script.
 *
 * Applies the verified hero data in scripts/hero-data.ts to the `heroes` table.
 * Requires the columns added by supabase/migrations/0001_hero_system.sql to
 * already exist (run that migration in the Supabase SQL Editor first).
 *
 * Usage:
 *   1. Ensure .env.local has real NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   2. npx tsx scripts/update-heroes.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { HEROES } from './hero-data'

// Minimal .env.local loader (avoids adding a dotenv dependency)
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env.local — rely on real environment variables */
  }
}

async function main() {
  loadEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key || url.startsWith('your_') || key.startsWith('your_')) {
    console.error('✗ Missing real Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  let ok = 0
  let missing = 0
  const failures: string[] = []

  for (const hero of HEROES) {
    const { data, error } = await supabase
      .from('heroes')
      .update({
        primary_role: hero.primary_role,
        expedition_skills: hero.expedition_skills,
        widget_effect: hero.widget_effect ?? {},
      })
      .eq('name', hero.name)
      .select('id')

    if (error) {
      failures.push(`${hero.name}: ${error.message}`)
    } else if (!data || data.length === 0) {
      missing++
      console.warn(`• No hero row named "${hero.name}" — skipped.`)
    } else {
      ok++
      console.log(`✓ Updated ${hero.name}`)
    }
  }

  console.log(`\nDone. ${ok} updated, ${missing} not found, ${failures.length} errors.`)
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
