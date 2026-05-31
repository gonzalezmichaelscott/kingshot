-- ============================================================
-- KINGSHOT ALLIANCE COORDINATION PLATFORM
-- Full Database Schema + Seed Data
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS kingdoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  server_number integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alliances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_id uuid REFERENCES kingdoms(id) ON DELETE CASCADE,
  name text NOT NULL,
  tag text NOT NULL,
  kvk_enabled boolean DEFAULT false,
  discord_server_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  alliance_id uuid REFERENCES alliances(id),
  role text CHECK (role IN ('system_admin','kingdom_leader','r5','r4','member')),
  display_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid REFERENCES alliances(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  game_id text,
  power bigint DEFAULT 0,
  troop_count integer DEFAULT 0,
  march_size integer DEFAULT 0,
  rally_capacity integer DEFAULT 0,
  timezone text DEFAULT 'UTC',
  access_token uuid DEFAULT gen_random_uuid() UNIQUE,
  linked_user_id uuid REFERENCES auth.users(id),
  participation_history jsonb DEFAULT '[]',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_combat_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  infantry_attack numeric DEFAULT 0,
  infantry_defense numeric DEFAULT 0,
  infantry_health numeric DEFAULT 0,
  infantry_lethality numeric DEFAULT 0,
  cavalry_attack numeric DEFAULT 0,
  cavalry_defense numeric DEFAULT 0,
  cavalry_health numeric DEFAULT 0,
  cavalry_lethality numeric DEFAULT 0,
  archer_attack numeric DEFAULT 0,
  archer_defense numeric DEFAULT 0,
  archer_health numeric DEFAULT 0,
  archer_lethality numeric DEFAULT 0,
  troop_type_primary text CHECK (troop_type_primary IN ('infantry','cavalry','archer','mixed')),
  source text CHECK (source IN ('ocr','manual','ocr_verified')) DEFAULT 'manual',
  screenshot_url text,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- HERO SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS heroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  generation integer NOT NULL,
  troop_type text CHECK (troop_type IN ('infantry','cavalry','archer','all')),
  role text CHECK (role IN ('rally_leader','joiner','support','garrison','flex')),
  rarity text CHECK (rarity IN ('common','rare','epic','legendary')),
  expedition_skills jsonb DEFAULT '[]',
  base_stats jsonb DEFAULT '{}',
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_heroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  hero_id uuid REFERENCES heroes(id),
  hero_level integer DEFAULT 1,
  star_level integer DEFAULT 0,
  widget_level integer DEFAULT 0,
  expedition_skill_levels jsonb DEFAULT '{}',
  is_primary boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, hero_id)
);

-- ============================================================
-- EVENT FRAMEWORK
-- ============================================================

CREATE TABLE IF NOT EXISTS event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  schedule_description text,
  duration_minutes integer,
  rules jsonb DEFAULT '{}',
  scoring_weights jsonb DEFAULT '{}',
  assignment_logic jsonb DEFAULT '{}',
  objectives jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid REFERENCES alliances(id) ON DELETE CASCADE,
  event_type_id uuid REFERENCES event_types(id),
  name text,
  battle_start_utc timestamptz,
  battle_end_utc timestamptz,
  status text CHECK (status IN ('planning','registration','active','completed')) DEFAULT 'planning',
  battle_plan jsonb DEFAULT '{}',
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  will_attend boolean DEFAULT false,
  available_from_utc timestamptz,
  available_to_utc timestamptz,
  squad_preference text,
  notes text,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(event_id, member_id)
);

