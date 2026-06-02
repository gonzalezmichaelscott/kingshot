// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { loadApprovalQueues } from '@/lib/approvals'
import { ApprovalsClient } from '@/components/approvals/ApprovalsClient'

export default async function ApprovalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase
    .from('user_profiles').select('role, alliance_id').eq('id', user.id).single()
  if (!['r4', 'r5', 'system_admin'].includes(profile?.role || '')) redirect('/dashboard')

  const queues = await loadApprovalQueues(supabase, profile)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Inbox className="text-amber-500" size={24} />
        Pending Approvals
      </h1>
      <ApprovalsClient
        role={profile?.role || ''}
        userId={user.id}
        joinRequests={queues.joinRequests}
        leadershipRequests={queues.leadershipRequests}
        kingdomRequests={queues.kingdomRequests}
        allianceRequests={queues.allianceRequests}
      />
    </div>
  )
}
