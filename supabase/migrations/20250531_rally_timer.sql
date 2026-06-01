-- Rally Timer Sessions
CREATE TABLE IF NOT EXISTS rally_timer_sessions (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid references alliances(id) on delete cascade,
  label text not null default 'Rally Timer',
  players jsonb default '[]',
  status text check (status in ('idle','running','complete')) default 'idle',
  started_at timestamptz,
  scheduled_for timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

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

-- Allow anon access for shared timer links
CREATE POLICY "Anyone with link can view timer sessions" ON rally_timer_sessions
  FOR SELECT TO anon USING (true);
