-- Fix realtime delivery for chat_messages.
--
-- Problem 1: The existing chat_read_alliance policy calls get_user_alliance_id(),
-- a SECURITY DEFINER function. Supabase Realtime evaluates RLS policies when
-- deciding whether to deliver a WAL event to a subscriber. In that context
-- SECURITY DEFINER functions run as the function owner and auth.uid() may
-- resolve to null, so the policy check silently fails and other users never
-- receive INSERT events. The fix is an inline EXISTS subquery that calls
-- auth.uid() directly — Supabase Realtime handles this path correctly.
--
-- Problem 2: chat_messages uses REPLICA IDENTITY DEFAULT (primary key only).
-- DELETE events only carry the PK in the old-row payload, so the
-- alliance_id=eq.{id} filter can never match on deletes. REPLICA IDENTITY FULL
-- makes the entire old row available so the filter works for all event types.

-- Replace the SELECT policy with an inline auth.uid() check
DROP POLICY IF EXISTS "chat_read_alliance" ON chat_messages;

CREATE POLICY "Alliance members can read chat messages"
ON chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND alliance_id = chat_messages.alliance_id
  )
  OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('system_admin', 'kingdom_leader')
  )
);

-- Full replica identity so DELETE events carry alliance_id for filter matching
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- Add table to realtime publication (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;
