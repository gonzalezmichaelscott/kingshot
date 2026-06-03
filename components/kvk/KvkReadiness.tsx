// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, AlertCircle, Crown, Users } from 'lucide-react'

function isComplete(troopData: any) {
  if (!troopData || typeof troopData !== 'object') return false
  // A type counts as filled only if it has at least one tier count > 0.
  // tg_level is a multiplier setting, not a troop count — ignore it here.
  return Object.values(troopData).some(
    (t: any) =>
      t &&
      typeof t === 'object' &&
      Object.entries(t).some(([key, v]: [string, any]) => key !== 'tg_level' && (v || 0) > 0)
  )
}

/**
 * Readiness breakdown across every member in the combined KVK pool.
 * Server component — receives the raw member rows (with combat stats, heroes,
 * troop_data, scores) and computes everything inline.
 */
export function KvkReadiness({ members }: { members: any[] }) {
  const total = members.length

  const statsDone = members.filter(m => (m.member_combat_stats as any[])?.length > 0)
  const heroesDone = members.filter(m => (m.member_heroes as any[])?.length > 0)
  const troopsDone = members.filter(m => isComplete(m.troop_data))

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const fullyReady = members.filter(
    m => (m.member_combat_stats as any[])?.length > 0 &&
      (m.member_heroes as any[])?.length > 0 &&
      isComplete(m.troop_data)
  )
  const overall = pct(fullyReady.length)

  const incomplete = members
    .map(m => {
      const missing: string[] = []
      if (!((m.member_combat_stats as any[])?.length > 0)) missing.push('Combat stats')
      if (!((m.member_heroes as any[])?.length > 0)) missing.push('Heroes')
      if (!isComplete(m.troop_data)) missing.push('Troop data')
      return { id: m.id, name: m.player_name, tag: (m.alliances as any)?.tag, missing }
    })
    .filter(m => m.missing.length > 0)

  const score = (m: any, field: string) => (m.member_scores as any)?.[0]?.[field] ?? 0
  const topRallyLeaders = [...members]
    .sort((a, b) => score(b, 'rally_leader_score') - score(a, 'rally_leader_score'))
    .slice(0, 5)
  const topJoiners = [...members]
    .sort((a, b) => score(b, 'joiner_score') - score(a, 'joiner_score'))
    .slice(0, 10)

  const categories = [
    { label: 'Combat Stats', done: statsDone.length },
    { label: 'Heroes', done: heroesDone.length },
    { label: 'Troop Data', done: troopsDone.length },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity size={18} className="text-amber-500" />
          Kingdom Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-300">Overall readiness</span>
            <span className="text-sm font-semibold text-amber-400">{overall}%</span>
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={
                'h-full rounded-full transition-all ' +
                (overall > 70 ? 'bg-green-500' : overall > 40 ? 'bg-amber-500' : 'bg-red-500')
              }
              style={{ width: `${overall}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">{fullyReady.length} of {total} members have all data complete</p>
        </div>

        {/* Category breakdown */}
        <div className="grid sm:grid-cols-3 gap-3">
          {categories.map(c => (
            <div key={c.label} className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">{c.label}</p>
              <p className="text-lg font-semibold text-slate-100">{pct(c.done)}%</p>
              <p className="text-xs text-slate-500">{c.done}/{total} complete</p>
            </div>
          ))}
        </div>

        {/* Incomplete members */}
        <div>
          <p className="text-sm font-medium text-slate-300 flex items-center gap-1 mb-2">
            <AlertCircle size={14} className="text-amber-400" />
            Members with incomplete data ({incomplete.length})
          </p>
          {incomplete.length > 0 ? (
            <div className="table-scroll max-h-56 overflow-y-auto">
              <div className="space-y-1">
                {incomplete.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-sm bg-slate-800/50 rounded px-2 py-1.5">
                    <span className="text-slate-300">
                      {m.tag ? <span className="text-amber-400 text-xs">[{m.tag}] </span> : ''}{m.name}
                    </span>
                    <span className="flex gap-1 flex-wrap justify-end">
                      {m.missing.map(x => (
                        <Badge key={x} variant="red" className="text-[10px]">{x}</Badge>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-green-400">All members have complete data. 🎉</p>
          )}
        </div>

        {/* Top rally leaders & joiners */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-300 flex items-center gap-1 mb-2">
              <Crown size={14} className="text-amber-400" /> Top 5 Rally Leaders
            </p>
            <div className="space-y-1">
              {topRallyLeaders.map((m, i) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    <span className="text-slate-500 mr-1">{i + 1}.</span>
                    {(m.alliances as any)?.tag ? <span className="text-amber-400 text-xs">[{(m.alliances as any).tag}] </span> : ''}{m.player_name}
                  </span>
                  <span className="font-mono text-slate-400 text-xs">{score(m, 'rally_leader_score').toFixed(1)}</span>
                </div>
              ))}
              {topRallyLeaders.length === 0 && <p className="text-sm text-slate-500">No data.</p>}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300 flex items-center gap-1 mb-2">
              <Users size={14} className="text-blue-400" /> Top 10 Joiners
            </p>
            <div className="space-y-1">
              {topJoiners.map((m, i) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    <span className="text-slate-500 mr-1">{i + 1}.</span>
                    {(m.alliances as any)?.tag ? <span className="text-amber-400 text-xs">[{(m.alliances as any).tag}] </span> : ''}{m.player_name}
                  </span>
                  <span className="font-mono text-slate-400 text-xs">{score(m, 'joiner_score').toFixed(1)}</span>
                </div>
              ))}
              {topJoiners.length === 0 && <p className="text-sm text-slate-500">No data.</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
