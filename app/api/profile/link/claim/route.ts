// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ensureUserProfileLinks, MAX_PROFILES_PER_ACCOUNT } from '@/lib/profiles'
import { z } from 'zod'

// FEATURE 1 — directly claim an UNCLAIMED member record as an additional profile.
// Per spec the claim itself needs no R4/R5 approval (it only links the login to a
// record a leader already created). It does NOT grant alliance access on its own:
// permissions only change when the user SWITCHES to this profile, and the role/
// alliance come from the member record a leader set up. A profile with no alliance
// still requires the normal join flow before it grants any access.
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
    .select('id, linked_user_id, is_active, transferred_to')
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

  // Mirror into user_member_profiles (and backfill any pre-existing linked rows).
  await ensureUserProfileLinks(svc, user.id)

  return NextResponse.json({ ok: true })
}
