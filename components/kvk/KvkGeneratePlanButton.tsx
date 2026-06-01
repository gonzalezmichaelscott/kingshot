// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sword, Loader2 } from 'lucide-react'

export function KvkGeneratePlanButton({ kingdomId }: { kingdomId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/kvk/battle-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kingdomId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate plan')
      }
      setSuccess(true)
      setTimeout(() => router.refresh(), 800)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={generate} disabled={loading} size="lg" className="w-full sm:w-auto">
        {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sword size={18} className="mr-2" />}
        {loading ? 'Generating Kingdom Plan...' : success ? 'Plan Generated!' : 'Generate Kingdom Battle Plan'}
      </Button>
      <p className="text-xs text-slate-500">
        Combines every member from all participating alliances and assigns them across the castle, four turrets, and support using the KVK Castle Battle rules.
      </p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
