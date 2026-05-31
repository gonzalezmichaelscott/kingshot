// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Users, Star, Shield, TrendingUp } from 'lucide-react'
import { formatPower } from '@/lib/utils'

export default async function AnalyticsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: alliance } = await supabase.from('alliances').select('name, tag').eq('id', params.id).single()
  if (!alliance) notFound()

  const memberIdQuery = await supabase.from('members').select('id').eq('alliance_id', params.id)
  const memberIds = memberIdQuery.data?.map((m: any) => m.id) || []

  const [
    { data: membersRaw },
    { data: eventsRaw },
    { data: scoresRaw },
  ] = await Promise.all([
    supabase.from('members').select('id, player_name, power, march_size, rally_capacity, member_combat_stats(id), member_heroes(id)').eq('alliance_id', params.id),
    supabase.from('events').select('id, status, created_at, event_availability(member_id, will_attend)').eq('alliance_id', params.id).gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
    supabase.from('member_scores').select('*, members(player_name)').in('member_id', memberIds).order('rally_leader_score', { ascending: false }),
  ])

  const members = membersRaw as any[]
  const events = eventsRaw as any[]
  const scores = scoresRaw as any[]

  const total = members?.length || 0
  const withStats = members?.filter((m: any) => m.member_combat_stats?.length > 0).length || 0
  const withHeroes = members?.filter((m: any) => m.member_heroes?.length > 0).length || 0
  const withPower = members?.filter((m: any) => m.power > 0).length || 0

  const readinessScore = total > 0
    ? Math.round(((withStats + withHeroes + withPower) / (total * 3)) * 100)
    : 0

  const completedEvents = events?.filter(e => e.status === 'completed') || []
  const participationRate = completedEvents.length > 0 && total > 0
    ? Math.round(
        completedEvents.reduce((sum, ev) => {
          const attending = (ev.event_availability as any[])?.filter(a => a.will_attend).length || 0
          return sum + attending / total
        }, 0) / completedEvents.length * 100
      )
    : 0

  const topRallyLeaders = scores?.slice(0, 10) || []
  const topJoiners = [...(scores || [])].sort((a, b) => b.joiner_score - a.joiner_score).slice(0, 10)

  const powerBuckets = [0, 50, 100, 200, 300, 500, 1000].map((min, i, arr) => {
    const max = arr[i + 1] || Infinity
    const count = members?.filter(m => {
      const p = m.power / 1_000_000
      return p >= min && p < max
    }).length || 0
    return { label: max === Infinity ? `${min}M+` : `${min}–${max}M`, count }
  }).filter(b => b.count > 0)

  // Timezone coverage (UTC hours)
  const tzCoverage = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="text-amber-500" size={24} />
        Analytics — [{alliance.tag}] {alliance.name}
      </h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Alliance Readiness', value: `${readinessScore}%`, icon: Shield, color: readinessScore > 70 ? 'text-green-400' : readinessScore > 40 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Total Members', value: total, icon: Users, color: 'text-blue-400' },
          { label: '30-Day Participation', value: `${participationRate}%`, icon: TrendingUp, color: 'text-amber-400' },
          { label: 'Combat Stats Coverage', value: `${total > 0 ? Math.round(withStats / total * 100) : 0}%`, icon: BarChart3, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <Icon className={`${color} mb-2`} size={20} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-slate-400 mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data completeness */}
      <Card>
        <CardHeader><CardTitle>Data Completeness</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: 'Power entered', count: withPower, total },
              { label: 'Heroes entered', count: withHeroes, total },
              { label: 'Combat stats (battle report)', count: withStats, total },
            ].map(({ label, count, total: t }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{label}</span>
                  <span className="text-slate-400">{count}/{t}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${t > 0 ? (count / t) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Rally Leaders */}
        <Card>
          <CardHeader><CardTitle>Top Rally Leaders</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topRallyLeaders.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-5">{i + 1}</span>
                    <span className="text-sm font-medium">{(s.members as any)?.player_name}</span>
                  </div>
                  <span className="text-sm text-amber-400 font-mono">{s.rally_leader_score.toFixed(2)}</span>
                </div>
              ))}
              {topRallyLeaders.length === 0 && <p className="text-slate-400 text-sm">No score data yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Top Joiners */}
        <Card>
          <CardHeader><CardTitle>Top Joiners</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topJoiners.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-5">{i + 1}</span>
                    <span className="text-sm font-medium">{(s.members as any)?.player_name}</span>
                  </div>
                  <span className="text-sm text-blue-400 font-mono">{s.joiner_score.toFixed(2)}</span>
                </div>
              ))}
              {topJoiners.length === 0 && <p className="text-slate-400 text-sm">No score data yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Power Distribution */}
      {powerBuckets.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Power Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {powerBuckets.map(bucket => (
                <div key={bucket.label} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-20 text-right">{bucket.label}</span>
                  <div className="flex-1 h-6 bg-slate-800 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-amber-500/70 rounded transition-all"
                      style={{ width: `${(bucket.count / total) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                      {bucket.count} members
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
