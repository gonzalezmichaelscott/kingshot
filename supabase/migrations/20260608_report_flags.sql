-- World Chat (and general) message moderation: users can report a message; once
-- a message accumulates 3+ pending reports it is auto-hidden from the world-chat
-- feed pending System Admin review.

CREATE TABLE IF NOT EXISTS report_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  message_type text check (message_type in ('world_chat', 'alliance_chat', 'board')),
  reported_by uuid references auth.users(id) on delete set null,
  reason text,
  status text check (status in ('pending', 'reviewed', 'dismissed')) default 'pending',
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS report_flags_message_idx ON report_flags (message_id, status);
CREATE INDEX IF NOT EXISTS report_flags_status_idx ON report_flags (status);
-- One report per user per message (prevents a single user inflating the count).
CREATE UNIQUE INDEX IF NOT EXISTS report_flags_unique_reporter
  ON report_flags (message_id, reported_by);

ALTER TABLE report_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert reports" ON report_flags;
CREATE POLICY "Users can insert reports" ON report_flags
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Admins can manage reports" ON report_flags;
CREATE POLICY "Admins can manage reports" ON report_flags
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin')
  );
