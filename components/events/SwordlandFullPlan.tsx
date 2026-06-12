'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Swords } from 'lucide-react'
import { formatPower } from '@/lib/utils'

interface Props {
  eventId: string
  allianceTag: string
  /** event_assignments rows (incl. member_instructions + members embed). */
  assignments: any[]
  /** events.battle_plan JSON — rich per-assignment fields + per-legion plans. */
  battlePlan: any
  canManage: boolean
}

/**
 * Shared battle-phase guide shown once per legion. Swordland has no DB-stored
 * stages (unlike Tri-Alliance), so this is the verified phase playbook that
 * applies to every member of the legion.
 */
const SWORDLAND_STAGE_GUIDE = [
  {
    window: 'Opening (0–10 min)',
    text: 'Capture Bell Tower (faster building captures) and Royal Stables (team-wide teleport recharge) first. Rally leaders form their first rallies immediately; joiners join as soon as the rally opens.',
  },
  {
    window: 'Mid battle (10–40 min)',
    text: 'Take and hold the Sword Shrine and both Sanctums — they are the highest point sources. Collect arsenal supply crates immediately after every capture. Attackers hit weakly defended buildings; tanks reinforce what we hold.',
  },
  {
    window: 'Late battle (40–60 min)',
    text: 'Undercellars appear — gather them for personal points. Defend the structures generating our points and keep every march slot active until the final minute. Do not sit in the safe zone.',
  },
]

export function SwordlandFullPlan({ eventId, allianceTag, assignments, battlePlan, canManage }: Props) {
  // Rich plan data (formation/hero recommendations, rally_leader links) by member.
  const planByMember: Record<string, any> = {}
  for (const a of battlePlan?.assignments || []) planByMember[a.member_id] = a

  const legions = (['legion1', 'legion2'] as const).filter(
    legion => assignments.some(a => a.squad === legion)
  )
  if (legions.length === 0) return null

  return (
    <div className="space-y-6">
      {legions.map(legion => (
        <LegionPlanSection
          key={legion}
          legion={legion}
          eventId={eventId}
          allianceTag={allianceTag}
          rows={assignments.filter(a => a.squad === legion)}
          legionPlan={battlePlan?.legion_plans?.[legion] || null}
          planByMember={planByMember}
          canManage={canManage}
        />
      ))}
    </div>
  )
}

