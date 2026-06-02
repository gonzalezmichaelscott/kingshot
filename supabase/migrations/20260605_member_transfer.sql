-- ============================================================
-- MEMBER TRANSFER SUPPORT (alliance change + kingdom/server change)
-- Run this in the Supabase SQL Editor.
-- ============================================================
--
-- When a member moves to a different alliance (or a different kingdom/server),
-- their stats, heroes, troop data, combat stats and scores carry over to the
-- new member record. The OLD record is kept for historical reference but marked
-- inactive, with `transferred_to` pointing at the new record so old self-service
-- links can redirect to the new one.

ALTER TABLE members ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE members ADD COLUMN IF NOT EXISTS transferred_to uuid REFERENCES members(id);
ALTER TABLE members ADD COLUMN IF NOT EXISTS previous_alliance_id uuid REFERENCES alliances(id);

-- Helpful indexes for the redirect lookup and "find my previous record" queries.
CREATE INDEX IF NOT EXISTS idx_members_transferred_to ON members(transferred_to);
CREATE INDEX IF NOT EXISTS idx_members_linked_user_active ON members(linked_user_id) WHERE is_active;
