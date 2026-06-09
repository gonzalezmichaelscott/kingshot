// @ts-nocheck
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, X, ExternalLink, Check, Loader2 } from 'lucide-react'
import { formatPower } from '@/lib/utils'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { CopyTokenButton } from '@/components/members/CopyTokenButton'
import { RemoveMemberButton } from '@/components/members/RemoveMemberButton'

// A blank player_name must never make a row unreachable — show a clear amber
// italic placeholder, but keep the value clickable.
function displayName(name?: string | null) {
  return (name || '').trim() || null
}

interface Props {
  allianceId: string
  allianceName: string
  canManage: boolean
  isAdmin: boolean
  // Active KVK Castle Battle event id for this alliance, or null when none is
  // active — when set (and the viewer can manage), the table shows a KVK column.
  kvkEventId?: string | null
  initialMembers: any[]
}

export function MembersTable({ allianceId, allianceName, canManage, isAdmin, kvkEventId, initialMembers }: Props) {
  const [members, setMembers] = useState<any[]>(initialMembers || [])
  const [editing, setEditing] = useState<any | null>(null)
  const [kvkSaving, setKvkSaving] = useState<Record<string, boolean>>({})

  const showKvk = !!(canManage && kvkEventId)

  function profileHref(m: any) {
    return `/alliances/${allianceId}/members/${m.id}`
  }

  // Reflect a quick-edit save in the row immediately, no page reload.
  function applyEdit(id: string, patch: any) {
    setMembers(ms => ms.map(m => (m.id === id ? { ...m, ...patch } : m)))
  }

  // Toggle a member's KVK attendance on the active event (optimistic + revert on error).
  async function toggleKvk(m: any) {
    if (!kvkEventId || kvkSaving[m.id]) return
    const next = !m.kvkAttending
    setKvkSaving(s => ({ ...s, [m.id]: true }))
    applyEdit(m.id, { kvkAttending: next })
    try {
      const res = await fetch('/api/kvk/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: kvkEventId,
          member_id: m.id,
          status: next ? 'attending' : 'not_attending',
        }),
      })
      if (!res.ok) applyEdit(m.id, { kvkAttending: !next }) // revert
    } catch {
      applyEdit(m.id, { kvkAttending: !next }) // revert
    } finally {
      setKvkSaving(s => {
        const c = { ...s }
        delete c[m.id]
        return c
      })
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="table-scroll">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-2 pr-4">Player</th>
                <th className="text-right py-2 pr-4">Power</th>
                <th className="text-right py-2 pr-4">Troops</th>
                <th className="text-right py-2 pr-4">March</th>
                <th className="text-right py-2 pr-4">Rally Cap</th>
                {showKvk && <th className="py-2 text-center">KVK</th>}
                {canManage && <th className="py-2 text-center">Quick Edit</th>}
                {canManage && <th className="py-2 text-center">Link</th>}
                {canManage && <th className="py-2 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const name = displayName(m.player_name)
                const href = profileHref(m)
                return (
                  <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/50">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        {/* Avatar is itself a link to the profile */}
                        <Link href={href} className="shrink-0" title="View profile">
                          <PlayerAvatar
                            gameId={m.game_id}
                            avatarUrl={m.avatarUrl}
                            memberId={m.id}
                            playerName={name || 'Unknown Player'}
                            sizeClass="w-7 h-7"
                          />
                        </Link>
                        {name ? (
                          <Link href={href} className="text-amber-400 hover:text-amber-300 font-medium">
                            {name}
                          </Link>
                        ) : (
                          // Blank name → still clickable, shown as an italic placeholder.
                          <Link href={href} className="text-amber-400/80 italic hover:text-amber-300 font-medium">
                            Unknown Player
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-2 pr-4 text-slate-300">{formatPower(m.power)}</td>
                    <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.troop_count)}</td>
                    <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.march_size)}</td>
                    <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.rally_capacity)}</td>
                    {showKvk && (
                      <td className="py-2 text-center">
                        <button
                          onClick={() => toggleKvk(m)}
                          disabled={!!kvkSaving[m.id]}
                          title={m.kvkAttending ? 'Attending KVK — click to mark not attending' : 'Not attending KVK — click to mark attending'}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors disabled:opacity-60 ${
                            m.kvkAttending
                              ? 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                              : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-700/60'
                          }`}
                        >
                          {kvkSaving[m.id] ? <Loader2 size={14} className="animate-spin" /> : m.kvkAttending ? <Check size={14} /> : null}
                        </button>
                      </td>
                    )}
                    {canManage && (
                      <td className="py-2 text-center">
                        <button
                          onClick={() => setEditing(m)}
                          title="Quick edit stats"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-700/60 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    )}
                    {canManage && (
                      <td className="py-2 text-center">
                        <CopyTokenButton token={m.access_token} />
                      </td>
                    )}
                    {canManage && (
                      <td className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <RemoveMemberButton
                            memberId={m.id}
                            playerName={name || 'Unknown Player'}
                            allianceName={allianceName}
                            mode="remove"
                          />
                          {isAdmin && (
                            <RemoveMemberButton
                              memberId={m.id}
                              playerName={name || 'Unknown Player'}
                              allianceName={allianceName}
                              mode="delete"
                            />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {members.length === 0 && (
            <p className="text-slate-400 text-sm py-6 text-center">No members yet. Add members to get started.</p>
          )}
        </div>
      </CardContent>

      {editing && (
        <QuickEditModal
          member={editing}
          href={profileHref(editing)}
          onClose={() => setEditing(null)}
          onSaved={(patch) => {
            applyEdit(editing.id, patch)
            setEditing(null)
          }}
        />
      )}
    </Card>
  )
}

function QuickEditModal({ member, href, onClose, onSaved }: any) {
  const name = displayName(member.player_name)
  const [power, setPower] = useState<string>(member.power ? String(member.power) : '')
  const [marchSize, setMarchSize] = useState<string>(member.march_size ? String(member.march_size) : '')
  const [rallyCapacity, setRallyCapacity] = useState<string>(member.rally_capacity ? String(member.rally_capacity) : '')
  const [tgLevel, setTgLevel] = useState<string>(member.tgLevel != null ? String(member.tgLevel) : '0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const powerNum = parseInt(power) || 0
    const marchNum = parseInt(marchSize) || 0
    const rallyNum = parseInt(rallyCapacity) || 0
    const tgNum = Math.max(0, Math.min(8, parseInt(tgLevel) || 0))

    try {
      // Power / march / rally via the existing member stats route.
      const res = await fetch('/api/member/stats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: member.access_token,
          power: powerNum,
          march_size: marchNum,
          rally_capacity: rallyNum,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Save failed — please try again.')
        setSaving(false)
        return
      }

      // TrueGold level (global, all troop types) only when it changed. The narrow
      // route merges it into troop_data without clobbering tier counts.
      if (tgNum !== (member.tgLevel ?? 0)) {
        const r2 = await fetch('/api/member/tg-level', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: member.access_token, tg_level: tgNum }),
        })
        if (!r2.ok) {
          const d = await r2.json().catch(() => ({}))
          setError(d.error || 'Stats saved, but the TrueGold level could not be updated.')
          setSaving(false)
          return
        }
      }

      onSaved({
        power: powerNum,
        march_size: marchNum,
        rally_capacity: rallyNum,
        tgLevel: tgNum,
      })
    } catch {
      setError('Network error — please check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header: avatar + name */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar
              gameId={member.game_id}
              avatarUrl={member.avatarUrl}
              memberId={member.id}
              playerName={name || 'Unknown Player'}
              sizeClass="w-9 h-9"
            />
            <div className="min-w-0">
              <p className={`font-semibold truncate ${name ? 'text-slate-100' : 'text-amber-400/80 italic'}`}>
                {name || 'Unknown Player'}
              </p>
              <p className="text-xs text-slate-500">Quick edit</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {[
            { label: 'Power', value: power, set: setPower },
            { label: 'March Size', value: marchSize, set: setMarchSize },
            { label: 'Rally Capacity', value: rallyCapacity, set: setRallyCapacity },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="text-xs text-slate-400 block mb-1">{label}</label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={value}
                onChange={e => set(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-slate-400 block mb-1">TrueGold Level</label>
            <Input
              type="number"
              min={0}
              max={8}
              value={tgLevel}
              onChange={e => {
                const v = e.target.value
                if (v === '') { setTgLevel(''); return }
                setTgLevel(String(Math.max(0, Math.min(8, parseInt(v) || 0))))
              }}
            />
            <p className="text-[11px] text-slate-500 mt-1">Applies globally to all troop types (0–8).</p>
          </div>

          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
          >
            <ExternalLink size={12} />
            View Full Profile
          </a>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-800">
          <Button size="sm" onClick={save} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose} disabled={saving} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
