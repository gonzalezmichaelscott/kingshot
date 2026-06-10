-- Fix incorrect hero troop_type classifications
UPDATE heroes SET troop_type = 'cavalry'  WHERE name ILIKE 'Hilde';
UPDATE heroes SET troop_type = 'infantry' WHERE name ILIKE 'Zoe';
UPDATE heroes SET troop_type = 'cavalry'  WHERE name ILIKE 'Fahd';
UPDATE heroes SET troop_type = 'archer'   WHERE name ILIKE 'Amane';
UPDATE heroes SET troop_type = 'cavalry'  WHERE name ILIKE 'Gordon';
UPDATE heroes SET troop_type = 'archer'   WHERE name ILIKE 'Quinn';
UPDATE heroes SET troop_type = 'infantry' WHERE name ILIKE 'Howard';
UPDATE heroes SET troop_type = 'archer'   WHERE name ILIKE 'Diana';
UPDATE heroes SET troop_type = 'archer'   WHERE name ILIKE 'Saul';
