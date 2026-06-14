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
  /** swordland_assignments rows (incl. members embed). */
  assignments: any[]
  canManage: boolean
}

const TEAM_LABELS: Record<string, string> = {
  attacker: 'Attacker',
  support: 'Support',
  defender_a: 'Defender Team A',
  defender_b: 'Defender Team B',
  substitute: 'Substitute',
}

const TEAM_NOTE: Record<string, string> = {
  attacker: 'Capture and move on — do not garrison',
  support: 'Whale leads — fill gaps, farm Baggage Trains',
  defender_a: 'Hold your building targets',
  defender_b: 'Hold your building targets',
}

const SWORDLAND_CHECKLIST = [
  'Recall all troops before battle',
  'Clear infirmary (cannot enter with injured troops)',
  'Activate buffs, pet skills, and best gear before battle starts',
  'Start with full energy / free teleporters',
  'Join Discord/voice chat',
  'Know your building targets (Defenders) or enemy targets (Attackers)',
]

/**
 * Full Swordland Showdown team plan view for the event page: per-legion
 * collapsible roster grouped by team, with shared phase instructions per team
 * group and an expandable full personal instruction card per member (same
 * content members see on their self-service page).
 */
export function SwordlandFullPlan({ eventId, allianceTag, assignments, canManage }: Props) {
  const legions = [1, 2].filter(legion => assignments.some(a => a.legion === legion))
  if (legions.length === 0) return null

  return (
    <div className="space-y-6">
      {legions.map(legion => (
        <LegionPlanSection
          key={legion}
          legion={legion}
          eventId={eventId}
          allianceTag={allianceTag}
          rows={assignments.filter(a => a.legion === legion)}
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

  const byTeam = (team: string) => rows
    .filter(r => r.team === team)
    .sort((a, b) => (a.power_rank ?? 999) - (b.power_rank ?? 999) || ((b.members?.power || 0) - (a.members?.power || 0)))

  const groups = [
    { key: 'attacker', title: `⚔️ Attackers (${byTeam('attacker').length})`, list: byTeam('attacker') },
    { key: 'support', title: `🛡️ Support (${byTeam('support').length})`, list: byTeam('support') },
    { key: 'defender_a', title: `🏰 Defender Team A (${byTeam('defender_a').length})`, list: byTeam('defender_a') },
    { key: 'defender_b', title: `🏰 Defender Team B (${byTeam('defender_b').length})`, list: byTeam('defender_b') },
  ]
  const subs = byTeam('substitute')

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
          {canManage && <RegeneratePlanButton eventId={eventId} legion={legion} />}

          {groups.map(g => g.list.length > 0 && (
            <TeamGroup key={g.key} teamKey={g.key} title={g.title} list={g.list} allianceTag={allianceTag} />
          ))}

          {subs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">🔁 Substitutes ({subs.length})</h3>
              <div className="space-y-1.5">
                {subs.map(r => (
                  <PlanMemberCard key={r.id} row={r} allianceTag={allianceTag} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function RegeneratePlanButton({ eventId, legion }: { eventId: string; legion: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function regenerate() {
    if (!window.confirm(`Clear the current Legion ${legion} plan and generate a fresh one? The other legion's plan is not affected.`)) return
    setBusy(true)
    setError('')
    let res: Response
    try {
      res = await fetch('/api/swordland/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, legionNumber: legion }),
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

function TeamGroup({ teamKey, title, list, allianceTag }: {
  teamKey: string
  title: string
  list: any[]
  allianceTag: string
}) {
  const buildingTargets = list.find(r => r.building_targets)?.building_targets
  return (
    <div>
      <h3 className="text-sm font-medium text-amber-400 mb-1">{title}</h3>
      {(teamKey === 'defender_a' || teamKey === 'defender_b') && buildingTargets && (
        <p className="text-xs text-slate-400 mb-2">Building targets: <span className="text-slate-300">{buildingTargets}</span></p>
      )}
      <div className="space-y-1.5">
        {list.map(r => (
          <PlanMemberCard key={r.id} row={r} allianceTag={allianceTag} />
        ))}
      </div>
      <SharedInstructions list={list} />
    </div>
  )
}

/**
 * Phase-by-phase instructions shown once per team group — all members of a team
 * share the same instructions (Swordland gives every team member the same plan).
 */
function SharedInstructions({ list }: { list: any[] }) {
  const text = list.find(r => r.stage_instructions)?.stage_instructions
  if (!text) return null
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Phase by Phase Instructions — all members on this team</p>
      <div className="text-sm text-slate-300 whitespace-pre-line bg-slate-800/60 border border-slate-700 rounded-lg p-3">
        {text}
      </div>
    </div>
  )
}

function PlanMemberCard({ row, allianceTag }: { row: any; allianceTag: string }) {
  const [showFull, setShowFull] = useState(false)
  const m = row.members
  const isSubstitute = row.team === 'substitute'

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
          <span className="text-xs text-slate-500">{formatPower(m?.power || 0)}</span>
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
        {isSubstitute ? (
          row.power_rank != null && <p>Power Rank: #{row.power_rank}</p>
        ) : (
          TEAM_NOTE[row.team] && <p>{TEAM_NOTE[row.team]}</p>
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
  return (
    <div className="mt-2 bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-3">
      <div>
        <p className="text-sm text-amber-400 font-medium">Team: {TEAM_LABELS[row.team] || row.team} — Legion {row.legion}</p>
        {row.building_targets && <p className="text-xs text-slate-400">Targets: {row.building_targets}</p>}
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
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Phase by Phase Instructions</p>
          <div className="text-sm text-slate-300 whitespace-pre-line bg-slate-800/60 border border-slate-700 rounded-lg p-3">
            {row.stage_instructions}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Pre-Battle Checklist</p>
        <ul className="text-sm text-slate-300 space-y-1">
          {SWORDLAND_CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-slate-500">☐</span> {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
