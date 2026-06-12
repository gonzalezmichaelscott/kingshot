'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sword, Loader2 } from 'lucide-react'

export function BattlePlanButton({ eventId, onSuccess, label, legion, disabled = false }: {
  eventId: string
  onSuccess?: () => void
  label?: string
  /** Swordland: generate only this legion's plan (the other legion is untouched). */
  legion?: 'legion1' | 'legion2'
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/battle-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legion ? { eventId, legion } : { eventId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate plan')
      }
      setSuccess(true)
      onSuccess?.()
      setTimeout(() => window.location.reload(), 1000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={generate} disabled={loading || disabled} size="lg" className="w-full sm:w-auto">
        {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sword size={18} className="mr-2" />}
        {loading ? 'Generating AI Plan...' : success ? 'Plan Generated!' : (label || 'Generate Battle Plan')}
      </Button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
