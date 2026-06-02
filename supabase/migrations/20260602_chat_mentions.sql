-- @ mentions in alliance chat.
-- Stores one row per (message, mentioned member) so notifications can be looked
-- up and marked read per recipient.

CREATE TABLE IF NOT EXISTS chat_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references chat_messages(id) on delete cascade,
  mentioned_member_id uuid references members(id) on delete cascade,
  alliance_id uuid references alliances(id) on delete cascade,
  is_read boolean default false,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS chat_mentions_member_idx
  ON chat_mentions (mentioned_member_id, is_read);
CREATE INDEX IF NOT EXISTS chat_mentions_message_idx
  ON chat_mentions (message_id);

ALTER TABLE chat_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their own mentions" ON chat_mentions;
CREATE POLICY "Members can read their own mentions" ON chat_mentions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE id = chat_mentions.mentioned_member_id
      AND linked_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert mentions" ON chat_mentions;
CREATE POLICY "System can insert mentions" ON chat_mentions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Members can mark their own mentions as read" ON chat_mentions;
CREATE POLICY "Members can mark their own mentions as read" ON chat_mentions
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE id = chat_mentions.mentioned_member_id
      AND linked_user_id = auth.uid()
    )
  );

-- Realtime delivery of new mentions to the recipient's notification bell.
-- REPLICA IDENTITY FULL so UPDATE/DELETE payloads carry the columns our
-- subscription filters on (mentioned_member_id).
ALTER TABLE chat_mentions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_mentions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_mentions;
  END IF;
END $$;