CREATE TABLE IF NOT EXISTS event_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  role text NOT NULL,
  squad text,
  is_primary boolean DEFAULT true,
  is_backup boolean DEFAULT false,
  time_window_start timestamptz,
  time_window_end timestamptz,
  reasoning text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- COMMUNICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid REFERENCES alliances(id) ON DELETE CASCADE,
  author_id uuid REFERENCES user_profiles(id),
  title text,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES user_profiles(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid REFERENCES alliances(id) ON DELETE CASCADE,
  author_id uuid REFERENCES user_profiles(id),
  content text NOT NULL,
  translated_content jsonb DEFAULT '{}',
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kvk_voice_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_id uuid REFERENCES kingdoms(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  discord_invite_url text,
  minimum_role text DEFAULT 'member',
  is_active boolean DEFAULT true
);

-- ============================================================
-- SCORING & ANALYTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS member_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE UNIQUE,
  overall_score numeric DEFAULT 0,
  rally_leader_score numeric DEFAULT 0,
  joiner_score numeric DEFAULT 0,
  castle_score numeric DEFAULT 0,
  turret_score numeric DEFAULT 0,
  defender_score numeric DEFAULT 0,
  support_score numeric DEFAULT 0,
  score_version integer DEFAULT 1,
  calculated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE kingdoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_combat_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kvk_voice_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_scores ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_alliance_id()
RETURNS uuid AS $$
  SELECT alliance_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Kingdoms: visible to all authenticated users
CREATE POLICY "kingdoms_read_all" ON kingdoms FOR SELECT TO authenticated USING (true);
CREATE POLICY "kingdoms_write_admin" ON kingdoms FOR ALL TO authenticated USING (get_user_role() = 'system_admin');

-- Alliances: visible to all authenticated users
CREATE POLICY "alliances_read_all" ON alliances FOR SELECT TO authenticated USING (true);
CREATE POLICY "alliances_write_admin" ON alliances FOR ALL TO authenticated USING (get_user_role() IN ('system_admin', 'kingdom_leader'));

-- User profiles: own profile + leaders can see their alliance members
CREATE POLICY "profiles_read_own" ON user_profiles FOR SELECT TO authenticated USING (id = auth.uid() OR get_user_role() IN ('system_admin', 'kingdom_leader', 'r5', 'r4'));
CREATE POLICY "profiles_write_own" ON user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR get_user_role() IN ('system_admin', 'r5', 'r4'));

-- Members: alliance members can see their own alliance
CREATE POLICY "members_read_alliance" ON members FOR SELECT TO authenticated USING (alliance_id = get_user_alliance_id() OR get_user_role() IN ('system_admin', 'kingdom_leader'));
CREATE POLICY "members_write_leaders" ON members FOR ALL TO authenticated USING (alliance_id = get_user_alliance_id() AND get_user_role() IN ('r5', 'r4', 'system_admin'));
-- Allow member self-service via token (handled in API routes with service role)

-- Member combat stats: same as members
CREATE POLICY "combat_stats_read" ON member_combat_stats FOR SELECT TO authenticated USING (
  member_id IN (SELECT id FROM members WHERE alliance_id = get_user_alliance_id()) OR get_user_role() IN ('system_admin')
);
CREATE POLICY "combat_stats_write" ON member_combat_stats FOR ALL TO authenticated USING (
  member_id IN (SELECT id FROM members WHERE alliance_id = get_user_alliance_id()) AND get_user_role() IN ('r5', 'r4', 'system_admin')
);

-- Heroes: read all, write admin only
CREATE POLICY "heroes_read_all" ON heroes FOR SELECT TO authenticated USING (true);
CREATE POLICY "heroes_write_admin" ON heroes FOR ALL TO authenticated USING (get_user_role() = 'system_admin');

-- Member heroes: alliance members
CREATE POLICY "member_heroes_read" ON member_heroes FOR SELECT TO authenticated USING (
  member_id IN (SELECT id FROM members WHERE alliance_id = get_user_alliance_id()) OR get_user_role() IN ('system_admin')
);
CREATE POLICY "member_heroes_write" ON member_heroes FOR ALL TO authenticated USING (
  member_id IN (SELECT id FROM members WHERE alliance_id = get_user_alliance_id())
);

-- Event types: read all authenticated, write admin
CREATE POLICY "event_types_read_all" ON event_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "event_types_write_admin" ON event_types FOR ALL TO authenticated USING (get_user_role() = 'system_admin');

-- Events: alliance-scoped
CREATE POLICY "events_read_alliance" ON events FOR SELECT TO authenticated USING (
  alliance_id = get_user_alliance_id() OR get_user_role() IN ('system_admin', 'kingdom_leader')
);
CREATE POLICY "events_write_leaders" ON events FOR ALL TO authenticated USING (
  alliance_id = get_user_alliance_id() AND get_user_role() IN ('r5', 'r4', 'system_admin')
);

