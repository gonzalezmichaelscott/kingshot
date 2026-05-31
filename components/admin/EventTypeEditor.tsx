// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, ChevronDown, ChevronUp } from 'lucide-react'

interface Props { eventTypes: any[] }

export function EventTypeEditor({ eventTypes: initial }: Props) {
  const [eventTypes, setEventTypes] = useState(initial)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, { rules: string; scoring_weights: string; objectives: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  function toggleExpand(id: string, et: any) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    setEditing(e => ({
      ...e,
      [id]: {
        rules: JSON.stringify(et.rules, null, 2),
        scoring_weights: JSON.stringify(et.scoring_weights, null, 2),
        objectives: JSON.stringify(et.objectives, null, 2),
      }
    }))
  }

  async function save(id: string) {
    const ed = editing[id]
    if (!ed) return

    try {
      const rules = JSON.parse(ed.rules)
      const scoring_weights = JSON.parse(ed.scoring_weights)
      const objectives = JSON.parse(ed.objectives)

      setSaving(id)
      await supabase.from('event_types').update({ rules, scoring_weights, objectives }).eq('id', id)
      setEventTypes(ets => ets.map(et => et.id === id ? { ...et, rules, scoring_weights, objectives } : et))
      setSaving(null)
      setErrors(e => ({ ...e, [id]: '' }))
    } catch (err: any) {
      setErrors(e => ({ ...e, [id]: 'Invalid JSON: ' + err.message }))
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      {eventTypes.map(et => (
        <Card key={et.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                {et.name}
                <Badge variant={et.is_active ? 'green' : 'default'}>{et.is_active ? 'Active' : 'Inactive'}</Badge>
              </CardTitle>
              <button onClick={() => toggleExpand(et.id, et)} className="text-slate-400 hover:text-slate-200">
                {expanded === et.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            <p className="text-xs text-slate-500">{et.slug}</p>
          </CardHeader>

          {expanded === et.id && editing[et.id] && (
            <CardContent className="space-y-4">
              {[
                { label: 'Rules (JSON)', key: 'rules' as const },
                { label: 'Scoring Weights (JSON)', key: 'scoring_weights' as const },
                { label: 'Objectives (JSON)', key: 'objectives' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-sm text-slate-400 block mb-1">{label}</label>
                  <textarea
                    value={editing[et.id]?.[key] || ''}
                    onChange={e => setEditing(ed => ({ ...ed, [et.id]: { ...ed[et.id], [key]: e.target.value } }))}
                    rows={8}
                    spellCheck={false}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-green-400 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                  />
                </div>
              ))}

              {errors[et.id] && <p className="text-red-400 text-sm">{errors[et.id]}</p>}

              <Button onClick={() => save(et.id)} disabled={saving === et.id} size="sm">
                <Save size={14} className="mr-1" />
                {saving === et.id ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}
