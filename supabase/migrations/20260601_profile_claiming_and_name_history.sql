-- ============================================================
-- PROFILE CLAIMING & NAME HISTORY
-- Run this in Supabase SQL Editor
-- ============================================================

-- Name history column on members
ALTER TABLE members ADD COLUMN IF NOT EXISTS name_history jsonb DEFAULT '[]';

-- Profile claim requests table
CREATE TABLE IF NOT EXISTS profile_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  requesting_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  alliance_id uuid REFERENCES alliances(id) ON DELETE CASCADE,
  status text CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profile_claim_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own claim requests
CREATE POLICY "Users can insert own claim requests" ON profile_claim_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requesting_user_id);

-- Users can read their own claim requests
CREATE POLICY "Users can read own claim requests" ON profile_claim_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requesting_user_id);

-- R4/R5/system_admin can manage all claim requests for their alliance
CREATE POLICY "R4 R5 can manage claim requests" ON profile_claim_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('r4', 'r5', 'system_admin')
        AND (
          role = 'system_admin'
          OR alliance_id = profile_claim_requests.alliance_id
        )
    )
  );