-- Event availability: alliance-scoped
CREATE POLICY "availability_read_alliance" ON event_availability FOR SELECT TO authenticated USING (
  event_id IN (SELECT id FROM events WHERE alliance_id = get_user_alliance_id()) OR get_user_role() = 'system_admin'
);
CREATE POLICY "availability_write_alliance" ON event_availability FOR ALL TO authenticated USING (
  event_id IN (SELECT id FROM events WHERE alliance_id = get_user_alliance_id())
);

-- Event assignments
CREATE POLICY "assignments_read_alliance" ON event_assignments FOR SELECT TO authenticated USING (
  event_id IN (SELECT id FROM events WHERE alliance_id = get_user_alliance_id()) OR get_user_role() = 'system_admin'
);
CREATE POLICY "assignments_write_leaders" ON event_assignments FOR ALL TO authenticated USING (
  event_id IN (SELECT id FROM events WHERE alliance_id = get_user_alliance_id()) AND get_user_role() IN ('r5', 'r4', 'system_admin')
);

-- Posts
CREATE POLICY "posts_read_alliance" ON posts FOR SELECT TO authenticated USING (
  alliance_id = get_user_alliance_id() OR get_user_role() IN ('system_admin', 'kingdom_leader')
);
CREATE POLICY "posts_write_alliance" ON posts FOR INSERT TO authenticated WITH CHECK (
  alliance_id = get_user_alliance_id()
);
CREATE POLICY "posts_update_leaders" ON posts FOR UPDATE TO authenticated USING (
  alliance_id = get_user_alliance_id() AND (author_id = auth.uid() OR get_user_role() IN ('r5', 'r4', 'system_admin'))
);
CREATE POLICY "posts_delete_leaders" ON posts FOR DELETE TO authenticated USING (
  get_user_role() IN ('r5', 'r4', 'system_admin')
);

-- Post replies
CREATE POLICY "replies_read_alliance" ON post_replies FOR SELECT TO authenticated USING (
  post_id IN (SELECT id FROM posts WHERE alliance_id = get_user_alliance_id()) OR get_user_role() = 'system_admin'
);
CREATE POLICY "replies_write_alliance" ON post_replies FOR INSERT TO authenticated WITH CHECK (
  post_id IN (SELECT id FROM posts WHERE alliance_id = get_user_alliance_id())
);

-- Chat messages
CREATE POLICY "chat_read_alliance" ON chat_messages FOR SELECT TO authenticated USING (
  alliance_id = get_user_alliance_id() OR get_user_role() IN ('system_admin', 'kingdom_leader')
);
CREATE POLICY "chat_write_alliance" ON chat_messages FOR INSERT TO authenticated WITH CHECK (
  alliance_id = get_user_alliance_id()
);
CREATE POLICY "chat_delete_leaders" ON chat_messages FOR DELETE TO authenticated USING (
  alliance_id = get_user_alliance_id() AND get_user_role() IN ('r5', 'r4', 'system_admin')
);

-- KVK voice channels: R4+ can see channel URLs; all see names
CREATE POLICY "voice_read_all" ON kvk_voice_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "voice_write_admin" ON kvk_voice_channels FOR ALL TO authenticated USING (get_user_role() IN ('system_admin', 'kingdom_leader', 'r5'));

-- Member scores
CREATE POLICY "scores_read_alliance" ON member_scores FOR SELECT TO authenticated USING (
  member_id IN (SELECT id FROM members WHERE alliance_id = get_user_alliance_id()) OR get_user_role() = 'system_admin'
);
CREATE POLICY "scores_write_service" ON member_scores FOR ALL TO authenticated USING (
  get_user_role() IN ('system_admin', 'r5', 'r4')
);

-- ============================================================
-- HERO SEED DATA
-- ============================================================

