// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'

export function BlacklistClient({ rows }: { rows: any[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function remove(id: string, email: string) {
    if (!confirm(`Remove ${email} from the blacklist? They will be able to log in again.`)) return
    setBusy(id); setError('')
    try {
      const res = await fetch('/api/admin/blacklist', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Failed to remove'); return }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setBusy(null)
    }
  }

  if (!rows || rows.length === 0) {
    return <Card><CardContent className="py-10 text-center text-slate-400 text-sm">No blacklisted accounts.</CardContent></Card>
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {rows.map(b => (
          <div key={b.id} className="flex items-center justify-between gap-3 flex-wrap bg-slate-800/50 rounded-lg p-3">
            <div className="min-w-0">
              <p className="font-medium break-all">{b.email}</p>
              <p className="text-xs text-slate-400">
                {b.reason} · {new Date(b.created_at).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                {b.byName ? ` · by ${b.byName}` : ''}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="text-red-300 hover:text-red-200" onClick={() => remove(b.id, b.email)} disabled={busy === b.id}>
              {busy === b.id ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Trash2 size={14} className="mr-1" />}
              Remove
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
