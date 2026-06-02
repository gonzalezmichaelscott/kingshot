// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
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

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-amber-500" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Welcome to Kingshot Hub</h1>
          <p className="text-slate-400 text-sm">Let's get you set up. Start by finding your kingdom.</p>
        </div>
      </div>
      <OnboardingFlow />
    </div>
  )
}
