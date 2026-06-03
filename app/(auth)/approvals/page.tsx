// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { loadApprovalQueues, annotateExistingProfiles } from '@/lib/approvals'
import { ApprovalsClient } from '@/components/approvals/ApprovalsClient'

export default async function ApprovalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase
    .from('user_profiles').select('role, alliance_id').eq('id', user.id).single()
  if (!['r4', 'r5', 'system_admin'].includes(profile?.role || '')) redirect('/dashboard')

  const queues = await loadApprovalQueues(supabase, profile)

  // Flag rejoin requests (player already has a profile with stats) for approvers.
  const svc = createServiceClient()
  const [joinRequests, leadershipRequests] = await Promise.all([
    annotateExistingProfiles(svc, queues.joinRequests),
    annotateExistingProfiles(svc, queues.leadershipRequests),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Inbox className="text-amber-500" size={24} />
        Pending Approvals
      </h1>
      <ApprovalsClient
        role={profile?.role || ''}
        userId={user.id}
        joinRequests={joinRequests}
        leadershipRequests={leadershipRequests}
        kingdomRequests={queues.kingdomRequests}
        allianceRequests={queues.allianceRequests}
      />
    </div>
  )
}
