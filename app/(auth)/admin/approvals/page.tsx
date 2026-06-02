// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { ApprovalsPortal } from '@/components/admin/ApprovalsPortal'
import { alliancesWithR5 } from '@/lib/leadership'

export default async function AdminApprovalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/dashboard')

  const [{ data: kingdomReqs }, { data: rankReqsRaw }] = await Promise.all([
    supabase.from('kingdom_creation_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('profile_requests').select('*, alliances(name, tag)').eq('status', 'pending').in('requested_role', ['r4', 'r5']).order('created_at', { ascending: false }),
  ])

  const kingdomRequests = (kingdomReqs || []).filter(r => r.request_type === 'new_kingdom')
  const allianceRequests = (kingdomReqs || []).filter(r => r.request_type === 'new_alliance')

  // System Admin only handles elevated requests that have FALLEN BACK to admin —
  // i.e. the target alliance has no R5. Once an alliance gains an R5, its pending
  // R4/R5 requests disappear from here and surface in that R5's Members queue.
  const r5Alliances = await alliancesWithR5(supabase, (rankReqsRaw || []).map(r => r.alliance_id))
  const fallbackRankReqs = (rankReqsRaw || []).filter(r => !r5Alliances.has(r.alliance_id))

  // Attach current role for each rank request's requesting user
  const userIds = fallbackRankReqs.map(r => r.user_id)
  let roleMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('user_profiles').select('id, role').in('id', userIds)
    roleMap = Object.fromEntries((profiles || []).map(p => [p.id, p.role]))
  }
  const rankRequests = fallbackRankReqs.map(r => ({ ...r, current_role: roleMap[r.user_id] || null }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Inbox className="text-amber-500" size={24} />
        Pending Approvals
      </h1>
      <ApprovalsPortal kingdomRequests={kingdomRequests} allianceRequests={allianceRequests} rankRequests={rankRequests} />
    </div>
  )
}
