// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, Copy } from 'lucide-react'
import Link from 'next/link'
import { formatPower } from '@/lib/utils'
import { AddMemberButton } from '@/components/members/AddMemberButton'
import { CopyTokenButton } from '@/components/members/CopyTokenButton'

export default async function MembersPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: alliance } = await supabase.from('alliances').select('name, tag').eq('id', params.id).single()
  if (!alliance) notFound()

  const { data: profile } = await supabase.from('user_profiles').select('role').single()
  const canManage = ['r5', 'r4', 'system_admin'].includes(profile?.role || '')

  const { data: members } = await supabase
    .from('members')
    .select('*, member_scores(overall_score, rally_leader_score, joiner_score), member_combat_stats(troop_type_primary)')
    .eq('alliance_id', params.id)
    .order('power', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-amber-500" size={24} />
          Members — [{alliance.tag}] {alliance.name}
        </h1>
        {canManage && <AddMemberButton allianceId={params.id} />}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="table-scroll">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-2 pr-4">Player</th>
                  <th className="text-right py-2 pr-4">Power</th>
                  <th className="text-right py-2 pr-4">Troops</th>
                  <th className="text-right py-2 pr-4">March</th>
                  <th className="text-right py-2 pr-4">Rally Cap</th>
                  <th className="text-left py-2 pr-4">Troop Type</th>
                  <th className="text-right py-2 pr-4">Score</th>
                  {canManage && <th className="py-2">Link</th>}
                </tr>
              </thead>
              <tbody>
                {members?.map(m => {
                  const score = (m.member_scores as any)?.[0]?.overall_score ?? 0
                  const troopType = (m.member_combat_stats as any)?.[0]?.troop_type_primary
                  return (
                    <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/50">
                      <td className="py-2 pr-4">
                        <Link href={`/alliances/${params.id}/members/${m.id}`} className="text-amber-400 hover:text-amber-300 font-medium">
                          {m.player_name}
                        </Link>
                      </td>
                      <td className="text-right py-2 pr-4 text-slate-300">{formatPower(m.power)}</td>
                      <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.troop_count)}</td>
                      <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.march_size)}</td>
                      <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.rally_capacity)}</td>
                      <td className="py-2 pr-4">
                        {troopType && (
                          <Badge variant={troopType === 'infantry' ? 'red' : troopType === 'cavalry' ? 'blue' : troopType === 'archer' ? 'green' : 'default'}>
                            {troopType}
                          </Badge>
                        )}
                      </td>
                      <td className="text-right py-2 pr-4 font-mono text-slate-300">{score.toFixed(1)}</td>
                      {canManage && (
                        <td className="py-2 text-center">
                          <CopyTokenButton token={m.access_token} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(!members || members.length === 0) && (
              <p className="text-slate-400 text-sm py-6 text-center">No members yet. Add members to get started.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
