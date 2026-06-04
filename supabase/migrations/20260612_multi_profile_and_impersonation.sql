-- FEATURE 1 — Multi-profile support: a single login can own several member
-- profiles (alts) across alliances and switch the "active" one.
CREATE TABLE IF NOT EXISTS user_member_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  is_active_profile boolean default false,
  linked_at timestamptz default now(),
  UNIQUE(user_id, member_id)
);

ALTER TABLE user_member_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile links" ON user_member_profiles;
CREATE POLICY "Users can read their own profile links" ON user_member_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own profile links" ON user_member_profiles;
CREATE POLICY "Users can manage their own profile links" ON user_member_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- The member id of the user's currently-active profile.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_member_id uuid REFERENCES members(id);

-- Distinguishes an additional-account (alt) join request so its approval creates
-- a NEW linked member instead of relinking the user's existing/primary record.
ALTER TABLE profile_requests ADD COLUMN IF NOT EXISTS is_alt boolean DEFAULT false;

-- FEATURE 2 — Account impersonation reporting + blacklist.
CREATE TABLE IF NOT EXISTS impersonation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id),
  reporter_email text not null,
  claimed_player_id text not null,
  claimed_player_name text,
  suspected_member_id uuid references members(id),
  description text not null,
  status text check (status in ('pending','investigating','resolved_restored','resolved_dismissed')) default 'pending',
  admin_notes text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

ALTER TABLE impersonation_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit impersonation reports" ON impersonation_reports;
CREATE POLICY "Anyone can submit impersonation reports" ON impersonation_reports
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can submit reports" ON impersonation_reports;
CREATE POLICY "Authenticated users can submit reports" ON impersonation_reports
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Reporters can read their own reports" ON impersonation_reports;
CREATE POLICY "Reporters can read their own reports" ON impersonation_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Admins can manage all reports" ON impersonation_reports;
CREATE POLICY "Admins can manage all reports" ON impersonation_reports
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin')
  );

CREATE TABLE IF NOT EXISTS blacklisted_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id),
  reason text not null,
  blacklisted_by uuid references auth.users(id),
  created_at timestamptz default now()
);

ALTER TABLE blacklisted_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage blacklist" ON blacklisted_accounts;
CREATE POLICY "Admins can manage blacklist" ON blacklisted_accounts
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin')
  );
