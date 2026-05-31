-- Backfill legacy role values so the new CHECK constraint validates cleanly.
-- (Postgres validates existing rows when ADD CONSTRAINT runs.)
UPDATE user_profiles SET role = 'r3' WHERE role = 'member';
UPDATE user_profiles SET role = 'r5' WHERE role = 'kingdom_leader';

-- Update role constraint to include R1-R3
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('system_admin','r5','r4','r3','r2','r1'));

-- Profile requests (R1/R2/R3 joining existing alliance)
CREATE TABLE IF NOT EXISTS profile_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  alliance_id uuid references alliances(id) on delete cascade,
  governor_name text not null,
  player_id text,
  requested_role text check (requested_role in ('r1','r2','r3','r4','r5')) not null,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  reviewed_by uuid references auth.users(id),
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Kingdom/Alliance creation requests
CREATE TABLE IF NOT EXISTS kingdom_creation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  request_type text check (request_type in ('new_kingdom','new_alliance')) not null,
  kingdom_number integer,
  kingdom_name text,
  kingdom_id uuid references kingdoms(id), -- filled if kingdom already exists
  alliance_name text not null,
  alliance_tag text not null,
  governor_name text not null,
  player_id text not null,
  requested_role text check (requested_role in ('r4','r5')) not null,
  admin_role_override text check (admin_role_override in ('r4','r5')),
  status text check (status in ('pending','approved','rejected')) default 'pending',
  reviewed_by uuid references auth.users(id),
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies
ALTER TABLE profile_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE kingdom_creation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own profile requests" ON profile_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own profile requests" ON profile_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "R4 R5 can manage profile requests for their alliance" ON profile_requests
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND alliance_id = profile_requests.alliance_id
      AND role IN ('r4','r5','system_admin')
    )
  );

CREATE POLICY "System admin can manage all profile requests" ON profile_requests
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin')
  );

CREATE POLICY "Users can insert own kingdom requests" ON kingdom_creation_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own kingdom requests" ON kingdom_creation_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "System admin can manage all kingdom requests" ON kingdom_creation_requests
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin')
  );