INSERT INTO heroes (name, generation, troop_type, role) VALUES
('Amadeus', 1, 'infantry', 'rally_leader'),
('Jabel', 1, 'cavalry', 'rally_leader'),
('Saul', 1, 'infantry', 'joiner'),
('Chenko', 1, 'cavalry', 'joiner'),
('Gordon', 1, 'archer', 'rally_leader'),
('Howard', 1, 'archer', 'joiner'),
('Quinn', 1, 'infantry', 'support'),
('Diana', 1, 'cavalry', 'support'),
('Yeonwoo', 1, 'archer', 'support'),
('Amane', 1, 'all', 'garrison'),
('Fahd', 1, 'all', 'support'),
('Zoe', 2, 'cavalry', 'rally_leader'),
('Hilde', 2, 'infantry', 'rally_leader'),
('Marlin', 2, 'archer', 'joiner'),
('Eric', 3, 'infantry', 'rally_leader'),
('Petra', 3, 'cavalry', 'joiner'),
('Jaeger', 3, 'archer', 'rally_leader'),
('Rosa', 4, 'infantry', 'rally_leader'),
('Margot', 4, 'cavalry', 'rally_leader'),
('Alcar', 4, 'archer', 'joiner'),
('Long Fei', 5, 'infantry', 'rally_leader'),
('Vivian', 5, 'cavalry', 'support'),
('Thrud', 5, 'archer', 'rally_leader'),
('Triton', 6, 'infantry', 'rally_leader'),
('Sophia', 6, 'cavalry', 'joiner'),
('Yang', 6, 'archer', 'rally_leader'),
('Ava', 7, 'infantry', 'rally_leader'),
('Charles', 7, 'cavalry', 'rally_leader'),
('Wee & Woo', 7, 'all', 'support')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- EVENT TYPE SEED DATA
-- ============================================================

