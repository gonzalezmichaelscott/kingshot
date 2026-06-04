// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ensureUserProfileLinks, MAX_PROFILES_PER_ACCOUNT } from '@/lib/profiles'
import { eligibleApproverUserIds } from '@/lib/leadership'
import { z } from 'zod'

// FEATURE 1 — directly claim an UNCLAIMED member record as an additional profile.
// The claim links the login to a record a leader already created. R1–R3 profiles
// are usable immediately. SECURITY: an unclaimed R4/R5 profile must NOT hand out
// leadership access on claim — the profile is linked at r3 and the elevated rank
// goes through the normal R5/admin approval flow (a pending profile_request).
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

  const { data: member } = await svc
    .from('members')
    .select('id, linked_user_id, is_active, transferred_to, role, alliance_id, player_name, game_id')
    .eq('id', memberId)
    .maybeSingle()

  if (!member || !member.is_active || member.transferred_to) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (member.linked_user_id === user.id) {
    // Already linked to this account — make sure the mirror row exists, then ok.
    await ensureUserProfileLinks(svc, user.id)
    return NextResponse.json({ ok: true, already_yours: true })
  }
  if (member.linked_user_id) {
    return NextResponse.json(
      { error: 'This profile is already linked to a different account. If you believe this is an error, please use the Report Impersonation form.' },
      { status: 409 }
    )
  }

  // Enforce the 5-profile cap (count the records this user already owns).
  const { count } = await svc
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('linked_user_id', user.id)
    .eq('is_active', true)
  if ((count || 0) >= MAX_PROFILES_PER_ACCOUNT) {
    return NextResponse.json({ error: `You can link at most ${MAX_PROFILES_PER_ACCOUNT} profiles.` }, { status: 403 })
  }

  // Link the login to the record. Re-check the unclaimed state in the WHERE to
  // avoid a race where two users claim the same profile simultaneously.
  const { data: updated, error } = await svc
    .from('members')
    .update({ linked_user_id: user.id, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .is('linked_user_id', null)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) {
    return NextResponse.json(
      { error: 'This profile was just claimed by another account. If you believe this is an error, please use the Report Impersonation form.' },
      { status: 409 }
    )
  }

  // SECURITY — an unclaimed leadership (R4/R5) profile must not grant that rank on
  // claim. Downgrade the linked profile to r3 and route the elevated rank through
  // the normal approval flow (an R5 / System Admin approves the pending request).
  const claimedRole = member.role
  const isElevated = (claimedRole === 'r4' || claimedRole === 'r5') && !!member.alliance_id
  if (isElevated) {
    await svc.from('members').update({ role: 'r3', updated_at: new Date().toISOString() }).eq('id', memberId)

    const governorName = (member.player_name || '').trim() || `Player ${member.game_id || ''}`.trim() || 'Returning Player'

    // Replace any prior pending request from this user for this alliance.
    await svc.from('profile_requests')
      .delete()
      .eq('user_id', user.id)
      .eq('alliance_id', member.alliance_id)
      .eq('status', 'pending')

    const { data: created } = await svc.from('profile_requests').insert({
      user_id: user.id,
      alliance_id: member.alliance_id,
      governor_name: governorName,
      player_id: member.game_id || null,
      requested_role: claimedRole,
      status: 'pending',
      is_alt: false,
    }).select('id').single()

    // Notify the eligible approvers (best-effort — must not block the claim).
    try {
      const approverIds = await eligibleApproverUserIds(svc, member.alliance_id, claimedRole)
      if (created?.id && approverIds.length > 0) {
        const { data: alliance } = await svc.from('alliances').select('name, tag').eq('id', member.alliance_id).maybeSingle()
        const allianceName = alliance ? `[${alliance.tag}] ${alliance.name}` : 'an alliance'
        await svc.from('notifications').insert(approverIds.map((uid) => ({
          user_id: uid,
          type: 'approval_request',
          title: `${governorName} claimed a profile and is requesting ${claimedRole.toUpperCase()} in ${allianceName}`,
          message: member.game_id ? `Player ID: ${member.game_id}` : null,
          link: '/approvals',
          related_id: created.id,
        })))
      }
    } catch { /* notification failure is non-fatal */ }

    // Mirror into user_member_profiles (and backfill any pre-existing linked rows).
    await ensureUserProfileLinks(svc, user.id)

    return NextResponse.json({
      ok: true,
      pending_role: true,
      message: 'Profile claimed successfully. Your R4/R5 rank request has been submitted for approval.',
    })
  }

  // Mirror into user_member_profiles (and backfill any pre-existing linked rows).
  await ensureUserProfileLinks(svc, user.id)

  return NextResponse.json({ ok: true })
}
