-- ============================================================
-- RLS PATCH: Allow r5 and system_admin to create alliances
-- Run this in Supabase SQL Editor after the main schema.sql
-- ============================================================

-- Drop the existing write policy and replace with one that allows r5 too
DROP POLICY IF EXISTS "alliances_write_admin" ON alliances;

CREATE POLICY "alliances_write_leaders" ON alliances
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin', 'kingdom_leader', 'r5'));

CREATE POLICY "alliances_update_leaders" ON alliances
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('system_admin', 'kingdom_leader', 'r5'));

CREATE POLICY "alliances_delete_admin" ON alliances
  FOR DELETE TO authenticated
  USING (get_user_role() IN ('system_admin'));

-- Allow members (any authenticated user) to update their OWN member row
-- This is needed for the /member/[token] portal when accessed via browser with auth
DROP POLICY IF EXISTS "members_write_leaders" ON members;

CREATE POLICY "members_write_leaders" ON members
  FOR INSERT TO authenticated
  WITH CHECK (alliance_id IN (
    SELECT alliance_id FROM user_profiles WHERE id = auth.uid()
  ) AND get_user_role() IN ('r5', 'r4', 'system_admin'));

CREATE POLICY "members_update_leaders" ON members
  FOR UPDATE TO authenticated
  USING (
    (alliance_id IN (
      SELECT alliance_id FROM user_profiles WHERE id = auth.uid()
    ) AND get_user_role() IN ('r5', 'r4', 'system_admin'))
    OR linked_user_id = auth.uid()
  );

-- Allow member_combat_stats update by r4/r5 or member themselves
DROP POLICY IF EXISTS "combat_stats_write" ON member_combat_stats;

CREATE POLICY "combat_stats_write" ON member_combat_stats
  FOR ALL TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE alliance_id IN (
        SELECT alliance_id FROM user_profiles WHERE id = auth.uid()
      )
    ) AND get_user_role() IN ('r5', 'r4', 'system_admin')
  );

CREATE POLICY "combat_stats_insert" ON member_combat_stats
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE alliance_id IN (
        SELECT alliance_id FROM user_profiles WHERE id = auth.uid()
      )
    ) AND get_user_role() IN ('r5', 'r4', 'system_admin')
  );
