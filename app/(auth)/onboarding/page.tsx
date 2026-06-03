// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Clock, Shield } from 'lucide-react'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

export default async function OnboardingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('alliance_id, role')
    .eq('id', user.id)
    .single()

  // Already onboarded → go to the app
  if (profile?.alliance_id) redirect('/dashboard')

  // FIX 1 — If this logged-in user already owns a claimed profile (e.g. they
  // just left an alliance), skip the "find your profile" / "create profile"
  // steps entirely. They re-join by simply picking a new alliance; their existing
  // record (stats/heroes/troop data) is reused.
  //
  // We MUST use the service client here: once the user has left, their member row
  // has alliance_id = null and the members RLS policy (alliance-scoped reads)
  // would hide it from the authed client, so the re-join flow would never trigger.
  const svc = createServiceClient()
  const { data: claimedMember } = await svc
    .from('members')
    .select('id, player_name, previous_alliance_id')
    .eq('linked_user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let previousAllianceName: string | null = null
  if (claimedMember?.previous_alliance_id) {
    const { data: prevAlliance } = await svc
      .from('alliances')
      .select('name, tag')
      .eq('id', claimedMember.previous_alliance_id)
      .maybeSingle()
    if (prevAlliance) previousAllianceName = `[${prevAlliance.tag}] ${prevAlliance.name}`
  }

  // Pending requests block re-submission
  const [{ data: pendingProfile }, { data: pendingKingdom }] = await Promise.all([
    supabase.from('profile_requests').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1),
    supabase.from('kingdom_creation_requests').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1),
  ])

  const pending = pendingProfile?.[0] || pendingKingdom?.[0]
  if (pending) {
    const isAdminReview = !!pendingKingdom?.[0] || ['r4', 'r5'].includes(pendingProfile?.[0]?.requested_role)
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-5">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
          <Clock className="text-amber-500" size={30} />
        </div>
        <h1 className="text-2xl font-bold">Request pending approval</h1>
        <p className="text-slate-400">
          {isAdminReview
            ? 'Your request requires System Admin verification. You will be notified once it is approved.'
            : 'Your profile request has been sent to your alliance leaders. You will have access once an R4 or R5 approves it.'}
        </p>
        <p className="text-xs text-slate-500">Submitted {new Date(pending.created_at).toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} UTC</p>
      </div>
    )
  }

  const isRejoin = !!claimedMember

  // If the user's most recent request was rejected (and nothing pending now),
  // show a notice so they understand why they're back here and can try again.
  const { data: lastReq } = await supabase
    .from('profile_requests')
    .select('status, alliances(name, tag)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let rejectedAllianceName: string | null = null
  if (lastReq?.status === 'rejected') {
    rejectedAllianceName = lastReq.alliances
      ? `[${lastReq.alliances.tag}] ${lastReq.alliances.name}`
      : 'that alliance'
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      {rejectedAllianceName && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6 text-sm text-red-200">
          Your request to join {rejectedAllianceName} was rejected. You can search for another alliance to join.
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-amber-500" size={28} />
        <div>
          {isRejoin ? (
            <>
              <h1 className="text-2xl font-bold">
                {previousAllianceName ? `You have left ${previousAllianceName}` : 'You are not in an alliance'}
              </h1>
              <p className="text-slate-400 text-sm">Search for a new alliance to join — your profile and stats are kept.</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Welcome to Kingshot Hub</h1>
              <p className="text-slate-400 text-sm">Let's get you set up. Start by finding your kingdom.</p>
            </>
          )}
        </div>
      </div>
      <OnboardingFlow
        rejoin={isRejoin ? { playerName: claimedMember!.player_name, previousAllianceName } : null}
      />
    </div>
  )
}
