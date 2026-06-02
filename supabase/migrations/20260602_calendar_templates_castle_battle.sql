-- ============================================================================
-- 2026-06-02 — Alliance Calendar, Message Templates, Castle Battle event type
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- ───────────────────────── FEATURE 1: Alliance Calendar ─────────────────────
CREATE TABLE IF NOT EXISTS alliance_calendar_events (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid references alliances(id) on delete cascade,
  title text not null,
  description text,
  event_date timestamptz not null,
  end_date timestamptz,
  is_recurring boolean default false,
  recurrence_type text check (recurrence_type in ('daily','weekly','biweekly','monthly','custom')),
  recurrence_interval_days integer,
  recurrence_end_date timestamptz,
  color text default 'amber',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS alliance_calendar_alliance_idx ON alliance_calendar_events (alliance_id, event_date);

ALTER TABLE alliance_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Alliance members can read calendar" ON alliance_calendar_events;
CREATE POLICY "Alliance members can read calendar" ON alliance_calendar_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND alliance_id = alliance_calendar_events.alliance_id)
  );

DROP POLICY IF EXISTS "R4 R5 can manage calendar" ON alliance_calendar_events;
CREATE POLICY "R4 R5 can manage calendar" ON alliance_calendar_events
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND alliance_id = alliance_calendar_events.alliance_id AND role IN ('r4','r5','system_admin'))
  );

-- ───────────────────────── FEATURE 2: Message Templates ─────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid references alliances(id) on delete cascade,
  title text not null,
  body text not null,
  category text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS message_templates_alliance_idx ON message_templates (alliance_id, category);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "R4 R5 can manage templates" ON message_templates;
CREATE POLICY "R4 R5 can manage templates" ON message_templates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND alliance_id = message_templates.alliance_id AND role IN ('r4','r5','system_admin'))
  );

-- ───────────────────────── FEATURE 3: Castle Battle event type ──────────────
INSERT INTO event_types (name, slug, description, schedule_description, duration_minutes, rules, scoring_weights, objectives)
VALUES (
  'Castle Battle',
  'castle_battle',
  'Alliance vs Alliance battle within the kingdom. Objective: hold the King Castle for 2.5 consecutive hours (instant win) or the most cumulative time. 4 turrets surround the castle — each enemy-held turret fires 2% casualties per cycle on castle troops. Single alliance event — no KVK cooperation needed.',
  'Scheduled by alliance leaders. Battle runs 12:00–17:00 UTC, up to 5 hours.',
  300,
  '{
    "battle_start_utc_time": "12:00",
    "structures": {
      "castle": {"name": "King Castle", "win_condition_minutes": 150, "priority": 1},
      "north_turret": {"name": "North Turret", "damage_per_cycle_pct": 2, "priority": 2},
      "east_turret": {"name": "East Turret", "damage_per_cycle_pct": 2, "priority": 3},
      "south_turret": {"name": "South Turret", "damage_per_cycle_pct": 2, "priority": 4},
      "west_turret": {"name": "West Turret", "damage_per_cycle_pct": 2, "priority": 5}
    },
    "priority_rule": "If insufficient players for all structures, prioritize 2 teams for castle first, then assign remaining players to as many turrets as capacity allows",
    "optimal_rally_formation": {"infantry": 0.5, "cavalry": 0.2, "archer": 0.3},
    "garrison_formation": {"infantry": 0.6, "cavalry": 0.2, "archer": 0.2},
    "key_rules": [
      "Single alliance event — coordinate within your own alliance only",
      "Castle is top priority — assign strongest players here first",
      "Each enemy-held turret deals 2% casualties per cycle to castle holders",
      "Instant win = 2.5 consecutive hours holding castle without interruption",
      "If insufficient players: 2 castle teams first, then fill turrets with remaining capacity"
    ]
  }',
  '{
    "castle_team_weight": {"power": 0.4, "march_size": 0.3, "rally_capacity": 0.2, "hero_score": 0.1},
    "turret_leader_weight": {"power": 0.35, "march_size": 0.3, "rally_capacity": 0.2, "hero_score": 0.15},
    "turret_joiner_weight": {"power": 0.3, "march_size": 0.35, "troop_count": 0.2, "hero_score": 0.15},
    "support_weight": {"power": 0.2, "troop_count": 0.4, "hero_score": 0.4}
  }',
  '["Hold King Castle", "Control North Turret", "Control East Turret", "Control South Turret", "Control West Turret"]'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  schedule_description = EXCLUDED.schedule_description,
  duration_minutes = EXCLUDED.duration_minutes,
  rules = EXCLUDED.rules,
  scoring_weights = EXCLUDED.scoring_weights,
  objectives = EXCLUDED.objectives;
