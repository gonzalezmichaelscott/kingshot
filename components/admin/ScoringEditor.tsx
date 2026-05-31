// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Save } from 'lucide-react'

interface Props { eventTypes: any[] }

const WEIGHT_KEYS = ['power', 'march_size', 'rally_capacity', 'troop_count', 'hero_score']

export function ScoringEditor({ eventTypes }: Props) {
  const [selected, setSelected] = useState(eventTypes[0]?.id || '')
  const [weights, setWeights] = useState<Record<string, Record<string, number>>>(() => {
    const et = eventTypes[0]
    return et?.scoring_weights || {}
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  function selectEventType(id: string) {
    setSelected(id)
    const et = eventTypes.find(e => e.id === id)
    setWeights(et?.scoring_weights || {})
  }

  function updateWeight(role: string, key: string, value: number) {
    setWeights(w => ({
      ...w,
      [role]: { ...(w[role] || {}), [key]: value },
    }))
    setSaved(false)
  }

  function getRoleSum(role: string): number {
    return Object.values(weights[role] || {}).reduce((s, v) => s + v, 0)
  }

  async function save() {
    // Validate all role sums ~= 1.0
    for (const role of Object.keys(weights)) {
      const sum = getRoleSum(role)
      if (Math.abs(sum - 1.0) > 0.02) {
        setError(`${role} weights sum to ${sum.toFixed(2)} — must equal 1.0`)
        return
      }
    }
    setError('')
    setSaving(true)
    await supabase.from('event_types').update({ scoring_weights: weights }).eq('id', selected)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const currentEventType = eventTypes.find(e => e.id === selected)
  const roles = Object.keys(weights)

  return (
    <div className="space-y-6">
      {/* Event type picker */}
      <div>
        <label className="text-sm text-slate-400 block mb-1">Event Type</label>
        <select value={selected} onChange={e => selectEventType(e.target.value)}
          className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 max-w-sm">
          {eventTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
        </select>
      </div>

      {roles.map(role => {
        const sum = getRoleSum(role)
        const sumOk = Math.abs(sum - 1.0) <= 0.02

        return (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="capitalize">{role.replace(/_/g, ' ')}</span>
                <span className={`text-sm font-mono ${sumOk ? 'text-green-400' : 'text-red-400'}`}>
                  Sum: {sum.toFixed(2)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {WEIGHT_KEYS.map(key => {
                const val = weights[role]?.[key] ?? 0
                return (
                  <div key={key} className="flex items-center gap-3">
                    <label className="text-sm text-slate-400 w-32 flex-shrink-0 capitalize">{key.replace(/_/g, ' ')}</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={val}
                      onChange={e => updateWeight(role, key, parseFloat(e.target.value))}
                      className="flex-1 accent-amber-500"
                    />
                    <span className="text-sm font-mono text-amber-400 w-10 text-right">{val.toFixed(2)}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <Button onClick={save} disabled={saving} size="lg">
        <Save size={16} className="mr-2" />
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Formula'}
      </Button>
    </div>
  )
}
