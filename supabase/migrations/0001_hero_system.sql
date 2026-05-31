-- =============================================================================
-- 0001_hero_system.sql  — Hero System Overhaul (PART 1: schema migrations)
-- Run this in the Supabase SQL Editor BEFORE running the data scripts
-- (scripts/update-heroes.ts and scripts/update-scoring-weights.ts).
--
-- DDL (ALTER TABLE / type changes) cannot be executed through the Supabase
-- JS client, so this file is the authoritative migration for schema changes.
-- The hero seed data (PART 2) and scoring weights (PART 4) are applied by the
-- TypeScript scripts, which only require these columns to already exist.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- member_heroes: hero level range is 1-80 (not 1-60); add shard + widget cols
-- ---------------------------------------------------------------------------
ALTER TABLE member_heroes ALTER COLUMN hero_level SET DEFAULT 1;
ALTER TABLE member_heroes ADD COLUMN IF NOT EXISTS star_shards   integer DEFAULT 0;
ALTER TABLE member_heroes ADD COLUMN IF NOT EXISTS widget_level  integer DEFAULT 0;
ALTER TABLE member_heroes ADD COLUMN IF NOT EXISTS widget_unlocked boolean DEFAULT false;

-- ---------------------------------------------------------------------------
-- heroes: metadata columns for the new hero system
-- ---------------------------------------------------------------------------
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS expedition_skill_count integer DEFAULT 3;
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS has_widget    boolean DEFAULT true;
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS primary_role  text    DEFAULT 'flex';
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS expedition_skills jsonb DEFAULT '[]';
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS widget_effect jsonb DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- heroes.rarity is currently an ENUM (common|rare|epic|legendary) which does
-- NOT include 'mythic'. Convert it to free text so the hero seed can set
-- 'mythic' / 'epic'. (ADD COLUMN IF NOT EXISTS would silently no-op here.)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'heroes' AND column_name = 'rarity'
  ) THEN
    ALTER TABLE heroes ALTER COLUMN rarity DROP DEFAULT;
    ALTER TABLE heroes ALTER COLUMN rarity TYPE text USING rarity::text;
    ALTER TABLE heroes ALTER COLUMN rarity SET DEFAULT 'mythic';
  ELSE
    ALTER TABLE heroes ADD COLUMN rarity text DEFAULT 'mythic';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rarity / widget / skill-count classification
--   Epic heroes  = no widget, 2 expedition skills
--   Mythic heroes = widget, 3 base expedition skills (+1 widget skill = 4)
-- ---------------------------------------------------------------------------
UPDATE heroes
SET rarity = 'epic', has_widget = false, expedition_skill_count = 2
WHERE name IN ('Howard', 'Gordon', 'Quinn', 'Chenko', 'Diana', 'Yeonwoo', 'Amane', 'Fahd');

UPDATE heroes
SET rarity = 'mythic', has_widget = true, expedition_skill_count = 3
WHERE name NOT IN ('Howard', 'Gordon', 'Quinn', 'Chenko', 'Diana', 'Yeonwoo', 'Amane', 'Fahd');

-- After running this file:
--   1. Set real values in .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
--   2. npx tsx scripts/update-heroes.ts
--   3. npx tsx scripts/update-scoring-weights.ts
--   4. Recalculate member scores from the alliance Analytics/Members page.
