// @ts-nocheck
/**
 * One-shot migration route for 20260601 schema changes.
 * Only callable by system_admin. Safe to call multiple times (IF NOT EXISTS).
 *
 * Hit: POST /api/admin/run-migration
 * with Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const SQL_STATEMENTS = [
  `ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS member_instructions text`,
  `ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS instruction_generated_at timestamptz`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_instructions text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_instructions_html text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_images jsonb DEFAULT '[]'`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'all'`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS visible_to_members jsonb DEFAULT '[]'`,
  `ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check`,
  `ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('planning','registration','active','completed','published','draft'))`,
]

export async function POST(request: NextRequest) {
  // Verify caller is system_admin
  try {
    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await authClient.from('user_profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Requires system_admin role' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Auth error' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: string[] = []

  // Try running via rpc — requires a migration helper function in Supabase
  // Fall back to providing instructions
  for (const sql of SQL_STATEMENTS) {
    try {
      const { error } = await (supabase as any).rpc('_run_ddl', { ddl: sql })
      if (error) {
        results.push(`SKIP (no _run_ddl fn): ${sql.slice(0, 60)}`)
      } else {
        results.push(`OK: ${sql.slice(0, 60)}`)
      }
    } catch (e: any) {
      results.push(`ERROR: ${e.message}`)
    }
  }

  return NextResponse.json({
    message: 'Migration attempted. If you see SKIP messages, run the SQL manually in the Supabase dashboard.',
    sql: SQL_STATEMENTS.join(';\n') + ';',
    results,
    dashboard_url: 'https://supabase.com/dashboard/project/ucvenfzvpmhfnjhdrmcw/sql/new',
  })
}
