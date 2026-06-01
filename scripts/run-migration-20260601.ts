/**
 * Migration: 20260601 — Battle Plans & Custom Events
 *
 * Usage:
 *   npx tsx scripts/run-migration-20260601.ts
 */
import { createClient } from '@supabase/supabase-js'
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function runMigration() {
  console.log('Running migration: 20260601_battle_plans_and_custom_events')

  // Create a temporary stored procedure to run the DDL
  const createFn = `
    CREATE OR REPLACE FUNCTION _temp_migrate_20260601() RETURNS void
    LANGUAGE plpgsql AS $$
    BEGIN
      -- Feature A: member instructions on assignments
      ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS member_instructions text;
      ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS instruction_generated_at timestamptz;

      -- Feature B: custom events columns
      ALTER TABLE events ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_instructions text;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_instructions_html text;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_images jsonb DEFAULT '[]';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'all';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS visible_to_members jsonb DEFAULT '[]';

      -- Widen status constraint
      ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
      ALTER TABLE events ADD CONSTRAINT events_status_check
        CHECK (status IN ('planning','registration','active','completed','published','draft'));
    END;
    $$;
  `

  // Insert via a dummy query that calls pg_catalog to run DDL — we use RPC
  // Step 1: create the function (requires service role DDL access)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _ignored: unknown

  // The function may not exist yet; create it first via the REST API's raw query endpoint
  // Supabase exposes raw SQL via the /rest/v1/rpc pattern with a helper function
  // Since we can't run arbitrary DDL directly, use the schema introspection approach:

  console.log('Checking existing columns...')

  // Check if columns already exist by querying information_schema
  const { data: cols } = await supabase
    .from('information_schema.columns' as any)
    .select('table_name, column_name')
    .in('table_name', ['event_assignments', 'events'])
    .in('column_name', ['member_instructions', 'is_custom', 'custom_instructions'])

  if (cols && cols.length > 0) {
    const existing = cols.map((c: any) => `${c.table_name}.${c.column_name}`)
    console.log('Columns already exist:', existing.join(', '))
    if (existing.includes('event_assignments.member_instructions') && existing.includes('events.is_custom')) {
      console.log('Migration already applied!')
      return
    }
  }

  console.log('\n⚠️  Cannot run DDL directly via REST API.')
  console.log('Please run the following SQL in your Supabase dashboard SQL Editor:')
  console.log('  https://supabase.com/dashboard/project/ucvenfzvpmhfnjhdrmcw/sql/new')
  console.log('\n--- SQL to run ---')
  console.log(readFileSync(resolve(process.cwd(), 'supabase/migrations/20260601_battle_plans_and_custom_events.sql'), 'utf8'))
  console.log('--- End of SQL ---\n')
}

runMigration().catch(console.error)
