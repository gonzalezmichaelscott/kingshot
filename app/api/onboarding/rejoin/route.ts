// @ts-nocheck
/**
 * FIX — Re-join an alliance after leaving, THROUGH THE APPROVAL PROCESS.
 *
 * A logged-in user who already owns a claimed member record (linked_user_id =
 * auth.uid()) but is not currently in an alliance requests to join a new one.
 * This is NOT an instant join: we create a pending `profile_requests` entry — the
 * same flow as a brand-new member joining — so an R4/R5 (or R5/System Admin for
 * leadership ranks) must approve it. On approval the existing member record is
 * relinked to the new alliance (stats/heroes intact); no new record is created.
 *
 * Body: { alliance_id: uuid }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { eligibleApproverUserIds } from '@/lib/leadership'
import { z } from 'zod'

const schema = z.object({
  alliance_id: z.string().uuid(),
  // FIX 1 — the SPECIFIC profile being moved. The client should send the active
  // profile's member id (or the self-service token's member id). Optional for
  // backward compatibility; we fall back to the user's active profile.
  source_member_id: z.string().uuid().optional().nullable(),
})

const VALID_ROLES = ['r1', 'r2', 'r3', 'r4', 'r5']

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    // Verify the target alliance exists.
    const { data: targetAlliance } = await svc
      .from('alliances')
      .select('id, name, tag')
      .eq('id', body.alliance_id)
      .maybeSingle()
    if (!targetAlliance) {
      return NextResponse.json({ error: 'Alliance not found.' }, { status: 404 })
    }

    // FIX 1 — Identify the SPECIFIC member record being moved (profile-aware).
    // Resolution order:
    //   1) the explicit source_member_id sent by the client, else
    //   2) the user's active profile (user_profiles.active_member_id), else
    //   3) (legacy) the most recently updated owned record.
    // In every case we re-load the record and verify the requesting user owns it
    // (members.linked_user_id = auth.uid()) so we never operate on someone else's
    // — or the wrong own — profile.
    const { data: userProfile } = await svc
      .from('user_profiles')
      .select('active_member_id')
      .eq('id', user.id)
      .maybeSingle()

    const targetMemberId = body.source_member_id || userProfile?.active_member_id || null

    let existing: any = null
    if (targetMemberId) {
      const { data } = await svc
        .from('members')
        .select('id, alliance_id, player_name, game_id, linked_user_id')
        .eq('id', targetMemberId)
        .maybeSingle()
      if (!data || data.linked_user_id !== user.id) {
        return NextResponse.json({ error: 'That profile is not yours to move.' }, { status: 403 })
      }
      existing = data
    } else {
      // Legacy fallback: the most recently updated record this user owns.
      const { data: members } = await svc
        .from('members')
        .select('id, alliance_id, player_name, game_id, linked_user_id')
        .eq('linked_user_id', user.id)
        .order('updated_at', { ascending: false })
      existing = (members || [])[0]
    }

    if (!existing) {
      return NextResponse.json({ error: 'No claimed profile found to move.' }, { status: 400 })
    }
    if (existing.alliance_id === body.alliance_id) {
      return NextResponse.json({ error: 'You are already in that alliance.' }, { status: 400 })
    }

    // Default the requested role to the member's previous role (if valid), else r3.
    const { data: profile } = await svc
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const requestedRole = VALID_ROLES.includes(profile?.role) ? profile.role : 'r3'

    // governor_name is required on the request and becomes the display name on
    // approval — preserve the existing member's name.
    const governorName = (existing.player_name || '').trim() || 'Returning Player'

    // Replace any prior pending request from this user for this alliance.
    await svc.from('profile_requests')
      .delete()
      .eq('user_id', user.id)
      .eq('alliance_id', body.alliance_id)
      .eq('status', 'pending')

    const { data: created, error } = await svc.from('profile_requests').insert({
      user_id: user.id,
      alliance_id: body.alliance_id,
      governor_name: governorName,
      player_id: existing.game_id || null,
      requested_role: requestedRole,
      status: 'pending',
      // FIX 1 — bind the request to the EXACT record so approval relinks only it.
      source_member_id: existing.id,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Immediately remove the player from their CURRENT alliance while the request
    // is pending — they must not linger in the old alliance's member list. Their
    // member record (with all stats/heroes) is preserved but deactivated and
    // detached; it is relinked to the new alliance only if/when the request is
    // approved. On rejection they simply remain with no alliance.
    const currentAllianceId = existing.alliance_id
    await svc.from('members').update({
      is_active: false,
      alliance_id: null,
      previous_alliance_id: currentAllianceId,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
    // Only detach the user_profiles pointer when the profile being moved is the
    // user's ACTIVE one — never clear the session because an alt was moved.
    if (userProfile?.active_member_id === existing.id || !userProfile?.active_member_id) {
      await svc.from('user_profiles').update({ alliance_id: null, active_member_id: null }).eq('id', user.id)
    }

    // Notify every eligible approver (same as a new join request).
    try {
      const approverIds = await eligibleApproverUserIds(svc, body.alliance_id, requestedRole)
      if (approverIds.length > 0) {
        const allianceName = `[${targetAlliance.tag}] ${targetAlliance.name}`
        const rankLabel = (requestedRole === 'r4' || requestedRole === 'r5')
          ? requestedRole.toUpperCase()
          : 'Member'
        const rows = approverIds.map((uid) => ({
          user_id: uid,
          type: 'approval_request',
          title: `${governorName} is requesting to rejoin ${allianceName} as ${rankLabel}`,
          message: existing.game_id ? `Player ID: ${existing.game_id} · existing profile with stats` : 'Existing profile with stats',
          link: '/approvals',
          related_id: created.id,
        }))
        await svc.from('notifications').insert(rows)
      }
    } catch {
      // Notification failure must not block the request itself.
    }

    return NextResponse.json({ ok: true, alliance_name: `[${targetAlliance.tag}] ${targetAlliance.name}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
