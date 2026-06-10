-- Tri-Alliance Clash battle planner: per-member role assignments and instructions
CREATE TABLE IF NOT EXISTS tri_alliance_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  legion int not null check (legion in (1, 2)),
  role text not null check (role in ('main_player','supporter','special_force','reaction_team','commander','substitute')),
  assigned_to uuid references members(id),
  reaction_team_letter text check (reaction_team_letter in ('A','B')),
  formation text,
  hero_squad_1 text,
  hero_squad_2 text,
  hero_squad_3 text,
  hero_recommendation text,
  stage_instructions text,
  power_rank int,
  created_at timestamptz default now(),
  UNIQUE(event_id, member_id)
);

CREATE INDEX IF NOT EXISTS tri_alliance_assignments_event_idx ON tri_alliance_assignments (event_id, legion);
CREATE INDEX IF NOT EXISTS tri_alliance_assignments_member_idx ON tri_alliance_assignments (member_id);

ALTER TABLE tri_alliance_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their own assignment" ON tri_alliance_assignments;
CREATE POLICY "Members can read their own assignment" ON tri_alliance_assignments
  FOR SELECT TO authenticated USING (
    member_id IN (
      SELECT member_id FROM user_member_profiles WHERE user_id = auth.uid()
    )
  );

-- Alliance members can read their alliance's roster on the event page
-- (matches event_availability/event_assignments visibility).
DROP POLICY IF EXISTS "Alliance members can read alliance plan" ON tri_alliance_assignments;
CREATE POLICY "Alliance members can read alliance plan" ON tri_alliance_assignments
  FOR SELECT TO authenticated USING (
    event_id IN (SELECT id FROM events WHERE alliance_id = get_user_alliance_id())
  );

DROP POLICY IF EXISTS "R4/R5/admin can manage assignments" ON tri_alliance_assignments;
CREATE POLICY "R4/R5/admin can manage assignments" ON tri_alliance_assignments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('r4','r5','system_admin'))
  );
