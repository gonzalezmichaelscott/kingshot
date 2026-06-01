// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RotateCcw, Loader2 } from 'lucide-react'

export function KvkNewCycleButton({ kingdomId }: { kingdomId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  async function start() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/kvk/new-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kingdomId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start new cycle')
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <Button onClick={() => setConfirming(true)} size="md">
        <RotateCcw size={16} className="mr-2" />
        Start New KVK Planning
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-300">
        This archives the completed KVK (kept for records) and opens a fresh registration event for every participating alliance. Attendance is reset.
      </p>
      <div className="flex gap-2">
        <Button onClick={start} disabled={loading} size="md">
          {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
          Confirm — start new cycle
        </Button>
        <Button onClick={() => setConfirming(false)} variant="ghost" size="md" disabled={loading}>Cancel</Button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
