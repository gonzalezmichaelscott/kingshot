'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Swords } from 'lucide-react'
import { formatPower } from '@/lib/utils'
import { findSquadTypeConflict } from '@/lib/hero-troop-types'

interface Props {
  eventId: string
  allianceTag: string
  triAssignments: any[]
  canManage: boolean
}

const ROLE_LABELS: Record<string, string> = {
  main_player: 'Main Player',
  supporter: 'Supporter',
  special_force: 'Special Commander Force',
  reaction_team: 'Reaction Team',
  commander: 'Commander',
  substitute: 'Substitute',
}

const TRI_CHECKLIST = [
  'Recall all troops before battle',
  'Heal all injured troops',
  'Set formation presets per your role',
  'Start with full energy',
  'Join Discord/voice chat',
  'Know Temple opens at minute 40',
]

/**
 * Full Tri-Alliance Clash battle plan view for the event page: per-legion
 * collapsible roster grouped by role, with shared stage instructions per role
 * group and an expandable full personal instruction card per member (same
 * content members see on their self-service page).
 */
export function TriAllianceFullPlan({ eventId, allianceTag, triAssignments, canManage }: Props) {
  const legions = [1, 2].filter(legion => triAssignments.some(a => a.legion === legion))
  if (legions.length === 0) return null

  return (
    <div className="space-y-6">
      {legions.map(legion => (
        <LegionPlanSection
          key={legion}
          legion={legion}
          eventId={eventId}
          allianceTag={allianceTag}
          rows={triAssignments.filter(a => a.legion === legion)}
          canManage={canManage}
        />
      ))}
    </div>
  )
}

