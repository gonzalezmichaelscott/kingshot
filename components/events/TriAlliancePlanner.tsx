// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Swords, Shield, Zap, RefreshCw, Megaphone, Repeat, Loader2 } from 'lucide-react'
import { formatPower } from '@/lib/utils'
import { findSquadTypeConflict } from '@/lib/hero-troop-types'

interface Props {
  eventId: string
  allianceTag: string
  availability: any[]
  triAssignments: any[]
  canManage: boolean
}

const ROLE_ORDER = ['main_player', 'supporter', 'special_force', 'reaction_team', 'commander', 'substitute']
const ROLE_META: Record<string, { label: string; icon: any; emoji: string }> = {
  main_player: { label: 'Main Players', icon: Swords, emoji: '⚔️' },
  supporter: { label: 'Supporters', icon: Shield, emoji: '🛡️' },
  special_force: { label: 'Special Commander Force', icon: Zap, emoji: '⚡' },
  reaction_team: { label: 'Reaction Team', icon: RefreshCw, emoji: '🔄' },
  commander: { label: 'Commanders', icon: Megaphone, emoji: '📣' },
  substitute: { label: 'Substitutes', icon: Repeat, emoji: '🔁' },
}

export function TriAlliancePlanner({ eventId, allianceTag, availability, triAssignments, canManage }: Props) {
  return (
    <div className="space-y-6">
      {[1, 2].map(legion => (
        <LegionPlanner
          key={legion}
          legion={legion}
          eventId={eventId}
          allianceTag={allianceTag}
          availability={availability}
          rows={triAssignments.filter(a => a.legion === legion)}
          canManage={canManage}
        />
      ))}
    </div>
  )
}

function LegionPlanner({ legion, eventId, allianceTag, availability, rows, canManage }: any) {
  const router = useRouter()
  const attending = availability.filter(a => a.will_attend && a.squad_preference === `legion${legion}`)
  const [commander1, setCommander1] = useState('')
  const [commander2, setCommander2] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const hasPlan = rows.length > 0
  const canGenerate = canManage && attending.length >= 15

  async function generate() {
    setGenerating(true)
    setError('')
    const commanderIds = [commander1, commander2].filter(Boolean)
    let res: Response
    try {
      res = await fetch('/api/tri-alliance/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, legionNumber: legion, commanderIds }),
      })
    } catch {
      setGenerating(false)
      setError('Network error — plan was not generated. Please try again.')
      return
    }
    setGenerating(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Plan generation failed')
      return
    }
    router.refresh()
  }

  // Don't render an empty Legion 2 section to non-leaders when nothing is planned.
  if (!canManage && !hasPlan) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Swords size={18} className="text-amber-500" />
          Legion {legion} Battle Plan
        </CardTitle>
        <p className="text-xs text-slate-400">
          {attending.length} member{attending.length === 1 ? '' : 's'} attending Legion {legion}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="space-y-3 bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Designate Commanders (buff management role — pick your most active players)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <CommanderSelect value={commander1} onChange={setCommander1} attending={attending} exclude={commander2} placeholder="Commander 1 (optional)" />
                <CommanderSelect value={commander2} onChange={setCommander2} attending={attending} exclude={commander1} placeholder="Commander 2 (optional)" />
              </div>
            </div>
            <Button onClick={generate} disabled={!canGenerate || generating} className="w-full sm:w-auto">
              {generating ? (
                <><Loader2 size={14} className="mr-1.5 animate-spin" /> Generating Legion {legion} plan…</>
              ) : (
                <>{hasPlan ? 'Regenerate' : 'Generate'} Battle Plan — Legion {legion}</>
              )}
            </Button>
            {!canGenerate && attending.length < 15 && (
              <p className="text-xs text-slate-500">Needs at least 15 attending members to generate (has {attending.length}).</p>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        )}

        {hasPlan && <LegionRoster rows={rows} eventId={eventId} allianceTag={allianceTag} canManage={canManage} />}
        {!hasPlan && !canManage && (
          <p className="text-sm text-slate-500">No battle plan generated yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

function CommanderSelect({ value, onChange, attending, exclude, placeholder }: any) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <option value="">{placeholder}</option>
      {attending.map((a: any) => {
        const m = a.members
        if (!m || m.id === exclude) return null
        return <option key={m.id} value={m.id}>{m.player_name} ({formatPower(m.power || 0)})</option>
      })}
    </select>
  )
}

