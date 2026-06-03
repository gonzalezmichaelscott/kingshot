-- ============================================================
-- FIX 8 — Avatar caching on members
-- ============================================================
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_fetched_at timestamptz;

-- ============================================================
-- FIX 7 — Rally timer: only R4/R5/system_admin can manage sessions
-- ============================================================
DROP POLICY IF EXISTS "R4 R5 can manage timer sessions" ON rally_timer_sessions;
CREATE POLICY "R4 R5 can manage timer sessions" ON rally_timer_sessions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND alliance_id = rally_timer_sessions.alliance_id
      AND role IN ('r4','r5','system_admin')
    )
  );
