// @ts-nocheck
'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CITY_SLOTS, SLOT_BY_ID, TURRETS,
  CASTLE_MIN, CASTLE_MAX, OUTER_MIN, OUTER_MAX, SLOT_SIZE,
} from '@/lib/castle-map'
import { X, Loader2, Crown, Users } from 'lucide-react'

interface CityMember { id: string; player_name: string; game_id?: string | null; tag?: string | null }
interface RoleInfo { role: string; squad: string; rally_number: number | null }

interface Props {
  eventId: string | null
  members: CityMember[]
  initialAssignments: { member_id: string; slot_position: string }[]
  roleByMember: Record<string, RoleInfo>
  canManage: boolean
}

const CAT_COLORS: Record<string, string> = {
  castle1: '#fcd34d',     // gold — Castle Rally 1 leader
  castle2: '#cbd5e1',     // silver — Castle Rally 2 leader
  turretLeader: '#a855f7',// purple — turret leader
  joiner: '#f59e0b',      // amber — rally joiner
  support: '#64748b',     // gray — support city position
}

const TAG_PALETTE = ['#d97706', '#2563eb', '#16a34a', '#9333ea', '#e11d48', '#0891b2', '#4f46e5', '#ea580c']
function colorForTag(tag?: string | null): string {
  const key = tag || '??'
  const sum = Array.from(key).reduce((a, c) => a + c.charCodeAt(0), 0)
  return TAG_PALETTE[sum % TAG_PALETTE.length]
}
function initials(name: string): string {
  return (name || '??').slice(0, 2).toUpperCase()
}
function trunc(name: string, n = 7): string {
  return name.length > n ? name.slice(0, n - 1) + '…' : name
}
function roleCategory(info?: RoleInfo | null): string {
  if (!info) return 'support'
  const r = (info.role || '').toLowerCase()
  if (r.includes('leader')) {
    if (info.squad === 'castle') return info.rally_number === 2 ? 'castle2' : 'castle1'
    return 'turretLeader'
  }
  if (r === 'support' || info.squad === 'support') return 'support'
  return 'joiner'
}
const SIDE_NAMES: Record<string, string> = { n: 'North', e: 'East', s: 'South', w: 'West' }

