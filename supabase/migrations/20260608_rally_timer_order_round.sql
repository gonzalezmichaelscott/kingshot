-- Rally Timer: manual landing order + round counter
-- Adds the columns needed for FIX 1 (persisted custom landing order so all
-- viewers see the same order) and FIX 2 (round counter across auto-resets).
ALTER TABLE rally_timer_sessions
  ADD COLUMN IF NOT EXISTS landing_mode text DEFAULT 'simultaneous';
ALTER TABLE rally_timer_sessions
  ADD COLUMN IF NOT EXISTS landing_gap int DEFAULT 3;
ALTER TABLE rally_timer_sessions
  ADD COLUMN IF NOT EXISTS custom_order jsonb;
ALTER TABLE rally_timer_sessions
  ADD COLUMN IF NOT EXISTS round int DEFAULT 1;