INSERT INTO event_types (name, slug, description, schedule_description, duration_minutes, rules, scoring_weights, objectives) VALUES
(
  'Swordland Showdown',
  'swordland_showdown',
  'Bi-weekly Sunday PvP where two alliances (each fielding a Legion of 30 combatants + 10 substitutes) fight for 1 hour on a dedicated battlefield. Win condition: most Relic Points. Relic Points come from first-building captures, holding structures, looting Baggage Trains, gathering from Undercellars, and killing enemy troops. Troops are only injured (no permanent losses). Legion 1 win/loss determines alliance rewards; personal Relic Point rank determines individual rewards independently.',
  'Bi-weekly, always Sunday. Voting (2 days) → Registration (2 days) → Matchmaking (2 days) → Battle (1 hour).',
  60,
  '{
    "legion_size": 30,
    "substitute_slots": 10,
    "squads": ["A", "B"],
    "substitute_fill_window_seconds": 180,
    "scoring_source": "relic_points",
    "structures": ["Garrison", "Watchtower", "Supply Station", "Baggage Train", "Undercellar"],
    "key_rules": [
      "Top 20 alliances by power only",
      "Clear infirmary before entering battlefield",
      "Members cannot be in both legions",
      "Substitutes only enter if registered combatant does not show",
      "Must be in alliance before registration closes"
    ]
  }',
  '{
    "rally_leader_weight": {"power": 0.3, "march_size": 0.25, "rally_capacity": 0.2, "hero_score": 0.25},
    "joiner_weight": {"power": 0.35, "march_size": 0.3, "troop_count": 0.2, "hero_score": 0.15},
    "support_weight": {"power": 0.2, "troop_count": 0.4, "hero_score": 0.4}
  }',
  '["Capture and hold Garrison", "Capture Watchtowers", "Loot Baggage Trains", "Gather Undercellars", "Kill enemy troops"]'
),
(
  'Castle Battle (KVK)',
  'kvk_castle_battle',
  '5-hour biweekly Saturday PvP. All alliances in the kingdom work together against a matched opposing kingdom. Objective: hold the King Castle for the most cumulative time (or 2.5 consecutive hours for instant win). Four turrets surround the castle — each enemy-held turret fires 2% casualties per cycle on your castle troops. Optimal rally formation: 50% infantry / 20% cavalry / 30% archer. Optimal garrison: 60% infantry / 20% cavalry / 20% archer.',
  'Biweekly on Saturdays. Battle starts 12:00 UTC, lasts up to 5 hours.',
  300,
  '{
    "battle_start_utc_time": "12:00",
    "structures": {
      "castle": {"name": "King Castle", "win_condition_minutes": 150, "optimal_garrison": {"infantry": 0.6, "cavalry": 0.2, "archer": 0.2}},
      "north_turret": {"name": "North Turret", "damage_per_cycle_pct": 2},
      "east_turret": {"name": "East Turret", "damage_per_cycle_pct": 2},
      "south_turret": {"name": "South Turret", "damage_per_cycle_pct": 2},
      "west_turret": {"name": "West Turret", "damage_per_cycle_pct": 2}
    },
    "optimal_rally_formation": {"infantry": 0.5, "cavalry": 0.2, "archer": 0.3},
    "key_rules": [
      "Turrets each deal 2% casualties per cycle to castle holders if enemy-controlled",
      "Holding all 4 turrets makes the castle nearly impossible to hold",
      "Double rally timing is critical — coordinate rally launches to seconds",
      "Instant win = 2.5 consecutive hours without interruption",
      "Multi-alliance: all alliances in kingdom share the castle battle"
    ],
    "voice_channels": ["battle_leader", "castle", "north_turret", "east_turret", "south_turret", "west_turret", "general"]
  }',
  '{
    "castle_team_weight": {"power": 0.4, "march_size": 0.3, "rally_capacity": 0.2, "hero_score": 0.1},
    "turret_leader_weight": {"power": 0.35, "march_size": 0.3, "rally_capacity": 0.2, "hero_score": 0.15},
    "turret_joiner_weight": {"power": 0.3, "march_size": 0.35, "troop_count": 0.2, "hero_score": 0.15},
    "support_weight": {"power": 0.2, "troop_count": 0.4, "hero_score": 0.4}
  }',
  '["Hold King Castle", "Control North Turret", "Control East Turret", "Control South Turret", "Control West Turret", "Weaken enemy troops"]'
),
(
  'Tri Alliance Clash',
  'tri_alliance_clash',
  '1-hour Saturday battle where 3 alliances compete to capture buildings and earn points. 4 stages: Preparation (3 min), Seize & Conquer (17 min), Garrison Occupation (20 min), Temple Onslaught (20 min). Key buildings: Headquarters (A1/B1/C1), Garrisons (A24/B24/C24 — unlock at 20 min, worth +1800 pts/min), Transit Hub connectors (A29/B29/C29 — control these to access Temple of Tides). Temple of Tides unlocks at 40-min mark, highest value target.',
  'Saturday during chosen time slot. 1 hour total.',
  60,
  '{
    "stages": [
      {"name": "Preparation", "duration_minutes": 3, "description": "Setup phase, no combat"},
      {"name": "Seize & Conquer", "duration_minutes": 17, "description": "Capture own buildings and enemy small buildings. Garrisons shielded."},
      {"name": "Garrison Occupation", "duration_minutes": 20, "start_minute": 20, "description": "Garrisons unlock. Worth +1800 pts/min — top priority."},
      {"name": "Temple Onslaught", "duration_minutes": 20, "start_minute": 40, "description": "Temple of Tides unlocks. Massive points. Requires control of transit hub connectors."}
    ],
    "key_structures": {
      "headquarters": {"points_per_min": 0, "description": "Home base, cannot be captured by enemies"},
      "garrison": {"points_per_min": 1800, "unlocks_at_minute": 20, "description": "Highest value holdable structure"},
      "transit_hub_connector": {"description": "Controls access to Temple of Tides. Defend at all costs."},
      "temple_of_tides": {"description": "Final stage mega objective. Requires transit hub connector control."},
      "cluster_of_ruins": {"points_per_min": 600, "description": "Standard holdable structure"}
    },
    "key_rules": [
      "Only register members who will actually show up — affects matchmaking",
      "Defend your own garrison first, then contest enemies",
      "Losing transit hub connector (A29/B29/C29) cuts off Temple access",
      "This is a single-alliance event — no cooperation with other alliances",
      "Three alliances compete simultaneously on the same map"
    ]
  }',
  '{
    "garrison_assault_weight": {"power": 0.4, "march_size": 0.3, "rally_capacity": 0.2, "hero_score": 0.1},
    "temple_assault_weight": {"power": 0.45, "march_size": 0.3, "rally_capacity": 0.15, "hero_score": 0.1},
    "defender_weight": {"power": 0.3, "march_size": 0.2, "troop_count": 0.3, "hero_score": 0.2},
    "support_weight": {"power": 0.2, "troop_count": 0.4, "hero_score": 0.4}
  }',
  '["Hold Garrison", "Control Transit Hub Connector", "Capture Temple of Tides", "Defend Headquarters", "Weaken enemies"]'
)
ON CONFLICT (slug) DO NOTHING;
