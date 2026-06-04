-- FIX 4 — Leadership Chat: a kingdom-level room for R4/R5/system_admin across
-- every alliance in a kingdom.

CREATE TABLE IF NOT EXISTS leadership_chat_messages (
  id uuid primary key default gen_random_uuid(),
  kingdom_id uuid references kingdoms(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  content text not null,
  attachments jsonb default '[]',
  created_at timestamptz default now()
);

ALTER TABLE leadership_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "R4 R5 admin can read leadership chat" ON leadership_chat_messages;
CREATE POLICY "R4 R5 admin can read leadership chat" ON leadership_chat_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN alliances a ON up.alliance_id = a.id
      WHERE up.id = auth.uid()
      AND a.kingdom_id = leadership_chat_messages.kingdom_id
      AND up.role IN ('r4','r5','system_admin')
    )
  );

DROP POLICY IF EXISTS "R4 R5 admin can send leadership chat" ON leadership_chat_messages;
CREATE POLICY "R4 R5 admin can send leadership chat" ON leadership_chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN alliances a ON up.alliance_id = a.id
      WHERE up.id = auth.uid()
      AND a.kingdom_id = leadership_chat_messages.kingdom_id
      AND up.role IN ('r4','r5','system_admin')
    )
  );

DROP POLICY IF EXISTS "Authors can delete own leadership messages" ON leadership_chat_messages;
CREATE POLICY "Authors can delete own leadership messages" ON leadership_chat_messages
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Realtime — guard against re-adding when the table is already in the publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'leadership_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leadership_chat_messages;
  END IF;
END $$;
