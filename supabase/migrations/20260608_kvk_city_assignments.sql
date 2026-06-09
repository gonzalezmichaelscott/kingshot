-- FEATURE 3 — Interactive Castle Positioning Map
-- Stores which attending member occupies which city slot around the castle for a
-- given KVK event. One member per slot (UNIQUE on event_id + slot_position).
CREATE TABLE IF NOT EXISTS kvk_city_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  slot_position text not null,
  created_at timestamptz default now(),
  UNIQUE(event_id, slot_position)
);

-- A member can only stand in one slot per event.
CREATE UNIQUE INDEX IF NOT EXISTS kvk_city_assignments_event_member_idx
  ON kvk_city_assignments (event_id, member_id);

ALTER TABLE kvk_city_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Alliance members can read city assignments" ON kvk_city_assignments;
CREATE POLICY "Alliance members can read city assignments" ON kvk_city_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "R4/R5/admin can manage city assignments" ON kvk_city_assignments;
CREATE POLICY "R4/R5/admin can manage city assignments" ON kvk_city_assignments
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('r4', 'r5', 'system_admin')
    )
  );

-- Live sync so every viewer sees positions update in real time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kvk_city_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE kvk_city_assignments;
  END IF;
END $$;
