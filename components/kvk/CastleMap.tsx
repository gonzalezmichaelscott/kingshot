// @ts-nocheck
'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CITY_SLOTS, SLOT_BY_ID, TURRETS,
  CASTLE_POINTS, OUTER_POINTS, CASTLE_CENTER,
  SLOT_SIZE, TURRET_SIZE, MAP_VIEWBOX,
} from '@/lib/castle-map'
import { Loader2, Users } from 'lucide-react'

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
function trunc(name: string, n = 8): string {
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

const pts = (...p: { x: number; y: number }[]) => p.map(q => `${q.x},${q.y}`).join(' ')

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
  const half = SLOT_SIZE / 2
  const tHalf = TURRET_SIZE / 2

  // Popup box geometry (authored in viewBox units, counter-rotated to read upright).
  const POP_W = 280
  const POP_H = 168

  return (
    <div className="space-y-4">
      {/* The diamond map */}
      <div className="relative w-full max-w-[460px] mx-auto aspect-square">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox={`0 0 ${MAP_VIEWBOX} ${MAP_VIEWBOX}`}
            className="w-full h-full overflow-visible"
            style={{ transform: 'rotate(45deg) scale(0.68)' }}
          >
            <defs>
              <pattern id="cm-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M28 0 L0 0 L0 28" fill="none" stroke="#9bd5a0" strokeWidth="1" opacity="0.15" />
              </pattern>
              <clipPath id="cm-clip">
                <polygon points={pts(OUTER_POINTS.top, OUTER_POINTS.right, OUTER_POINTS.bottom, OUTER_POINTS.left)} />
              </clipPath>
            </defs>

            {/* Dark-green diamond play area + subtle grid texture (clipped to boundary) */}
            <g clipPath="url(#cm-clip)">
              <rect x="0" y="0" width={MAP_VIEWBOX} height={MAP_VIEWBOX} fill="#1a3a1a" />
              <rect x="0" y="0" width={MAP_VIEWBOX} height={MAP_VIEWBOX} fill="url(#cm-grid)" />
            </g>

            {/* Click-away backdrop (clears selection) */}
            {selected && (
              <polygon
                points={pts(OUTER_POINTS.top, OUTER_POINTS.right, OUTER_POINTS.bottom, OUTER_POINTS.left)}
                fill="transparent" onClick={() => { setSelected(null); setPendingMember('') }}
              />
            )}

            {/* Outer battle boundary (dashed diamond) */}
            <polygon
              points={pts(OUTER_POINTS.top, OUTER_POINTS.right, OUTER_POINTS.bottom, OUTER_POINTS.left)}
              fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="10 8"
            />

            {/* King's Castle — orange/brown diamond with "K" */}
            <polygon
              points={pts(CASTLE_POINTS.top, CASTLE_POINTS.right, CASTLE_POINTS.bottom, CASTLE_POINTS.left)}
              fill="#b45309" stroke="#f59e0b" strokeWidth="3"
            />
            <g transform={`rotate(-45 ${CASTLE_CENTER} ${CASTLE_CENTER})`}>
              <text x={CASTLE_CENTER} y={CASTLE_CENTER - 2} textAnchor="middle" fontSize="34" fontWeight="bold" fill="#fff7ed">K</text>
              <text x={CASTLE_CENTER} y={CASTLE_CENTER + 22} textAnchor="middle" fontSize="13" fill="#fde68a">King&apos;s Castle</text>
            </g>

            {/* City slots */}
            {CITY_SLOTS.map(slot => {
              const memberId = bySlot[slot.id]
              const m = memberId ? memberById[memberId] : null
              const cat = m ? roleCategory(roleByMember[memberId]) : null
              const stroke = cat ? CAT_COLORS[cat] : '#3f6b46'
              const fill = m ? colorForTag(m.tag) + '55' : 'rgba(15,40,20,0.55)'
              const isLeaderCat = cat === 'castle1' || cat === 'castle2' || cat === 'turretLeader'
              return (
                <g key={slot.id} onClick={(e) => { if (canManage) { e.stopPropagation(); setSelected(slot.id); setPendingMember('') } }} style={{ cursor: canManage ? 'pointer' : 'default' }}>
                  <rect
                    x={slot.x - half} y={slot.y - half} width={SLOT_SIZE} height={SLOT_SIZE} rx="6"
                    fill={fill} stroke={stroke} strokeWidth={isLeaderCat ? 3 : 1.5}
                    opacity={selected === slot.id ? 1 : 0.96}
                  />
                  <g transform={`rotate(-45 ${slot.x} ${slot.y})`}>
                    {m ? (
                      <>
                        <circle cx={slot.x} cy={slot.y - 8} r="9" fill={colorForTag(m.tag)} />
                        <text x={slot.x} y={slot.y - 4.5} textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#fff">{initials(m.player_name)}</text>
                        {m.tag && <text x={slot.x} y={slot.y + 8} textAnchor="middle" fontSize="7.5" fill="#fcd34d">[{trunc(m.tag, 4)}]</text>}
                        <text x={slot.x} y={slot.y + 18} textAnchor="middle" fontSize="8" fill="#e2e8f0">{trunc(m.player_name)}</text>
                      </>
                    ) : (
                      <text x={slot.x} y={slot.y + 7} textAnchor="middle" fontSize="22" fill="#3f6b46">+</text>
                    )}
                  </g>
                </g>
              )
            })}

            {/* Turrets — purple squares with "T" sitting on the four castle corner tips */}
            {TURRETS.map(t => (
              <g key={t.side} style={{ pointerEvents: 'none' }}>
                <rect x={t.x - tHalf} y={t.y - tHalf} width={TURRET_SIZE} height={TURRET_SIZE} rx="4" fill="#7c3aed" stroke="#a855f7" strokeWidth="2" />
                <g transform={`rotate(-45 ${t.x} ${t.y})`}>
                  <text x={t.x} y={t.y - 1} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#fff">T</text>
                  <text x={t.x} y={t.y + 9} textAnchor="middle" fontSize="7" fill="#ddd6fe">{t.label}</text>
                </g>
              </g>
            ))}

            {/* Slot editor popup — counter-rotated −45° so it reads upright, anchored
                above the selected slot. */}
            {canManage && selected && selectedSlot && (
              <g transform={`rotate(-45 ${selectedSlot.x} ${selectedSlot.y})`}>
                <foreignObject
                  x={selectedSlot.x - POP_W / 2}
                  y={selectedSlot.y - half - 12 - POP_H}
                  width={POP_W}
                  height={POP_H}
                  style={{ overflow: 'visible' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    style={{
                      background: 'rgba(15,23,42,0.97)', border: '2px solid rgba(245,158,11,0.6)',
                      borderRadius: 14, padding: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                      fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>
                        {SIDE_NAMES[selectedSlot.side]} · {selectedSlot.row === 1 ? 'front line' : 'rear'} · C{selectedSlot.col}
                      </span>
                      <button onClick={() => { setSelected(null); setPendingMember('') }}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>

                    {selectedMember && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 15 }}>
                          {selectedMember.tag ? <span style={{ color: '#fbbf24', fontSize: 13 }}>[{selectedMember.tag}] </span> : ''}{selectedMember.player_name}
                        </span>
                        <button onClick={() => removeFromSlot(selected)} disabled={busy}
                          style={{ fontSize: 13, background: '#dc2626', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                          {busy ? '…' : 'Remove'}
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={pendingMember} onChange={e => setPendingMember(e.target.value)}
                        style={{ flex: 1, minWidth: 0, height: 36, padding: '0 8px', background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, fontSize: 14 }}>
                        <option value="">{selectedMember ? 'Reassign to…' : 'Assign a member…'}</option>
                        {unassigned.map(p => (
                          <option key={p.id} value={p.id}>{p.tag ? `[${p.tag}] ` : ''}{p.player_name}</option>
                        ))}
                      </select>
                      <button onClick={() => assignToSlot(selected, pendingMember)} disabled={!pendingMember || busy}
                        style={{ fontSize: 14, fontWeight: 600, background: '#f59e0b', color: '#0f172a', border: 'none', padding: '0 14px', borderRadius: 8, cursor: 'pointer', opacity: (!pendingMember || busy) ? 0.5 : 1 }}>
                        {busy ? '…' : 'Set'}
                      </button>
                    </div>
                  </div>
                </foreignObject>
              </g>
            )}
          </svg>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 text-center -mt-1">
        2 rows × 6 positions per face. Turrets (N/E/S/W) sit at the four castle corner tips. Inner row is front line.
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-xs text-slate-400">
        <LegendDot color={CAT_COLORS.castle1} label="Castle Rally 1 Leader" />
        <LegendDot color={CAT_COLORS.castle2} label="Castle Rally 2 Leader" />
        <LegendDot color={CAT_COLORS.turretLeader} label="Turret Leader" />
        <LegendDot color={CAT_COLORS.joiner} label="Rally Joiner" />
        <LegendDot color={CAT_COLORS.support} label="Support" />
        <LegendDot color="#3f6b46" label="Unassigned" outline />
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
