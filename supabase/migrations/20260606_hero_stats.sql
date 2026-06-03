-- =============================================================================
-- 20260606_hero_stats.sql — Missing heroes, rarity tier, stat bonus tables
-- Run this in the Supabase SQL Editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1 — Missing heroes + schema columns
-- ---------------------------------------------------------------------------

-- Helga (Gen 1, Mythic, Infantry) - garrison/defensive hero
-- Same stat table as Saul/Jabel
INSERT INTO heroes (name, generation, troop_type, role, rarity, has_widget, expedition_skill_count, primary_role)
VALUES ('Helga', 1, 'infantry', 'garrison', 'mythic', true, 3, 'garrison')
ON CONFLICT (name) DO NOTHING;

-- Seth (Gen 1, Rare/Blue, Infantry) - ECONOMY HERO ONLY, no combat value
-- Expedition skills: Iron Mine Income, Iron Mining Speed
INSERT INTO heroes (name, generation, troop_type, role, rarity, has_widget, expedition_skill_count, primary_role)
VALUES ('Seth', 1, 'infantry', 'support', 'rare', false, 2, 'economy')
ON CONFLICT (name) DO NOTHING;

-- Olive (Gen 1, Rare/Blue, Archer) - ECONOMY HERO ONLY, no combat value
-- Expedition skills: Mill Income (Bread), Bread Gathering Speed
INSERT INTO heroes (name, generation, troop_type, role, rarity, has_widget, expedition_skill_count, primary_role)
VALUES ('Olive', 1, 'archer', 'support', 'rare', false, 2, 'economy')
ON CONFLICT (name) DO NOTHING;

-- Edwin (Gen 1, Rare/Blue, Cavalry) - ECONOMY HERO ONLY, no combat value
-- Expedition skills: Quarry Income (Stone), Stone Gathering Speed
INSERT INTO heroes (name, generation, troop_type, role, rarity, has_widget, expedition_skill_count, primary_role)
VALUES ('Edwin', 1, 'cavalry', 'support', 'rare', false, 2, 'economy')
ON CONFLICT (name) DO NOTHING;

-- Forrest (Gen 1, Rare/Blue, Infantry) - ECONOMY HERO ONLY, no combat value
-- Expedition skills: Sawmill Income (Wood), Wood Gathering Speed
INSERT INTO heroes (name, generation, troop_type, role, rarity, has_widget, expedition_skill_count, primary_role)
VALUES ('Forrest', 1, 'infantry', 'support', 'rare', false, 2, 'economy')
ON CONFLICT (name) DO NOTHING;

-- Add rarity check constraint update to support 'rare' tier
ALTER TABLE heroes DROP CONSTRAINT IF EXISTS heroes_rarity_check;
ALTER TABLE heroes ADD CONSTRAINT heroes_rarity_check
  CHECK (rarity IN ('rare', 'epic', 'mythic', 'legendary'));

-- Add stat_bonuses column
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS stat_bonuses jsonb DEFAULT '{}';

-- Add is_economy_hero flag
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS is_economy_hero boolean DEFAULT false;

-- Mark economy heroes
UPDATE heroes SET is_economy_hero = true WHERE name IN ('Seth', 'Olive', 'Edwin', 'Forrest');

-- ---------------------------------------------------------------------------
-- PART 2 — Hero stat bonus data.
-- Key format: "[star]_[shard]" = Attack/Defense % bonus. "max" = maxed 5-star.
-- ---------------------------------------------------------------------------

-- FORREST / SETH (Rare heroes, same stat table — lowest tier)
UPDATE heroes SET stat_bonuses = '{
  "0_0":11.36,"0_1":12.42,"0_2":13.47,"0_3":14.53,"0_4":15.59,"0_5":16.65,
  "1_0":18.55,"1_1":20.03,"1_2":21.51,"1_3":22.99,"1_4":24.47,"1_5":25.95,
  "2_0":28.62,"2_1":30.69,"2_2":32.76,"2_3":34.83,"2_4":36.90,"2_5":38.98,
  "3_0":42.71,"3_1":45.61,"3_2":48.51,"3_3":51.41,"3_4":54.31,"3_5":57.22,
  "4_0":62.44,"4_1":66.50,"4_2":70.56,"4_3":74.63,"4_4":78.69,"4_5":82.75,
  "max":90.07
}' WHERE name IN ('Forrest','Seth');

