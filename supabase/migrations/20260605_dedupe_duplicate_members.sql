-- One-off cleanup for the manual-add R4/R5 duplicate-member bug.
--
-- Before the fix, approving a manually-added member with an elevated rank
-- INSERTED a second member row instead of updating the existing one, leaving two
-- active profiles for the same player in the same alliance.
--
-- This soft-deletes (is_active = false) the redundant rows: for each
-- (alliance_id, game_id) group it KEEPS the richest row — highest power, then
-- most recently updated — and deactivates the others. Only rows with a non-null
-- game_id are considered (a member can legitimately exist in different alliances;
-- duplicates only matter WITHIN one alliance).
--
-- Run this in the Supabase SQL Editor. It is idempotent — re-running it leaves a
-- de-duplicated table unchanged.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY alliance_id, game_id
      ORDER BY COALESCE(power, 0) DESC, updated_at DESC NULLS LAST, id
    ) AS rn
  FROM members
  WHERE game_id IS NOT NULL
    AND is_active = true
)
UPDATE members m
SET is_active = false,
    updated_at = now()
FROM ranked r
WHERE m.id = r.id
  AND r.rn > 1;