function LegionPlanSection({ legion, eventId, allianceTag, rows, legionPlan, planByMember, canManage }: {
  legion: 'legion1' | 'legion2'
  eventId: string
  allianceTag: string
  rows: any[]
  legionPlan: any
  planByMember: Record<string, any>
  canManage: boolean
}) {
  const [open, setOpen] = useState(true)
  const label = legion === 'legion1' ? 'Legion 1' : 'Legion 2'

  const isLeader = (r: any) => (r.role || '').toLowerCase().includes('leader')
  const isJoiner = (r: any) => (r.role || '').toLowerCase().includes('joiner')

  const leaders = rows.filter(r => isLeader(r) && !r.is_backup)
  const joiners = rows.filter(r => isJoiner(r) && !r.is_backup)
  const subs = rows.filter(r => r.is_backup)
  const support = rows.filter(r => !r.is_backup && !isLeader(r) && !isJoiner(r))

  // Resolve which rally leader a joiner belongs to: the plan's explicit
  // rally_leader name first, then (single-leader legions) the only leader,
  // then a name match inside the joiner's reasoning text.
  const leaderFor = (joiner: any): any | null => {
    const plan = planByMember[joiner.member_id]
    if (plan?.rally_leader) {
      const match = leaders.find(l => l.members?.player_name === plan.rally_leader)
      if (match) return match
    }
    if (leaders.length === 1) return leaders[0]
    const text = `${plan?.reasoning || ''} ${joiner.reasoning || ''}`
    return leaders.find(l => l.members?.player_name && text.includes(l.members.player_name)) || null
  }

  const joinersByLeader = new Map<string, any[]>()
  const unassignedJoiners: any[] = []
  for (const j of joiners) {
    const leader = leaderFor(j)
    if (leader) {
      if (!joinersByLeader.has(leader.member_id)) joinersByLeader.set(leader.member_id, [])
      joinersByLeader.get(leader.member_id)!.push(j)
    } else {
      unassignedJoiners.push(j)
    }
  }

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <CardTitle className="flex items-center gap-2">
            <Swords size={18} className="text-amber-500" />
            {label} Battle Plan
          </CardTitle>
          {open ? <ChevronDown size={18} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-5">
          {canManage && <RegeneratePlanButton eventId={eventId} legion={legion} label={label} />}

          {leaders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-amber-400 mb-2">⚔️ Rally Leaders ({leaders.length})</h3>
              <div className="space-y-3">
                {leaders.map(l => (
                  <div key={l.id}>
                    <MemberCard row={l} planRow={planByMember[l.member_id]} allianceTag={allianceTag} kind="leader" />
                    {(joinersByLeader.get(l.member_id) || []).length > 0 && (
                      <div className="ml-4 mt-1.5 pl-3 border-l border-slate-700 space-y-1.5">
                        <p className="text-xs font-medium text-slate-400">
                          👥 Joiners ({(joinersByLeader.get(l.member_id) || []).length})
                        </p>
                        {(joinersByLeader.get(l.member_id) || []).map(j => (
                          <MemberCard key={j.id} row={j} planRow={planByMember[j.member_id]} allianceTag={allianceTag} kind="joiner" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {unassignedJoiners.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-amber-400 mb-2">👥 Joiners — Rally Not Specified ({unassignedJoiners.length})</h3>
              <div className="space-y-1.5">
                {unassignedJoiners.map(j => (
                  <MemberCard key={j.id} row={j} planRow={planByMember[j.member_id]} allianceTag={allianceTag} kind="joiner" />
                ))}
              </div>
            </div>
          )}

          {support.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-amber-400 mb-2">🛡️ Support ({support.length})</h3>
              <div className="space-y-1.5">
                {support.map(s => (
                  <MemberCard key={s.id} row={s} planRow={planByMember[s.member_id]} allianceTag={allianceTag} kind="support" />
                ))}
              </div>
            </div>
          )}

          {subs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">🔁 Substitutes ({subs.length})</h3>
              <div className="space-y-1.5">
                {subs.map(s => (
                  <MemberCard key={s.id} row={s} planRow={planByMember[s.member_id]} allianceTag={allianceTag} kind="support" />
                ))}
              </div>
            </div>
          )}

          <SharedInstructions label={label} legionPlan={legionPlan} />
        </CardContent>
      )}
    </Card>
  )
}

function RegeneratePlanButton({ eventId, legion, label }: { eventId: string; legion: 'legion1' | 'legion2'; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function regenerate() {
    if (!window.confirm(`Clear the current ${label} plan and generate a fresh one? The other legion's plan is not affected.`)) return
    setBusy(true)
    setError('')
    let res: Response
    try {
      res = await fetch('/api/battle-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, legion }),
      })
    } catch {
      setBusy(false)
      setError('Network error — plan was not regenerated. Please try again.')
      return
    }
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Plan regeneration failed')
      return
    }
    router.refresh()
  }

  return (
    <div>
      <Button onClick={regenerate} disabled={busy} variant="secondary" size="sm">
        {busy ? (
          <><Loader2 size={14} className="mr-1.5 animate-spin" /> Regenerating {label} plan…</>
        ) : (
          <><RefreshCw size={14} className="mr-1.5" /> Regenerate Plan</>
        )}
      </Button>
      {error && <p className="text-red-400 text-sm mt-1.5">{error}</p>}
    </div>
  )
}

function MemberCard({ row, planRow, allianceTag, kind }: {
  row: any
  planRow: any
  allianceTag: string
  kind: 'leader' | 'joiner' | 'support'
}) {
  const [showFull, setShowFull] = useState(false)
  const m = row.members
  const roleLabel = (row.role || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  return (
    <div className="bg-slate-800 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatar
            gameId={m?.game_id}
            avatarUrl={m?.avatar_url}
            memberId={m?.id}
            playerName={m?.player_name || '?'}
            sizeClass="w-8 h-8"
          />
          <span className="font-medium text-sm truncate">[{allianceTag}] {m?.player_name || 'Unknown'}</span>
          {kind === 'joiner' ? (
            <span className="text-xs text-slate-500">March: {(m?.march_size || 0).toLocaleString()}</span>
          ) : (
            <span className="text-xs text-slate-500">{formatPower(m?.power || 0)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-amber-400/90 font-medium">{roleLabel}</span>
          <button
            type="button"
            onClick={() => setShowFull(s => !s)}
            className="text-[11px] text-amber-400/90 hover:text-amber-400 font-medium"
          >
            {showFull ? 'Hide Full Instructions' : 'View Full Instructions'}
          </button>
        </div>
      </div>

      <div className="mt-1 text-xs text-slate-400 space-y-0.5">
        {kind !== 'joiner' && planRow?.formation_recommendation && (
          <p>Formation: {planRow.formation_recommendation}</p>
        )}
        {planRow?.hero_recommendation && (
          <p className="truncate">Heroes: <span className="text-slate-300">{planRow.hero_recommendation}</span></p>
        )}
      </div>

      {showFull && (
        <div className="mt-2 bg-slate-900/60 border border-slate-700 rounded-lg p-3">
          {row.member_instructions ? (
            <div className="text-sm text-slate-300 whitespace-pre-line">{row.member_instructions}</div>
          ) : (
            <p className="text-sm text-slate-400">{row.reasoning || 'No personal instructions stored for this member yet — regenerate the plan.'}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Shared stage instructions shown once per legion — applies to every member. */
function SharedInstructions({ label, legionPlan }: { label: string; legionPlan: any }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
          Stage by Stage Instructions — all {label} members
        </p>
        <div className="text-sm text-slate-300 bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-2">
          {SWORDLAND_STAGE_GUIDE.map((s, i) => (
            <p key={i}><span className="text-amber-400/90 font-medium">[{s.window}]</span> {s.text}</p>
          ))}
        </div>
      </div>
      {legionPlan?.summary && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{label} Plan Summary</p>
          <p className="text-sm text-slate-300 bg-slate-800/60 border border-slate-700 rounded-lg p-3">{legionPlan.summary}</p>
        </div>
      )}
      {legionPlan?.joiner_stacking_advice && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Joiner Stacking Advice</p>
          <p className="text-sm text-slate-300 bg-slate-800/60 border border-slate-700 rounded-lg p-3">{legionPlan.joiner_stacking_advice}</p>
        </div>
      )}
      {legionPlan?.backup_plan && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Backup Plan</p>
          <p className="text-sm text-slate-300 bg-slate-800/60 border border-slate-700 rounded-lg p-3">{legionPlan.backup_plan}</p>
        </div>
      )}
    </div>
  )
}
