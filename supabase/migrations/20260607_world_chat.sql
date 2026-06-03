-- World Chat: a single global chat room open to every authenticated user across
-- all alliances and kingdoms. Messages carry only the author id; the sender's
-- game tag + alliance tag are resolved at read time (player_name -> display_name,
-- alliance tag in brackets, "Guest" when the user has no alliance).

CREATE TABLE IF NOT EXISTS world_chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  content text not null,
  attachments jsonb default '[]',
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS world_chat_messages_created_idx
  ON world_chat_messages (created_at);

ALTER TABLE world_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read world chat" ON world_chat_messages;
CREATE POLICY "Anyone authenticated can read world chat" ON world_chat_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone authenticated can send world chat" ON world_chat_messages;
CREATE POLICY "Anyone authenticated can send world chat" ON world_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete own world chat messages" ON world_chat_messages;
CREATE POLICY "Authors can delete own world chat messages" ON world_chat_messages
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Realtime delivery. REPLICA IDENTITY FULL so DELETE payloads carry the id our
-- subscription needs to remove the row from the live list.
ALTER TABLE world_chat_messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'world_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE world_chat_messages;
  END IF;
END $$;
