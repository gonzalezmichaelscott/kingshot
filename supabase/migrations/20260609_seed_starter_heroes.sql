-- Seed the 12 standard starter heroes onto every existing member.
--
-- All Kingshot accounts begin with these heroes, so seeding them means members
-- only need to update level/stars/skills rather than add each hero by hand.
--
-- Strictly additive: ON CONFLICT (member_id, hero_id) DO NOTHING means any hero a
-- player has ALREADY entered keeps its level, stars, widget, skills and primary
-- flag untouched. Only missing (member, hero) pairs are inserted at defaults.
INSERT INTO member_heroes (member_id, hero_id)
SELECT m.id, h.id
FROM members m
CROSS JOIN heroes h
WHERE h.name IN (
  'Fahd','Amane','Seth','Edwin','Forrest','Olive',
  'Yeonwoo','Gordon','Quinn','Chenko','Howard','Diana'
)
ON CONFLICT (member_id, hero_id) DO NOTHING;