function LegionRoster({ rows, eventId, allianceTag, canManage }: any) {
  const byRole = (role: string) => rows
    .filter((r: any) => r.role === role)
    .sort((a: any, b: any) => (a.power_rank ?? 999) - (b.power_rank ?? 999) || ((b.members?.power || 0) - (a.members?.power || 0)))

  const reactionA = byRole('reaction_team').filter((r: any) => r.reaction_team_letter === 'A')
  const reactionB = byRole('reaction_team').filter((r: any) => r.reaction_team_letter !== 'A')
  const subs = byRole('substitute')
  const combatants = rows.filter((r: any) => r.role !== 'substitute')
  const nameOf = (memberId: string) => rows.find((r: any) => r.member_id === memberId)?.members?.player_name || '?'

  const groups: { key: string; title: string; list: any[] }[] = [
    { key: 'main_player', title: `${ROLE_META.main_player.emoji} Main Players (${byRole('main_player').length})`, list: byRole('main_player') },
    { key: 'supporter', title: `${ROLE_META.supporter.emoji} Supporters (${byRole('supporter').length})`, list: byRole('supporter') },
    { key: 'special_force', title: `${ROLE_META.special_force.emoji} Special Commander Force (${byRole('special_force').length})`, list: byRole('special_force') },
    { key: 'reaction_a', title: `${ROLE_META.reaction_team.emoji} Reaction Team A (${reactionA.length})`, list: reactionA },
    { key: 'reaction_b', title: `${ROLE_META.reaction_team.emoji} Reaction Team B (${reactionB.length})`, list: reactionB },
    { key: 'commander', title: `${ROLE_META.commander.emoji} Commanders (${byRole('commander').length})`, list: byRole('commander') },
  ]

  return (
    <div className="space-y-4">
      {groups.map(g => g.list.length > 0 && (
        <div key={g.key}>
          <h3 className="text-sm font-medium text-amber-400 mb-2">{g.title}</h3>
          <div className="space-y-1.5">
            {g.list.map((r: any) => (
              <MemberRow key={r.id} row={r} allianceTag={allianceTag} supporterOf={r.assigned_to ? nameOf(r.assigned_to) : null} />
            ))}
          </div>
        </div>
      ))}

      {subs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-2">{ROLE_META.substitute.emoji} Substitutes ({subs.length})</h3>
          <div className="space-y-1.5">
            {subs.map((r: any) => (
              <div key={r.id} className="space-y-1">
                <MemberRow row={r} allianceTag={allianceTag} supporterOf={null} />
                {canManage && (
                  <CallupControl eventId={eventId} substitute={r} combatants={combatants} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MemberRow({ row, allianceTag, supporterOf }: any) {
  const m = row.members
  const roleLabel = row.role === 'reaction_team'
    ? `Reaction Team ${row.reaction_team_letter || ''}`
    : ROLE_META[row.role]?.label.replace(/s$/, '') || row.role
  return (
    <div className="bg-slate-800 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">[{allianceTag}] {m?.player_name || 'Unknown'}</span>
          <span className="text-xs text-slate-500">{formatPower(m?.power || 0)}</span>
        </div>
        <span className="text-[11px] text-amber-400/90 font-medium">{roleLabel}</span>
      </div>
      <div className="mt-1 text-xs text-slate-400 space-y-0.5">
        {supporterOf && <p>Supports: <span className="text-slate-300">{supporterOf}</span></p>}
        <p>Formation: {row.formation}</p>
        {row.hero_squad_1 && (
          <p className="truncate">
            Squads: <span className="text-slate-300">{row.hero_squad_1}</span>
            {row.hero_squad_2 && <> | {row.hero_squad_2}</>}
            {row.hero_squad_3 && <> | {row.hero_squad_3}</>}
          </p>
        )}
        {(() => {
          const conflict = [row.hero_squad_1, row.hero_squad_2, row.hero_squad_3]
            .filter(Boolean)
            .map((s: string) => findSquadTypeConflict(s.split(' + ').map(n => n.trim())))
            .find(Boolean)
          return conflict ? (
            <p className="text-amber-400">⚠ Two {conflict} heroes share a squad — regenerate the plan (1 hero per troop type per march).</p>
          ) : null
        })()}
      </div>
    </div>
  )
}

function CallupControl({ eventId, substitute, combatants }: any) {
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
        {combatants.map((c: any) => (
          <option key={c.member_id} value={c.member_id}>
            {c.members?.player_name} — {c.role === 'reaction_team' ? `Reaction Team ${c.reaction_team_letter}` : ROLE_META[c.role]?.label.replace(/s$/, '')}
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