export function CastleMap({ eventId, members, initialAssignments, roleByMember, canManage }: Props) {
  const [list, setList] = useState(initialAssignments)
  const [selected, setSelected] = useState<string | null>(null)
  const [pendingMember, setPendingMember] = useState('')
  const [busy, setBusy] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const memberById = useMemo(() => {
    const m: Record<string, CityMember> = {}
    for (const x of members) m[x.id] = x
    return m
  }, [members])

  const bySlot = useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of list) m[a.slot_position] = a.member_id
    return m
  }, [list])

  const assignedIds = useMemo(() => new Set(list.map(a => a.member_id)), [list])
  const unassigned = useMemo(
    () => members.filter(m => !assignedIds.has(m.id)).sort((a, b) => (a.tag || '').localeCompare(b.tag || '') || a.player_name.localeCompare(b.player_name)),
    [members, assignedIds]
  )

  async function reload() {
    if (!eventId) return
    const { data } = await supabase
      .from('kvk_city_assignments')
      .select('member_id, slot_position')
      .eq('event_id', eventId)
    if (data) setList(data)
  }

  // Live sync — every viewer sees positions update as leaders edit them.
  useEffect(() => {
    if (!eventId) return
    const channel = supabase
      .channel(`kvk-city:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kvk_city_assignments', filter: `event_id=eq.${eventId}` }, () => { reload() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function assignToSlot(slotId: string, memberId: string) {
    if (!eventId || !memberId) return
    setBusy(true)
    try {
      const res = await fetch('/api/kvk/city-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, memberId, slotPosition: slotId }),
      })
      if (res.ok) {
        // Optimistic: drop any existing slot for this member, then set the new one.
        setList(prev => [...prev.filter(a => a.member_id !== memberId && a.slot_position !== slotId), { member_id: memberId, slot_position: slotId }])
        setSelected(null)
        setPendingMember('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function removeFromSlot(slotId: string) {
    if (!eventId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/kvk/city-assign?eventId=${eventId}&slot=${encodeURIComponent(slotId)}`, { method: 'DELETE' })
      if (res.ok) {
        setList(prev => prev.filter(a => a.slot_position !== slotId))
        setSelected(null)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!eventId) {
    return <p className="text-sm text-slate-400 py-4 text-center">No active KVK event — the positioning map appears once an alliance has an active Castle Battle.</p>
  }

  const selectedMemberId = selected ? bySlot[selected] : null
  const selectedMember = selectedMemberId ? memberById[selectedMemberId] : null
  const selectedSlot = selected ? SLOT_BY_ID[selected] : null

  return (
    <div className="space-y-4">
      {/* The diamond map */}
      <div className="relative w-full max-w-[420px] mx-auto aspect-square">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{ transform: 'rotate(45deg) scale(0.72)' }}
          >
            <defs>
              <pattern id="cm-grid" width="5" height="5" patternUnits="userSpaceOnUse">
                <rect width="5" height="5" fill="#14321f" />
                <path d="M5 0 L0 0 L0 5" fill="none" stroke="#1f4d30" strokeWidth="0.4" />
              </pattern>
            </defs>

            {/* Muted green grid backdrop */}
            <rect x="0" y="0" width="100" height="100" fill="url(#cm-grid)" />

            {/* Outer battle boundary (dashed diamond) */}
            <rect
              x={OUTER_MIN} y={OUTER_MIN} width={OUTER_MAX - OUTER_MIN} height={OUTER_MAX - OUTER_MIN}
              fill="none" stroke="#64748b" strokeWidth="0.6" strokeDasharray="2 1.6"
            />

            {/* City slots */}
            {CITY_SLOTS.map(slot => {
              const memberId = bySlot[slot.id]
              const m = memberId ? memberById[memberId] : null
              const cat = m ? roleCategory(roleByMember[memberId]) : null
              const stroke = cat ? CAT_COLORS[cat] : '#475569'
              const fill = m ? colorForTag(m.tag) + '55' : 'rgba(15,23,42,0.55)'
              const isLeaderCat = cat === 'castle1' || cat === 'castle2' || cat === 'turretLeader'
              const half = SLOT_SIZE / 2
              return (
                <g key={slot.id} onClick={() => canManage && setSelected(slot.id)} style={{ cursor: canManage ? 'pointer' : 'default' }}>
                  <rect
                    x={slot.x - half} y={slot.y - half} width={SLOT_SIZE} height={SLOT_SIZE} rx="1"
                    fill={fill} stroke={stroke} strokeWidth={isLeaderCat ? 1 : 0.5}
                    opacity={selected === slot.id ? 1 : 0.96}
                  />
                  <g transform={`rotate(-45 ${slot.x} ${slot.y})`}>
                    {m ? (
                      <>
                        <circle cx={slot.x} cy={slot.y - 1.3} r="1.9" fill={colorForTag(m.tag)} />
                        <text x={slot.x} y={slot.y - 0.7} textAnchor="middle" fontSize="1.7" fontWeight="bold" fill="#fff">{initials(m.player_name)}</text>
                        {m.tag && <text x={slot.x} y={slot.y + 2} textAnchor="middle" fontSize="1.4" fill="#fcd34d">[{trunc(m.tag, 4)}]</text>}
                        <text x={slot.x} y={slot.y + 3.9} textAnchor="middle" fontSize="1.5" fill="#e2e8f0">{trunc(m.player_name)}</text>
                      </>
                    ) : (
                      <text x={slot.x} y={slot.y + 1.4} textAnchor="middle" fontSize="4.5" fill="#475569">+</text>
                    )}
                  </g>
                </g>
              )
            })}

            {/* Turrets — purple squares with "T" at the four diamond tips (corners
                of the square become the top/right/bottom/left tips after rotation) */}
            {TURRETS.map(t => (
              <g key={t.side}>
                <rect x={t.x - 4.5} y={t.y - 4.5} width="9" height="9" rx="1" fill="#7c3aed" stroke="#a855f7" strokeWidth="0.6" />
                <g transform={`rotate(-45 ${t.x} ${t.y})`}>
                  <text x={t.x} y={t.y + 0.3} textAnchor="middle" fontSize="3.4" fontWeight="bold" fill="#fff">T</text>
                  <text x={t.x} y={t.y + 3} textAnchor="middle" fontSize="1.8" fill="#ddd6fe">{t.label}</text>
                </g>
              </g>
            ))}

            {/* King's Castle — large orange/brown diamond with "K" */}
            <rect
              x={CASTLE_MIN} y={CASTLE_MIN} width={CASTLE_MAX - CASTLE_MIN} height={CASTLE_MAX - CASTLE_MIN} rx="2"
              fill="#b45309" stroke="#f59e0b" strokeWidth="1"
            />
            <g transform={`rotate(-45 50 50)`}>
              <text x="50" y="52.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff7ed">K</text>
              <text x="50" y="58" textAnchor="middle" fontSize="2.4" fill="#fde68a">King&apos;s Castle</text>
            </g>
          </svg>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 text-center -mt-1">
        Front 2 rows shown — 6 positions per row per face. Turrets sit at the four diamond tips (N/E/S/W).
      </p>

      {/* Selected slot editor */}
      {canManage && selected && selectedSlot && (
        <div className="rounded-xl border border-amber-500/40 bg-slate-900/70 p-3 space-y-2 max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">
              {SIDE_NAMES[selectedSlot.side]} face · {selectedSlot.depth === 0 ? 'front line' : 'rear'}
            </p>
            <button onClick={() => { setSelected(null); setPendingMember('') }} className="text-slate-400 hover:text-slate-200"><X size={16} /></button>
          </div>

          {selectedMember ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-slate-200">
                {selectedMember.tag ? <span className="text-amber-400 text-xs">[{selectedMember.tag}] </span> : ''}{selectedMember.player_name}
              </span>
              <button onClick={() => removeFromSlot(selected)} disabled={busy}
                className="text-xs bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                {busy ? <Loader2 size={12} className="animate-spin" /> : 'Remove'}
              </button>
            </div>
          ) : null}

          <div className="flex gap-2">
            <select value={pendingMember} onChange={e => setPendingMember(e.target.value)}
              className="flex-1 min-w-0 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500">
              <option value="">{selectedMember ? 'Reassign to…' : 'Assign a member…'}</option>
              {unassigned.map(p => (
                <option key={p.id} value={p.id}>{p.tag ? `[${p.tag}] ` : ''}{p.player_name}</option>
              ))}
            </select>
            <button onClick={() => assignToSlot(selected, pendingMember)} disabled={!pendingMember || busy}
              className="text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-3 rounded-lg disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : 'Set'}
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-xs text-slate-400">
        <LegendDot color={CAT_COLORS.castle1} label="Castle Rally 1 Leader" />
        <LegendDot color={CAT_COLORS.castle2} label="Castle Rally 2 Leader" />
        <LegendDot color={CAT_COLORS.turretLeader} label="Turret Leader" />
        <LegendDot color={CAT_COLORS.joiner} label="Rally Joiner" />
        <LegendDot color={CAT_COLORS.support} label="Support" />
        <LegendDot color="#475569" label="Unassigned" outline />
      </div>

      {/* Support / Gathering Behind */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
          <Users size={12} /> Support / Gathering Behind ({unassigned.length})
        </p>
        {unassigned.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map(m => (
              <span key={m.id} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                {m.tag ? <span className="text-amber-400">[{m.tag}] </span> : ''}{m.player_name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Everyone is positioned on the map.</p>
        )}
      </div>
    </div>
  )
}

function LegendDot({ color, label, outline }: { color: string; label: string; outline?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm" style={outline ? { border: `1.5px solid ${color}` } : { background: color }} />
      {label}
    </span>
  )
}
