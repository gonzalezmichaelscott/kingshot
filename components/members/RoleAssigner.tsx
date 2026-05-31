// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'

interface Props {
  memberId: string
  linkedUserId: string | null
  currentRole: string | null
  assignable: string[]
}

export function RoleAssigner({ memberId, linkedUserId, currentRole, assignable }: Props) {
  const router = useRouter()
  const [role, setRole] = useState(currentRole || assignable[0] || 'r3')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Options: the roles this actor may assign, plus the member's current role (so it shows even if not assignable)
  const options = Array.from(new Set([...(currentRole ? [currentRole] : []), ...assignable]))

  async function save() {
    setSaving(true); setError(''); setMsg('')
    const res = await fetch('/api/member/role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, new_role: role }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed'); return }
    setMsg('Role updated ✓')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck size={16} className="text-amber-500" />
          Role
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!linkedUserId ? (
          <p className="text-sm text-slate-400">
            Member has not created an account yet — role can be assigned once they log in.
          </p>
        ) : (
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Assign role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {options.map(r => (
                  <option key={r} value={r} disabled={r === currentRole && !assignable.includes(r)}>
                    {r === 'system_admin' ? 'System Admin' : r.toUpperCase()}{r === currentRole ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={save} disabled={saving || role === currentRole}>
              {saving ? 'Saving…' : 'Update Role'}
            </Button>
            {msg && <span className="text-green-400 text-sm">{msg}</span>}
            {error && <span className="text-red-400 text-sm">{error}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
