-- Add detailed troop data column to members table
-- Run this in the Supabase SQL editor before deploying the troop data feature.

ALTER TABLE members ADD COLUMN IF NOT EXISTS troop_data jsonb DEFAULT '{}';

-- troop_data JSON structure:
-- {
--   "infantry": {
--     "T1": 0, "T2": 0, "T3": 0, "T4": 0, "T5": 0,
--     "T6": 0, "T7": 0, "T8": 0, "T9": 0, "T10": 0,
--     "TG1": 0, "TG2": 0, "TG3": 0, "TG4": 0,
--     "TG5": 0, "TG6": 0, "TG7": 0, "TG8": 0
--   },
--   "cavalry": { <same structure> },
--   "archer":  { <same structure> }
-- }

-- troop_count remains the auto-computed sum and is updated by the /api/member/stats PATCH endpoint.
