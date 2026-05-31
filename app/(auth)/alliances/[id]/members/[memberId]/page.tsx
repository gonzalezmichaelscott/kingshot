// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPower, troopTypeColor, roleColor } from '@/lib/utils'
import { User, Sword, Star } from 'lucide-react'

export default async function MemberProfilePage({ params }: { params: { id: string; memberId: string } }) {
  const supabase = createClient()

  const { data: member } = await supabase
    .from('members')
    .select(`
      *,
      member_combat_stats(*),
      member_heroes(*, heroes(*)),
      member_scores(*)
    `)
    .eq('id', params.memberId)
    .eq('alliance_id', params.id)
    .single()

  if (!member) notFound()

  const stats = (member.member_combat_stats as any)?.[0]
  const heroes = (member.member_heroes as any[]) || []
  const scores = (member.member_scores as any)?.[0]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="text-amber-500" size={24} />
            {member.player_name}
          </h1>
          {member.game_id && <p className="text-slate-400 text-sm">Game ID: {member.game_id}</p>}
        </div>
        <Badge variant="amber">{member.timezone}</Badge>
      </div>

      {/* Combat Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Power', value: formatPower(member.power) },
          { label: 'Troops', value: formatPower(member.troop_count) },
          { label: 'March Size', value: formatPower(member.march_size) },
          { label: 'Rally Cap', value: formatPower(member.rally_capacity) },
          { label: 'Troop Type', value: stats?.troop_type_primary || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Role Scores */}
      {scores && (
        <Card>
          <CardHeader><CardTitle>Combat Scores</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Rally Leader', value: scores.rally_leader_score },
                { label: 'Joiner', value: scores.joiner_score },
                { label: 'Castle', value: scores.castle_score },
                { label: 'Turret', value: scores.turret_score },
                { label: 'Support', value: scores.support_score },
                { label: 'Defender', value: scores.defender_score },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-400 text-xs">{label}</p>
                  <p className="text-lg font-bold">{(value || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Battle Report Stats */}
      {stats && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sword size={18} className="text-amber-500" />Battle Report Stats</CardTitle></CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-2 pr-4">Type</th>
                    <th className="text-right py-2 pr-2">ATK</th>
                    <th className="text-right py-2 pr-2">DEF</th>
                    <th className="text-right py-2 pr-2">HP</th>
                    <th className="text-right py-2">LETH</th>
                  </tr>
                </thead>
                <tbody>
                  {(['infantry', 'cavalry', 'archer'] as const).map(t => (
                    <tr key={t} className="border-b border-slate-800/50">
                      <td className="py-2 pr-4 capitalize font-medium">{t}</td>
                      <td className="text-right py-2 pr-2 text-slate-300">{stats[`${t}_attack`] || 0}%</td>
                      <td className="text-right py-2 pr-2 text-slate-300">{stats[`${t}_defense`] || 0}%</td>
                      <td className="text-right py-2 pr-2 text-slate-300">{stats[`${t}_health`] || 0}%</td>
                      <td className="text-right py-2 text-amber-400">{stats[`${t}_lethality`] || 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-500 mt-2">Source: {stats.source}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heroes */}
      {heroes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Star size={18} className="text-amber-500" />Heroes</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {heroes.map((mh: any) => (
                <div key={mh.id} className="bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{mh.heroes?.name}</span>
                    {mh.is_primary && <Badge variant="amber">Primary</Badge>}
                  </div>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span>Gen {mh.heroes?.generation}</span>
                    <span className={troopTypeColor(mh.heroes?.troop_type)}>{mh.heroes?.troop_type}</span>
                    <span className={roleColor(mh.heroes?.role)}>{mh.heroes?.role?.replace('_', ' ')}</span>
                    <span>⭐ {mh.star_level}</span>
                    <span>Lvl {mh.hero_level}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {member.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><p className="text-slate-300 text-sm whitespace-pre-wrap">{member.notes}</p></CardContent>
        </Card>
      )}
    </div>
  )
}
