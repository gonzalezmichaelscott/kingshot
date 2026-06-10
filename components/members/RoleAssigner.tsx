// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'
import { canChangeRole, roleLabel } from '@/lib/access'

interface Props {
  memberId: string
  linkedUserId: string | null
  currentRole: string | null
  /** The acting user's role (drives promotion/demotion permissions). */
  actorRole: string | null
  /** The acting user's id — enables voluntary self step-down on own record. */
  actorUserId?: string | null
}

const STANDARD_ROLES = ['r1', 'r2', 'r3', 'r4', 'r5']
const NO_PERMISSION = "You don't have permission to assign this role"

export function RoleAssigner({ memberId, linkedUserId, currentRole, actorRole, actorUserId }: Props) {
  const router = useRouter()

  // Acting user editing their own record: step-down allowed, promotion never.
  const isSelf = !!linkedUserId && !!actorUserId && linkedUserId === actorUserId

  // All roles to surface, including the member's current role if it's outside the
  // standard set (e.g. system_admin) so it shows as the disabled current value.
  const options = Array.from(new Set([...(currentRole ? [currentRole] : []), ...STANDARD_ROLES]))

  // Default to the first role the actor is actually allowed to assign.
  const firstAssignable = STANDARD_ROLES.find(r => r !== currentRole && canChangeRole(actorRole, currentRole, r, isSelf))
  const [role, setRole] = useState(firstAssignable || currentRole || 'r3')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  function isDisabled(r: string) {
    if (r === currentRole) return true // can't "assign" the current role
    return !canChangeRole(actorRole, currentRole, r, isSelf)
  }

  async function save() {
    setSaving(true); setError(''); setMsg('')
    const res = await fetch('/api/member/role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, new_role: role }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed'); return }
    setMsg('In-game rank updated ✓')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck size={16} className="text-amber-500" />
          In-Game Rank
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!linkedUserId && (
          <p className="text-xs text-slate-500 mb-3">
            Unclaimed profile — the rank is stored now and inherited when the member claims their profile.
          </p>
        )}
        {isSelf && (
          <p className="text-xs text-slate-500 mb-3">
            This is your own profile — you can step down to a lower rank, but not promote yourself.
          </p>
        )}
        <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Assign in-game rank</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {options.map(r => {
                  const disabled = isDisabled(r)
                  return (
                    <option
                      key={r}
                      value={r}
                      disabled={disabled}
                      title={disabled && r !== currentRole ? NO_PERMISSION : undefined}
                    >
                      {roleLabel(r)}{r === currentRole ? ' (current)' : ''}
                      {disabled && r !== currentRole ? ' — no permission' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            <Button size="sm" onClick={save} disabled={saving || role === currentRole || isDisabled(role)}>
              {saving ? 'Saving…' : 'Update Rank'}
            </Button>
            {msg && <span className="text-green-400 text-sm">{msg}</span>}
            {error && <span className="text-red-400 text-sm">{error}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
