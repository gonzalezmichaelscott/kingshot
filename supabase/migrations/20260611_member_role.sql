-- FIX 3 — manual "Add Member" now records a starting rank for the roster entry.
-- The rank a leader may assign follows the existing hierarchy (see lib/access
-- addableMemberRanks): r4 → up to r3, r5 → up to r4, system_admin → any.
-- Elevated ranks (r4/r5) still route through the profile_requests approval flow
-- rather than being granted instantly, so the column defaults to 'r3'.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'r3';

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_role_check;
ALTER TABLE members ADD CONSTRAINT members_role_check
  CHECK (role IN ('r1','r2','r3','r4','r5'));