function LegionPlanSection({ legion, eventId, allianceTag, rows, canManage }: {
  legion: number
  eventId: string
  allianceTag: string
  rows: any[]
  canManage: boolean
}) {
  const [open, setOpen] = useState(true)

  const byRole = (role: string) => rows
    .filter(r => r.role === role)
    .sort((a, b) => (a.power_rank ?? 999) - (b.power_rank ?? 999) || ((b.members?.power || 0) - (a.members?.power || 0)))

  const reactionA = byRole('reaction_team').filter(r => r.reaction_team_letter === 'A')
  const reactionB = byRole('reaction_team').filter(r => r.reaction_team_letter !== 'A')
  const subs = byRole('substitute')
  const combatants = rows.filter(r => r.role !== 'substitute')
  const nameOf = (memberId: string) => rows.find(r => r.member_id === memberId)?.members?.player_name || '?'

  const groups = [
    { key: 'main_player', title: `⚔️ Main Players (${byRole('main_player').length})`, list: byRole('main_player') },
    { key: 'supporter', title: `🛡️ Supporters (${byRole('supporter').length})`, list: byRole('supporter') },
    { key: 'special_force', title: `⚡ Special Commander Force (${byRole('special_force').length})`, list: byRole('special_force') },
    { key: 'reaction_a', title: `🔄 Reaction Team A (${reactionA.length})`, list: reactionA },
    { key: 'reaction_b', title: `🔄 Reaction Team B (${reactionB.length})`, list: reactionB },
    { key: 'commander', title: `📣 Commanders (${byRole('commander').length})`, list: byRole('commander') },
  ]

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
            Legion {legion} Battle Plan
          </CardTitle>
          {open ? <ChevronDown size={18} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-5">
          {canManage && <RegeneratePlanButton eventId={eventId} legion={legion} rows={rows} />}

          {groups.map(g => g.list.length > 0 && (
            <RoleGroup key={g.key} title={g.title} list={g.list} allianceTag={allianceTag} nameOf={nameOf} />
          ))}

          {subs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">🔁 Substitutes ({subs.length})</h3>
              <div className="space-y-1.5">
                {subs.map(r => (
                  <div key={r.id} className="space-y-1">
                    <PlanMemberCard row={r} allianceTag={allianceTag} nameOf={nameOf} />
                    {canManage && <CallupControl eventId={eventId} substitute={r} combatants={combatants} />}
                  </div>
                ))}
              </div>
              <SharedInstructions list={subs} nameOf={nameOf} />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function RegeneratePlanButton({ eventId, legion, rows }: { eventId: string; legion: number; rows: any[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function regenerate() {
    if (!window.confirm(`Clear the current Legion ${legion} plan and generate a fresh one? Existing role assignments and instructions will be replaced.`)) return
    setBusy(true)
    setError('')
    // Keep the currently designated commanders across the regeneration.
    const commanderIds = rows.filter(r => r.role === 'commander').map(r => r.member_id)
    let res: Response
    try {
      res = await fetch('/api/tri-alliance/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, legionNumber: legion, commanderIds }),
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
          <><Loader2 size={14} className="mr-1.5 animate-spin" /> Regenerating Legion {legion} plan…</>
        ) : (
          <><RefreshCw size={14} className="mr-1.5" /> Regenerate Plan</>
        )}
      </Button>
      {error && <p className="text-red-400 text-sm mt-1.5">{error}</p>}
    </div>
  )
}

function RoleGroup({ title, list, allianceTag, nameOf }: {
  title: string
  list: any[]
  allianceTag: string
  nameOf: (memberId: string) => string
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-amber-400 mb-2">{title}</h3>
      <div className="space-y-1.5">
        {list.map(r => (
          <PlanMemberCard key={r.id} row={r} allianceTag={allianceTag} nameOf={nameOf} />
        ))}
      </div>
      <SharedInstructions list={list} nameOf={nameOf} />
    </div>
  )
}

/**
 * Stage-by-stage instructions shown once per role group. All members in a
 * group share the same template; for supporters the first member's text is
 * genericized (their Main Player's name → "your assigned Main Player") so the
 * shared block applies to everyone in the group.
 */
function SharedInstructions({ list, nameOf }: { list: any[]; nameOf: (memberId: string) => string }) {
  const first = list.find(r => r.stage_instructions)
  if (!first) return null
  let text: string = first.stage_instructions
  if (first.role === 'supporter' && first.assigned_to) {
    const mainName = nameOf(first.assigned_to)
    if (mainName && mainName !== '?') text = text.split(mainName).join('your assigned Main Player')
  }
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Stage by Stage Instructions — all members in this role</p>
      <div className="text-sm text-slate-300 whitespace-pre-line bg-slate-800/60 border border-slate-700 rounded-lg p-3">
        {text}
      </div>
    </div>
  )
}

function PlanMemberCard({ row, allianceTag, nameOf }: {
  row: any
  allianceTag: string
  nameOf: (memberId: string) => string
}) {
  const [showFull, setShowFull] = useState(false)
  const m = row.members
  const isCommander = row.role === 'commander'
  const isSubstitute = row.role === 'substitute'

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
          {!isCommander && <span className="text-xs text-slate-500">{formatPower(m?.power || 0)}</span>}
        </div>
        <button
          type="button"
          onClick={() => setShowFull(s => !s)}
          className="text-[11px] text-amber-400/90 hover:text-amber-400 font-medium flex-shrink-0"
        >
          {showFull ? 'Hide Full Instructions' : 'View Full Instructions'}
        </button>
      </div>

      <div className="mt-1 text-xs text-slate-400 space-y-0.5">
        {isCommander && <p>Buff management — no combat role</p>}
        {isSubstitute && row.power_rank != null && <p>Power Rank: #{row.power_rank}</p>}
        {row.role === 'supporter' && row.assigned_to && (
          <p>Supporting: <span className="text-slate-300">{nameOf(row.assigned_to)}</span></p>
        )}
        {!isCommander && !isSubstitute && row.formation && <p>Formation: {row.formation}</p>}
        {row.role === 'main_player' && row.hero_squad_1 && (
          <p className="truncate">
            Squads: <span className="text-slate-300">{row.hero_squad_1}</span>
            {row.hero_squad_2 && <> | {row.hero_squad_2}</>}
            {row.hero_squad_3 && <> | {row.hero_squad_3}</>}
          </p>
        )}
      </div>

      {showFull && <FullInstructionCard row={row} />}
    </div>
  )
}

function SquadLine({ label, squad }: { label: string; squad: string }) {
  const conflict = findSquadTypeConflict(squad.split(' + ').map(s => s.trim()))
  return (
    <div>
      <p><span className="text-slate-400">{label}:</span> {squad}</p>
      {conflict && (
        <p className="text-[11px] text-amber-400">
          ⚠ Two {conflict} heroes in one squad — a march allows only 1 hero per troop type. Regenerate the plan.
        </p>
      )}
    </div>
  )
}

/** The member's complete personal instruction card — same content as their self-service page. */
function FullInstructionCard({ row }: { row: any }) {
  const roleLabel = row.role === 'reaction_team'
    ? `Reaction Team ${row.reaction_team_letter || ''}`
    : ROLE_LABELS[row.role] || row.role

  return (
    <div className="mt-2 bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-3">
      <div>
        <p className="text-sm text-amber-400 font-medium">Role: {roleLabel} — Legion {row.legion}</p>
        {row.formation && <p className="text-xs text-slate-400">Formation: {row.formation}</p>}
      </div>

      {row.hero_squad_1 && (
        <div className="text-sm text-slate-300 space-y-1">
          <SquadLine label="Squad 1 (Primary)" squad={row.hero_squad_1} />
          {row.hero_squad_2 && <SquadLine label="Squad 2 (Secondary)" squad={row.hero_squad_2} />}
          {row.hero_squad_3 && <SquadLine label="Squad 3 (Reserve)" squad={row.hero_squad_3} />}
        </div>
      )}
      {row.hero_recommendation && (
        <p className="text-xs text-slate-400 bg-slate-800 rounded-lg p-2.5">{row.hero_recommendation}</p>
      )}

      {row.stage_instructions && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Stage by Stage Instructions</p>
          <div className="text-sm text-slate-300 whitespace-pre-line bg-slate-800/60 border border-slate-700 rounded-lg p-3">
            {row.stage_instructions}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Pre-Battle Checklist</p>
        <ul className="text-sm text-slate-300 space-y-1">
          {TRI_CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-slate-500">☐</span> {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CallupControl({ eventId, substitute, combatants }: { eventId: string; substitute: any; combatants: any[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [absentId, setAbsentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function callUp() {
    if (!absentId) return
    setBusy(true)
    setError('')
    let res: Response
    try {
      res = await fetch('/api/tri-alliance/callup-substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, absentMemberId: absentId, substituteMemberId: substitute.member_id }),
      })
    } catch {
      setBusy(false)
      setError('Network error — try again.')
      return
    }
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Call-up failed')
      return
    }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-amber-400/90 hover:text-amber-400 px-1"
      >
        Call Up Substitute →
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap bg-slate-800/60 border border-slate-700 rounded-lg p-2">
      <select
        value={absentId}
        onChange={e => setAbsentId(e.target.value)}
        className="flex-1 min-w-[180px] h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="">Replace which absent member?</option>
        {combatants.map(c => (
          <option key={c.member_id} value={c.member_id}>
            {c.members?.player_name} — {c.role === 'reaction_team' ? `Reaction Team ${c.reaction_team_letter}` : ROLE_LABELS[c.role] || c.role}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={callUp} disabled={busy || !absentId}>
        {busy ? 'Swapping…' : 'Confirm Swap'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
      {error && <p className="text-red-400 text-xs w-full">{error}</p>}
    </div>
  )
}
