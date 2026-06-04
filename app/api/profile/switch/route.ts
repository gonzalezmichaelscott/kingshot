// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ensureUserProfileLinks } from '@/lib/profiles'
import { z } from 'zod'

// FEATURE 1 — switch the active member profile. ALL permission checks use
// user_profiles.role, so this must update role + alliance_id atomically and the
// client must HARD-redirect afterwards so no stale server permissions persist.
const schema = z.object({ memberId: z.string().uuid() })

export async function POST(request: NextRequest) {
  let memberId: string
  try {
    ({ memberId } = schema.parse(await request.json()))
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const authed = createClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // Keep the ownership mirror in sync, then load the target member.
  await ensureUserProfileLinks(svc, user.id)

  const { data: member } = await svc
    .from('members')
    .select('id, alliance_id, role, linked_user_id, is_active, transferred_to')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Ownership: linked_user_id is the authoritative link (stronger than the
  // user_member_profiles mirror). Reject anything not owned by THIS user — this
  // also blocks switching to a profile an admin has restored (link removed).
  if (member.linked_user_id !== user.id) {
    return NextResponse.json({ error: 'You do not own this profile.' }, { status: 403 })
  }
  if (!member.is_active || member.transferred_to) {
    return NextResponse.json({ error: 'This profile is no longer active.' }, { status: 409 })
  }

  // Confirm the canonical link row exists (defense in depth).
  const { data: link } = await svc
    .from('user_member_profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('member_id', memberId)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Profile is not linked to your account.' }, { status: 403 })

  // Persist the OUTGOING active profile's current role back onto its member row
  // so a later switch-back doesn't lose a role that lived only in user_profiles
  // (e.g. legacy members whose members.role still defaults to r3).
  const { data: current } = await svc
    .from('user_profiles')
    .select('active_member_id, alliance_id, role')
    .eq('id', user.id)
    .maybeSingle()
  // SECURITY — `system_admin` is a platform-level role that must be preserved
  // permanently. For an admin we NEVER touch user_profiles.role (and never persist
  // 'system_admin' into a member's in-game rank, which the members CHECK rejects).
  const isAdmin = current?.role === 'system_admin'

  let outgoingId = current?.active_member_id || null
  if (!outgoingId && current?.alliance_id) {
    // Legacy: no explicit active_member_id — the active profile is the member in
    // the user's current alliance.
    const { data: cm } = await svc
      .from('members')
      .select('id')
      .eq('linked_user_id', user.id)
      .eq('alliance_id', current.alliance_id)
      .eq('is_active', true)
      .maybeSingle()
    outgoingId = cm?.id || null
  }
  if (!isAdmin && outgoingId && outgoingId !== memberId && current?.role) {
    await svc.from('members')
      .update({ role: current.role })
      .eq('id', outgoingId)
      .eq('linked_user_id', user.id)
  }

  // Atomic single update: active profile + alliance (+ role for non-admins).
  const updatePayload: Record<string, any> = {
    active_member_id: member.id,
    alliance_id: member.alliance_id,
  }
  if (!isAdmin) {
    // Only non-admins adopt the target profile's in-game rank as their role.
    updatePayload.role = member.role || 'r3'
  }
  const { error } = await svc
    .from('user_profiles')
    .update(updatePayload)
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark the active flag on the mirror (best-effort, for display).
  await svc.from('user_member_profiles').update({ is_active_profile: false }).eq('user_id', user.id)
  await svc.from('user_member_profiles').update({ is_active_profile: true }).eq('user_id', user.id).eq('member_id', member.id)

  return NextResponse.json({ ok: true })
}