-- OLIVE / EDWIN (Rare heroes, start at 1-star minimum)
UPDATE heroes SET stat_bonuses = '{
  "1_0":18.55,"1_1":20.03,"1_2":21.51,"1_3":22.99,"1_4":24.47,"1_5":25.95,
  "2_0":28.62,"2_1":30.69,"2_2":32.76,"2_3":34.83,"2_4":36.90,"2_5":38.98,
  "3_0":42.71,"3_1":45.61,"3_2":48.51,"3_3":51.41,"3_4":54.31,"3_5":57.22,
  "4_0":62.44,"4_1":66.50,"4_2":70.56,"4_3":74.63,"4_4":78.69,"4_5":82.75,
  "max":90.07
}' WHERE name IN ('Olive','Edwin');

-- DIANA (Epic, lowest stat ceiling among Epics)
UPDATE heroes SET stat_bonuses = '{
  "0_0":13.88,"0_1":15.18,"0_2":16.47,"0_3":17.76,"0_4":19.05,"0_5":20.35,
  "1_0":22.67,"1_1":24.48,"1_2":26.29,"1_3":28.10,"1_4":29.91,"1_5":31.72,
  "2_0":34.98,"2_1":37.51,"2_2":40.04,"2_3":42.58,"2_4":45.11,"2_5":47.64,
  "3_0":52.50,"3_1":55.75,"3_2":59.29,"3_3":62.84,"3_4":66.39,"3_5":69.93,
  "4_0":76.32,"4_1":81.28,"4_2":86.25,"4_3":91.21,"4_4":96.18,"4_5":101.15,
  "max":110.08
}' WHERE name = 'Diana';

-- HOWARD / QUINN / AMANE / YEONWOO / CHENKO / GORDON / FAHD (Epic heroes, identical stat tables)
UPDATE heroes SET stat_bonuses = '{
  "0_0":17.76,"0_1":19.32,"0_2":20.96,"0_3":22.61,"0_4":24.25,"0_5":25.90,
  "1_0":28.86,"1_1":31.16,"1_2":33.46,"1_3":35.77,"1_4":38.07,"1_5":40.37,
  "2_0":44.52,"2_1":47.74,"2_2":50.96,"2_3":54.19,"2_4":57.41,"2_5":60.64,
  "3_0":66.44,"3_1":70.95,"3_2":75.46,"3_3":79.98,"3_4":84.49,"3_5":89.01,
  "4_0":97.13,"4_1":103.45,"4_2":109.77,"4_3":116.09,"4_4":122.41,"4_5":128.73,
  "max":140.11
}' WHERE name IN ('Howard','Quinn','Amane','Yeonwoo','Chenko','Gordon','Fahd');

-- HELGA / SAUL / JABEL (Mythic Gen 1, identical stat tables)
UPDATE heroes SET stat_bonuses = '{
  "0_0":25.25,"0_1":27.60,"0_2":29.95,"0_3":32.30,"0_4":34.65,"0_5":37.00,
  "1_0":41.23,"1_1":44.52,"1_2":47.81,"1_3":51.10,"1_4":54.39,"1_5":57.68,
  "2_0":63.60,"2_1":68.20,"2_2":72.81,"2_3":77.42,"2_4":82.02,"2_5":86.63,
  "3_0":94.92,"3_1":101.37,"3_2":107.81,"3_3":114.26,"3_4":120.71,"3_5":127.16,
  "4_0":138.77,"4_1":147.79,"4_2":156.82,"4_3":165.85,"4_4":174.88,"4_5":183.91,
  "max":200.16
}' WHERE name IN ('Helga','Saul','Jabel');

-- ZOE / MARLIN / HILDE (Gen 2 Mythic, identical stat tables)
UPDATE heroes SET stat_bonuses = '{
  "0_0":30.30,"0_1":33.12,"0_2":35.94,"0_3":38.76,"0_4":41.58,"0_5":44.40,
  "1_0":49.47,"1_1":53.42,"1_2":57.37,"1_3":61.32,"1_4":65.26,"1_5":69.21,
  "2_0":76.32,"2_1":81.84,"2_2":87.37,"2_3":92.90,"2_4":98.42,"2_5":103.95,
  "3_0":113.90,"3_1":121.64,"3_2":129.37,"3_3":137.11,"3_4":144.85,"3_5":152.59,
  "4_0":166.52,"4_1":177.34,"4_2":188.18,"4_3":192.02,"4_4":209.85,"4_5":220.69,
  "max":240.10
}' WHERE name IN ('Zoe','Marlin','Hilde');

