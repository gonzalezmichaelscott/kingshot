-- FIX 2 — manual structure overrides can now place a player in a specific castle
-- rally (Rally 1/2/3). Persist that position on the assignment row. NULL means
-- "no explicit rally" (AI-generated assignments are auto-distributed by capacity).
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE event_assignments
  ADD COLUMN IF NOT EXISTS rally_number smallint;

COMMENT ON COLUMN event_assignments.rally_number IS
  'Manual override: which castle rally (1-3) this leader/joiner belongs to. NULL = auto-distributed.';
