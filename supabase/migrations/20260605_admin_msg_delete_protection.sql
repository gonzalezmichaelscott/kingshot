-- Security: only a System Admin may delete a System-Admin-authored message.
--
-- Alliance chat (chat_messages) is deleted directly from the client with the
-- user's RLS-scoped Supabase client, so the DELETE policy is the authoritative
-- server-side check. The previous policy let any R4/R5/admin delete ANY message
-- in their alliance — including messages posted by a System Admin. This rewrites
-- the policy so non-admins can no longer delete admin-authored messages.
--
-- (World Chat and Leadership Chat delete via service-role API routes whose
-- author-only RLS already blocks direct client deletes, so the equivalent rule
-- for those is enforced in their route handlers.)
--
-- Run this in the Supabase SQL Editor.

DROP POLICY IF EXISTS "chat_delete_leaders" ON chat_messages;

CREATE POLICY "chat_delete_leaders" ON chat_messages FOR DELETE TO authenticated USING (
  alliance_id = get_user_alliance_id()
  AND get_user_role() IN ('r5', 'r4', 'system_admin')
  -- A System Admin may delete anything; everyone else is blocked from deleting
  -- a message whose author is a System Admin.
  AND (
    get_user_role() = 'system_admin'
    OR COALESCE(
         (SELECT role FROM user_profiles WHERE id = chat_messages.author_id),
         ''
       ) <> 'system_admin'
  )
);
