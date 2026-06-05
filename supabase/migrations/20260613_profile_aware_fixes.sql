-- Multi-profile data-corruption fix batch (2026-06-13)
--
-- A single auth account can own several member records (alts / different
-- alliances). The rejoin approval flow previously relinked "any member record
-- the user owned in another alliance", which could move/overwrite the WRONG
-- profile when the user had more than one. We now record the EXACT member
-- record a rejoin request applies to so approval relinks only that record.

ALTER TABLE profile_requests
  ADD COLUMN IF NOT EXISTS source_member_id uuid REFERENCES members(id) ON DELETE SET NULL;

COMMENT ON COLUMN profile_requests.source_member_id IS
  'The specific member record this rejoin/move request applies to. On approval only this record is relinked to the new alliance — never "any member of the user".';
