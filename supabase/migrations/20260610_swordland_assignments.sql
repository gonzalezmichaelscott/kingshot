-- Swordland Showdown team-based battle planner: per-member team assignments and
-- instructions. Swordland is a building-CAPTURE event (NOT rally-fill) — members
-- DISPERSE into Attacker / Support / Defender teams to seize multiple buildings.
CREATE TABLE IF NOT EXISTS swordland_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  legion int not null check (legion in (1, 2)),
  team text not null check (team in ('attacker','support','defender_a','defender_b','substitute')),
  building_targets text,
  stage_instructions text,
  hero_recommendation text,
  hero_squad_1 text,
  hero_squad_2 text,
  hero_squad_3 text,
  power_rank int,
  created_at timestamptz default now(),
  UNIQUE(event_id, member_id)
);

CREATE INDEX IF NOT EXISTS swordland_assignments_event_idx ON swordland_assignments (event_id, legion);
CREATE INDEX IF NOT EXISTS swordland_assignments_member_idx ON swordland_assignments (member_id);

ALTER TABLE swordland_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read own assignment" ON swordland_assignments;
CREATE POLICY "Members can read own assignment" ON swordland_assignments
  FOR SELECT TO authenticated USING (
    member_id IN (SELECT member_id FROM user_member_profiles WHERE user_id = auth.uid())
  );

-- Alliance members can read their alliance's roster on the event page
-- (matches event_availability / tri_alliance_assignments visibility).
DROP POLICY IF EXISTS "Alliance members can read alliance plan" ON swordland_assignments;
CREATE POLICY "Alliance members can read alliance plan" ON swordland_assignments
  FOR SELECT TO authenticated USING (
    event_id IN (SELECT id FROM events WHERE alliance_id = get_user_alliance_id())
  );

DROP POLICY IF EXISTS "R4/R5/admin can manage" ON swordland_assignments;
CREATE POLICY "R4/R5/admin can manage" ON swordland_assignments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('r4','r5','system_admin'))
  );
