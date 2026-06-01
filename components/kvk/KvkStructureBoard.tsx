// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Castle, Shield, ChevronDown, ChevronUp, Crown, Users, Clock, Star, ExternalLink, Loader2, UserPlus } from 'lucide-react'

interface Assignee { id: string; player_name: string; tag?: string | null; role?: string | null }
interface Recommended { id: string; player_name: string; tag?: string | null; score: number }
interface Structure {
  key: string
  label: string
  voiceChannel: string
  voiceUrl: string | null
  canSeeVoice: boolean
  leader: Assignee | null
  joiners: Assignee[]
  recommended: Recommended[]
  coverage: boolean[]
}

interface Props {
  kingdomId: string
  structures: Structure[]
  hourLabels: string[]
  pool: { id: string; player_name: string; tag?: string | null }[]
  canManage: boolean
}

export function KvkStructureBoard({ kingdomId, structures, hourLabels, pool, canManage }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Castle size={18} className="text-amber-500" />
          Structure Assignments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {structures.map(s => {
            const isOpen = expanded === s.key
            const assigned = (s.leader ? 1 : 0) + s.joiners.length
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setExpanded(isOpen ? null : s.key)}
                className={
                  'text-left bg-slate-800 rounded-lg p-3 border transition-colors hover:border-amber-500/50 ' +
                  (isOpen ? 'border-amber-500/60' : 'border-transparent')
                }
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-200">{s.label}</p>
                  {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {s.leader ? (
                    <span className="text-amber-400">Lead: {s.leader.player_name}</span>
                  ) : (
                    <span className="text-slate-500">Unassigned</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{assigned} assigned</p>
              </button>
            )
          })}
        </div>

        {/* Detail panel */}
        {expanded && (
          <StructureDetail
            kingdomId={kingdomId}
            structure={structures.find(s => s.key === expanded)!}
            hourLabels={hourLabels}
            pool={pool}
            canManage={canManage}
          />
        )}
      </CardContent>
    </Card>
  )
}

function StructureDetail({ kingdomId, structure, hourLabels, pool, canManage }: {
  kingdomId: string
  structure: Structure
  hourLabels: string[]
  pool: { id: string; player_name: string; tag?: string | null }[]
  canManage: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function assign() {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/kvk/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kingdomId, memberId: selected, squad: structure.key }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to assign')
      }
      setSelected('')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-slate-900/60 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield size={16} className="text-amber-500" />
          {structure.label}
        </h3>
        {structure.canSeeVoice && structure.voiceUrl && (
          <a
            href={structure.voiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <ExternalLink size={12} />
            Join voice
          </a>
        )}
      </div>

      {/* Rally leader */}
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
          <Crown size={12} /> Rally Leader
        </p>
        {structure.leader ? (
          <p className="text-sm text-amber-400 font-medium">
            {structure.leader.tag ? `[${structure.leader.tag}] ` : ''}{structure.leader.player_name}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Unassigned</p>
        )}
      </div>

      {/* Joiners */}
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
          <Users size={12} /> Assigned Joiners ({structure.joiners.length})
        </p>
        {structure.joiners.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {structure.joiners.map(j => (
              <span key={j.id} className="text-xs bg-slate-800 rounded px-2 py-1 text-slate-300">
                {j.tag ? `[${j.tag}] ` : ''}{j.player_name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No joiners assigned yet.</p>
        )}
      </div>

      {/* Coverage timeline */}
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
          <Clock size={12} /> Coverage Timeline
        </p>
        <div className="flex gap-1">
          {hourLabels.map((label, i) => (
            <div key={i} className="flex-1 text-center">
              <div
                className={
                  'h-6 rounded ' +
                  (structure.coverage[i] ? 'bg-green-600/60' : 'bg-slate-800 border border-slate-700')
                }
                title={structure.coverage[i] ? `${label} covered` : `${label} no coverage`}
              />
              <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended players */}
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
          <Star size={12} /> Recommended (top 5 by score)
        </p>
        {structure.recommended.length > 0 ? (
          <div className="space-y-1">
            {structure.recommended.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  {r.tag ? <span className="text-amber-400 text-xs">[{r.tag}] </span> : ''}{r.player_name}
                </span>
                <span className="font-mono text-slate-400 text-xs">{r.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No scored players available.</p>
        )}
      </div>

      {/* Manual assign */}
      {canManage && (
        <div className="border-t border-slate-800 pt-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
            <UserPlus size={12} /> Assign a player to {structure.label}
          </p>
          <div className="flex gap-2 flex-wrap">
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="flex-1 min-w-[180px] h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a player…</option>
              {pool.map(p => (
                <option key={p.id} value={p.id}>
                  {p.tag ? `[${p.tag}] ` : ''}{p.player_name}
                </option>
              ))}
            </select>
            <Button onClick={assign} disabled={!selected || saving} size="md">
              {saving ? <Loader2 size={16} className="mr-1 animate-spin" /> : null}
              Assign
            </Button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  )
}
