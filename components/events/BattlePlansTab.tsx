// @ts-nocheck
'use client'
import { useState } from 'react'
import { BattlePlanButton } from './BattlePlanButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Download,
  Users,
  Sword,
  Shield,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Info,
} from 'lucide-react'

interface Props {
  event: any
  assignments: any[]
  canManage: boolean
  allianceId: string
}

function roleBadgeColor(role: string) {
  if (role.includes('leader')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  if (role.includes('joiner')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  if (role.includes('garrison') || role.includes('castle') || role.includes('turret') || role.includes('defender'))
    return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (role.includes('backup')) return 'bg-slate-500/20 text-slate-400 border-slate-600'
  return 'bg-slate-500/20 text-slate-400 border-slate-600'
}

function roleLabel(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function InstructionCard({ assignment }: { assignment: any }) {
  const [open, setOpen] = useState(false)
  const name = assignment.members?.player_name || 'Unknown'
  const instructions = assignment.member_instructions

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 p-3 bg-slate-800 hover:bg-slate-750 text-left transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
          <span className="font-medium text-sm truncate">{name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${roleBadgeColor(assignment.role)}`}>
            {roleLabel(assignment.role)}
          </span>
          {assignment.squad && (
            <span className="text-[10px] text-slate-500 flex-shrink-0">Squad {assignment.squad}</span>
          )}
        </div>
        {instructions && (
          <CopyButton text={instructions} label="Copy instructions" />
        )}
      </button>
      {open && (
        <div className="p-3 bg-slate-900 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono text-xs border-t border-slate-700">
          {instructions || assignment.reasoning || 'No instructions generated yet.'}
        </div>
      )}
    </div>
  )
}

function SquadCard({ squad, assignments }: { squad: string; assignments: any[] }) {
  const leader = assignments.find(a => a.role.toLowerCase().includes('leader') && !a.is_backup)
  const joiners = assignments.filter(a => a.role.toLowerCase().includes('joiner') && !a.is_backup)
  const others = assignments.filter(a => !a.role.toLowerCase().includes('leader') && !a.role.toLowerCase().includes('joiner') && !a.is_backup)

  const squadLabel = squad
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sword size={14} className="text-amber-500" />
          {squadLabel}
          <span className="text-slate-500 font-normal text-xs">({assignments.filter(a => !a.is_backup).length} assigned)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Leader */}
        {leader && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Sword size={13} className="text-amber-400" />
                <span className="font-semibold text-sm">{leader.members?.player_name}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleBadgeColor(leader.role)}`}>
                {roleLabel(leader.role)}
              </span>
            </div>
            {leader.reasoning && (
              <p className="text-xs text-slate-400 leading-relaxed">{leader.reasoning}</p>
            )}
          </div>
        )}

        {/* Joiners */}
        {joiners.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2 flex items-center gap-1">
              <Users size={10} /> Joiners ({joiners.length})
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {joiners.map(j => (
                <div key={j.id} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-sm font-medium">{j.members?.player_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeColor(j.role)}`}>
                      Joiner
                    </span>
                  </div>
                  {j.reasoning && (
                    <p className="text-xs text-slate-400 leading-snug line-clamp-2">{j.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Others (garrison etc.) */}
        {others.map(o => (
          <div key={o.id} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={12} className="text-green-400" />
              <span className="text-sm font-medium">{o.members?.player_name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeColor(o.role)}`}>
                {roleLabel(o.role)}
              </span>
            </div>
            {o.reasoning && <p className="text-xs text-slate-400">{o.reasoning}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function buildExportText(event: any, assignments: any[]): string {
  const plan = event.battle_plan as any
  const eventName = event.name || event.event_types?.name || 'Battle Event'
  const date = event.battle_start_utc
    ? new Date(event.battle_start_utc).toUTCString().slice(0, 16)
    : 'TBD'

  const lines: string[] = [
    `════════════════════════════════`,
    `BATTLE PLAN — ${eventName}`,
    `Date: ${date}`,
    `════════════════════════════════`,
    '',
  ]

  if (plan?.summary) {
    lines.push('SUMMARY:', plan.summary, '')
  }

  // Group by squad
  const squadMapExport = new Map<string, any[]>()
  for (const a of assignments) {
    const key = a.squad || 'unassigned'
    if (!squadMapExport.has(key)) squadMapExport.set(key, [])
    squadMapExport.get(key)!.push(a)
  }

  for (const [squad, members] of Array.from(squadMapExport.entries())) {
    lines.push(`── ${squad.toUpperCase().replace(/_/g, ' ')} ──`)
    for (const a of members) {
      const name = a.members?.player_name || a.member_id
      const role = roleLabel(a.role)
      const backup = a.is_backup ? ' (BACKUP)' : ''
      lines.push(`  ${role}${backup}: ${name}`)
      if (a.reasoning) lines.push(`    → ${a.reasoning}`)
    }
    lines.push('')
  }

  if (plan?.coverage_gaps?.length) {
    lines.push('⚠ COVERAGE GAPS:')
    for (const g of plan.coverage_gaps) lines.push(`  • ${g}`)
    lines.push('')
  }

  if (plan?.joiner_stacking_advice) {
    lines.push('JOINER STACKING:', plan.joiner_stacking_advice, '')
  }

  if (plan?.backup_plan) {
    lines.push('BACKUP PLAN:', plan.backup_plan, '')
  }

  lines.push(`════════════════════════════════`)
  return lines.join('\n')
}

export function BattlePlansTab({ event, assignments, canManage, allianceId }: Props) {
  const plan = event.battle_plan as any
  const [showSend, setShowSend] = useState(false)

  const primary = assignments.filter(a => !a.is_backup)
  const backups = assignments.filter(a => a.is_backup)
  const support = assignments.filter(
    a => !a.is_backup && (a.role.toLowerCase().includes('support') || a.role.toLowerCase().includes('backup_')),
  )

  // Group non-support, non-backup by squad
  const squadMap = new Map<string, any[]>()
  for (const a of primary.filter(a => !support.includes(a))) {
    const key = a.squad || 'unassigned'
    if (!squadMap.has(key)) squadMap.set(key, [])
    squadMap.get(key)!.push(a)
  }
  const squads = Array.from(squadMap.entries())

  const hasPlan = assignments.length > 0

  if (!hasPlan) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Sword className="mx-auto text-slate-600" size={40} />
            <div>
              <p className="text-slate-300 font-medium">No battle plan generated yet</p>
              <p className="text-slate-500 text-sm mt-1">
                Generate a plan once members have registered their availability.
              </p>
            </div>
            {canManage && <BattlePlanButton eventId={event.id} />}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Summary Card */}
      {plan?.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info size={16} className="text-amber-500" />
              Plan Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 text-sm leading-relaxed">{plan.summary}</p>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
              <span>{primary.length} primary assignments</span>
              {backups.length > 0 && <span>{backups.length} backups</span>}
              <span>Generated {event.battle_plan ? 'with AI' : ''}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage warnings */}
      {plan?.coverage_gaps?.length > 0 && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 space-y-1">
          <p className="flex items-center gap-2 text-red-400 font-semibold text-sm">
            <AlertTriangle size={15} /> Coverage Warnings
          </p>
          {plan.coverage_gaps.map((g: string, i: number) => (
            <p key={i} className="text-red-300/80 text-sm ml-5">• {g}</p>
          ))}
        </div>
      )}

      {/* AI Warnings */}
      {plan?.warnings?.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3 space-y-1">
          <p className="text-amber-400 font-semibold text-xs uppercase tracking-wide">AI Notes</p>
          {plan.warnings.map((w: string, i: number) => (
            <p key={i} className="text-amber-300/70 text-sm">• {w}</p>
          ))}
        </div>
      )}

      {/* Squad sections */}
      {squads.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Squads & Assignments</h2>
          {squads.map(([squad, members]) => (
            <SquadCard key={squad} squad={squad} assignments={members} />
          ))}
        </div>
      )}

      {/* Support section */}
      {support.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield size={14} className="text-green-400" />
              Support / Weakening
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {support.map(a => (
                <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">{a.members?.player_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeColor(a.role)}`}>
                      {roleLabel(a.role)}
                    </span>
                  </div>
                  {a.reasoning && <p className="text-xs text-slate-400">{a.reasoning}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backups */}
      {backups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-400">Backup Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {backups.map(a => (
                <div key={a.id} className="bg-slate-800/60 border border-slate-700 rounded-lg p-2.5 opacity-80">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{a.members?.player_name}</span>
                    <span className="text-[10px] text-slate-500 border border-slate-600 px-1.5 py-0.5 rounded">Backup</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeColor(a.role)}`}>
                      {roleLabel(a.role)}
                    </span>
                  </div>
                  {a.reasoning && <p className="text-xs text-slate-400">{a.reasoning}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Joiner stacking advice */}
      {plan?.joiner_stacking_advice && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={14} className="text-blue-400" />
              Joiner Hero Stacking Advice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 leading-relaxed">{plan.joiner_stacking_advice}</p>
          </CardContent>
        </Card>
      )}

      {/* R4/R5 Actions */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Plan Management</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <BattlePlanButton eventId={event.id} label="Regenerate Plan" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const text = buildExportText(event, assignments)
                const blob = new Blob([text], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `battle-plan-${event.id.slice(0, 8)}.txt`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <Download size={14} className="mr-1.5" /> Export Plan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSend(s => !s)}
            >
              <Users size={14} className="mr-1.5" />
              {showSend ? 'Hide' : 'Send to Members'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Send to Members panel */}
      {showSend && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={14} className="text-amber-500" />
              Member Instructions — Copy & Share
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 mb-4">
              Click any member card to expand their instructions. Use "Copy instructions" to send via Discord or in-game chat.
            </p>
            <div className="space-y-2">
              {assignments.map(a => (
                <InstructionCard key={a.id} assignment={a} />
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <CopyButton
                text={buildExportText(event, assignments)}
                label="Copy full plan (all squads)"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