-- AMADEUS (Gen 1 Mythic - higher stats than other Gen 1 due to unique offensive widget)
UPDATE heroes SET stat_bonuses = '{
  "0_0":32.82,"0_1":35.88,"0_2":38.93,"0_3":41.99,"0_4":45.04,"0_5":48.10,
  "1_0":53.59,"1_1":57.87,"1_2":62.15,"1_3":66.43,"1_4":70.70,"1_5":74.98,
  "2_0":82.68,"2_1":88.66,"2_2":94.65,"2_3":100.64,"2_4":106.62,"2_5":112.61,
  "3_0":123.39,"3_1":131.78,"3_2":140.15,"3_3":148.53,"3_4":156.92,"3_5":165.30,
  "4_0":180.40,"4_1":192.12,"4_2":203.86,"4_3":215.60,"4_4":227.34,"4_5":239.08,
  "max":260.20
}' WHERE name = 'Amadeus';

-- ERIC / JAEGER / PETRA (Gen 3 Mythic, identical stat tables)
UPDATE heroes SET stat_bonuses = '{
  "0_0":36.61,"0_1":40.02,"0_2":43.42,"0_3":46.83,"0_4":50.24,"0_5":53.65,
  "1_0":59.78,"1_1":64.55,"1_2":69.32,"1_3":74.09,"1_4":78.86,"1_5":83.63,
  "2_0":92.22,"2_1":98.89,"2_2":105.57,"2_3":112.25,"2_4":118.92,"2_5":125.61,
  "3_0":137.63,"3_1":146.98,"3_2":156.32,"3_3":165.67,"3_4":175.02,"3_5":184.38,
  "4_0":201.21,"4_1":214.29,"4_2":227.38,"4_3":240.48,"4_4":253.57,"4_5":266.66,
  "max":290.23
}' WHERE name IN ('Eric','Jaeger','Petra');

-- ROSA / ALCAR / MARGOT (Gen 4 Mythic, identical stat tables)
UPDATE heroes SET stat_bonuses = '{
  "0_0":46.71,"0_1":51.06,"0_2":55.40,"0_3":59.75,"0_4":64.10,"0_5":68.45,
  "1_0":76.27,"1_1":82.36,"1_2":88.44,"1_3":94.53,"1_4":100.62,"1_5":106.70,
  "2_0":117.66,"2_1":126.17,"2_2":134.69,"2_3":143.22,"2_4":151.73,"2_5":160.26,
  "3_0":175.60,"3_1":187.53,"3_2":199.44,"3_3":211.38,"3_4":223.31,"3_5":235.24,
  "4_0":256.72,"4_1":273.41,"4_2":290.11,"4_3":306.82,"4_4":323.52,"4_5":340.23,
  "max":370.29
}' WHERE name IN ('Rosa','Alcar','Margot');

-- LONG FEI / VIVIAN / THRUD (Gen 5 Mythic, identical stat tables)
UPDATE heroes SET stat_bonuses = '{
  "0_0":56.05,"0_1":61.27,"0_2":66.48,"0_3":71.70,"0_4":76.92,"0_5":82.14,
  "1_0":91.53,"1_1":98.83,"1_2":106.13,"1_3":113.44,"1_4":120.74,"1_5":128.04,
  "2_0":141.19,"2_1":151.40,"2_2":161.63,"2_3":171.87,"2_4":182.08,"2_5":192.31,
  "3_0":210.72,"3_1":225.04,"3_2":239.33,"3_3":253.65,"3_4":267.97,"3_5":282.29,
  "4_0":308.06,"4_1":328.09,"4_2":348.14,"4_3":368.18,"4_4":388.23,"4_5":408.28,
  "max":444.35
}' WHERE name IN ('Long Fei','Vivian','Thrud');

-- TRITON / YANG / SOPHIA (Gen 6 Mythic, identical stat tables)
UPDATE heroes SET stat_bonuses = '{
  "0_0":68.17,"0_1":74.52,"0_2":80.86,"0_3":87.21,"0_4":93.55,"0_5":99.90,
  "1_0":111.32,"1_1":120.20,"1_2":129.08,"1_3":137.97,"1_4":146.85,"1_5":155.73,
  "2_0":171.72,"2_1":184.14,"2_2":196.58,"2_3":209.03,"2_4":221.45,"2_5":233.90,
  "3_0":256.28,"3_1":273.69,"3_2":291.08,"3_3":308.50,"3_4":325.91,"3_5":343.33,
  "4_0":374.67,"4_1":399.03,"4_2":423.41,"4_3":447.79,"4_4":472.17,"4_5":496.55,
  "max":540.43
}' WHERE name IN ('Triton','Yang','Sophia');

-- Gen 7 heroes (Ava, Charles, Wee & Woo) - stat data not yet available, leave empty
