// @ts-nocheck
// One-time setup endpoint — creates the rally_timer_sessions table
// Call this once as system_admin: GET /api/setup/rally-timer
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden — system_admin only' }, { status: 403 })
    }

    // Check if table already exists by trying to select
    const service = createServiceClient()
    const { error: checkErr } = await service
      .from('rally_timer_sessions')
      .select('id')
      .limit(1)

    if (!checkErr) {
      return NextResponse.json({ message: 'Table rally_timer_sessions already exists.' })
    }

    // Table doesn't exist — return instructions
    const sql = `CREATE TABLE IF NOT EXISTS rally_timer_sessions (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid references alliances(id) on delete cascade,
  label text not null default 'Rally Timer',
  players jsonb default '[]',
  status text check (status in ('idle','running','complete')) default 'idle',
  started_at timestamptz,
  scheduled_for timestamptz,
  landing_mode text default 'simultaneous',
  landing_gap int default 3,
  custom_order jsonb,
  round int default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

-- If the table already exists, add the newer columns:
-- ALTER TABLE rally_timer_sessions ADD COLUMN IF NOT EXISTS landing_mode text default 'simultaneous';
-- ALTER TABLE rally_timer_sessions ADD COLUMN IF NOT EXISTS landing_gap int default 3;
-- ALTER TABLE rally_timer_sessions ADD COLUMN IF NOT EXISTS custom_order jsonb;
-- ALTER TABLE rally_timer_sessions ADD COLUMN IF NOT EXISTS round int default 1;

ALTER TABLE rally_timer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alliance members can read their timer sessions" ON rally_timer_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND alliance_id = rally_timer_sessions.alliance_id
    )
  );

CREATE POLICY "R4 R5 can manage timer sessions" ON rally_timer_sessions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND alliance_id = rally_timer_sessions.alliance_id
      AND role IN ('r4','r5','system_admin')
    )
  );

CREATE POLICY "Anyone with link can view timer sessions" ON rally_timer_sessions
  FOR SELECT TO anon USING (true);`

    return NextResponse.json({
      message: 'Table does not exist. Please run the following SQL in your Supabase SQL editor:',
      sql,
      supabase_sql_editor: 'https://supabase.com/dashboard/project/ucvenfzvpmhfnjhdrmcw/sql/new',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
