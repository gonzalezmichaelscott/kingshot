-- ============================================================
-- FEATURE 1: "Willing to move for KVK" toggle + cross-alliance planning
-- ============================================================

-- The core column required by the task:
ALTER TABLE members ADD COLUMN IF NOT EXISTS kvk_willing_to_move boolean DEFAULT false;

-- Track who set the willing-to-move flag (member self vs. an alliance leader).
-- When set by a leader the self-service / admin views show "Set by [leader name]".
ALTER TABLE members ADD COLUMN IF NOT EXISTS kvk_willing_set_by uuid;       -- user_profiles.id of the leader, null if self-set

-- Cross-alliance ("KVK Transfer") assignment metadata, surfaced as an amber badge
-- on assignment cards and a message on the member self-service page.
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS kvk_transfer boolean DEFAULT false;
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS transfer_alliance text;     -- name/tag of the alliance the member should join for the rally
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS transfer_rally_leader text; -- the rally leader they would join

-- ============================================================
-- FEATURE 2: R4/R5 attendance management
-- ============================================================

-- When an alliance leader sets attendance/availability on a member's behalf we
-- record their user id. The member's assignment card then shows
-- "Attendance confirmed by your alliance leader".
ALTER TABLE event_availability ADD COLUMN IF NOT EXISTS manually_set_by uuid;

-- ============================================================
-- FEATURE 4-7: Rally timer — synchronized start, countdown, landing mode
-- ============================================================

-- Landing mode is shared with every viewer of a session so the staggered plan
-- renders identically everywhere.
ALTER TABLE rally_timer_sessions ADD COLUMN IF NOT EXISTS landing_mode text DEFAULT 'simultaneous';  -- 'simultaneous' | 'staggered'
ALTER TABLE rally_timer_sessions ADD COLUMN IF NOT EXISTS landing_gap integer DEFAULT 3;              -- seconds between staggered landings
