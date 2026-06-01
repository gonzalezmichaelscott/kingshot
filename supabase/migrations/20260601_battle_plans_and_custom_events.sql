-- ============================================================
-- Feature A: Battle Plan Deployment to Member Profiles
-- ============================================================

ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS member_instructions text;
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS instruction_generated_at timestamptz;

-- ============================================================
-- Feature B: Custom One-Off Events
-- ============================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_instructions text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_instructions_html text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_images jsonb DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'all';
-- visibility: 'all', 'r4_plus', 'specific'
ALTER TABLE events ADD COLUMN IF NOT EXISTS visible_to_members jsonb DEFAULT '[]';
-- visible_to_members: array of member IDs if visibility = 'specific'

-- Widen status check to support 'published' for custom events (published = visible to members)
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check
  CHECK (status IN ('planning','registration','active','completed','published','draft'));

-- RLS for event_assignments already covers member_instructions via existing policies
