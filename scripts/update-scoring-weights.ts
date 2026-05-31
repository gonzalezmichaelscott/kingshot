/**
 * PART 4 — Scoring weights update script.
 *
 * Writes the corrected role-scoring weights to event_types.scoring_weights for
 * all three event types. These weight keys are consumed by lib/scoring.ts.
 *
 * Usage:
 *   1. Ensure .env.local has real NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   2. npx tsx scripts/update-scoring-weights.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* rely on real environment variables */
  }
}

export const SCORING_WEIGHTS = {
  rally_leader_weight: {
    power: 0.15, march_size: 0.20, rally_capacity: 0.15,
    damage_product: 0.25, hero_score: 0.15, attack: 0.05, lethality: 0.05,
  },
  joiner_weight: {
    power: 0.10, march_size: 0.25, troop_count: 0.20,
    damage_product: 0.25, hero_score: 0.10, attack: 0.05, lethality: 0.05,
  },
  castle_weight: {
    power: 0.15, march_size: 0.20, rally_capacity: 0.15,
    damage_product: 0.20, health: 0.15, hero_score: 0.10, attack: 0.025, lethality: 0.025,
  },
  turret_leader_weight: {
    power: 0.20, march_size: 0.20, rally_capacity: 0.20,
    damage_product: 0.20, hero_score: 0.10, attack: 0.05, lethality: 0.05,
  },
  turret_joiner_weight: {
    power: 0.10, march_size: 0.30, troop_count: 0.20,
    damage_product: 0.20, hero_score: 0.10, attack: 0.05, lethality: 0.05,
  },
  garrison_weight: {
    power: 0.10, health: 0.30, defense: 0.25,
    damage_product: 0.15, hero_score: 0.10, attack: 0.05, lethality: 0.05,
  },
  support_weight: {
    troop_count: 0.35, damage_product: 0.25, march_size: 0.20,
    hero_score: 0.10, power: 0.10,
  },
}

const EVENT_SLUGS = ['swordland_showdown', 'kvk_castle_battle', 'tri_alliance_clash']

async function main() {
  loadEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key || url.startsWith('your_') || key.startsWith('your_')) {
    console.error('✗ Missing real Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const { data, error } = await supabase
    .from('event_types')
    .update({ scoring_weights: SCORING_WEIGHTS })
    .in('slug', EVENT_SLUGS)
    .select('slug')

  if (error) {
    console.error('✗ Failed to update scoring weights:', error.message)
    process.exit(1)
  }

  console.log(`✓ Updated scoring weights for: ${(data || []).map((d: any) => d.slug).join(', ') || '(no matching event types found)'}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
