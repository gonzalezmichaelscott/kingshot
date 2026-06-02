-- Feature 3: generic notifications (approval requests, mentions surface, etc.)
CREATE TABLE IF NOT EXISTS notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null, -- 'mention', 'approval_request', 'battle_plan', 'event'
  title text not null,
  message text,
  link text, -- where to navigate on click
  is_read boolean default false,
  related_id uuid, -- profile_request id, message id, event id etc
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_related_idx ON notifications (related_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
CREATE POLICY "Users can read their own notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Realtime delivery for the notification bell
ALTER TABLE notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- Feature 2/4: realtime for approval queues (first-to-resolve wins, live removal)
ALTER TABLE profile_requests REPLICA IDENTITY FULL;
ALTER TABLE kingdom_creation_requests REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profile_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profile_requests;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kingdom_creation_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE kingdom_creation_requests;
  END IF;
END $$;

-- Feature 5: Swordland Showdown dual-legion start times
ALTER TABLE events ADD COLUMN IF NOT EXISTS legion1_start_utc timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS legion2_start_utc timestamptz;

-- Backfill: existing battle_start_utc becomes Legion 1 start for back-compat
UPDATE events SET legion1_start_utc = battle_start_utc
WHERE legion1_start_utc IS NULL AND battle_start_utc IS NOT NULL;
