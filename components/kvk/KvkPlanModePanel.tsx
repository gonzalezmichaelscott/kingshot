// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sword, Loader2, ArrowLeftRight, Shield } from 'lucide-react'

interface TransferRecommendation {
  player_name: string
  home_alliance: string
  recommended_alliance: string
  rally_leader: string
  strength_improvement: string
}

/**
 * Plan A / Plan B selector for the kingdom KVK battle plan, plus the Plan B
 * "Transfer Recommendations" panel.
 *
 *  - Plan A — Alliance Only: strict same-alliance rule, no cross-alliance joiners.
 *  - Plan B — Optimal: willing-to-move members may be assigned across alliances.
 */
export function KvkPlanModePanel({
  kingdomId,
  canGenerate,
  transferRecommendations = [],
}: {
  kingdomId: string
  canGenerate: boolean
  transferRecommendations?: TransferRecommendation[]
}) {
  const [planMode, setPlanMode] = useState<'A' | 'B'>('A')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function generate() {
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch('/api/kvk/battle-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kingdomId, planMode }),
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

  const options = [
    {
      key: 'A' as const,
      icon: Shield,
      title: 'Plan A — Alliance Only',
      desc: 'Strict same-alliance rule. Joiners only join rally leaders from their own alliance.',
    },
    {
      key: 'B' as const,
      icon: ArrowLeftRight,
      title: 'Plan B — Optimal (includes willing transfers)',
      desc: 'Willing-to-move members may join a stronger rally in another alliance for better coordination.',
    },
  ]

  return (
    <div className="space-y-4">
      {canGenerate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sword size={18} className="text-amber-500" />
              Generate Kingdom Battle Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              {options.map(({ key, icon: Icon, title, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlanMode(key)}
                  className={
                    'text-left rounded-xl border p-3 transition-colors ' +
                    (planMode === key
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600')
                  }
                >
                  <p className="flex items-center gap-1.5 font-semibold text-sm text-slate-100">
                    <Icon size={14} className="text-amber-400" />
                    {title}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
                </button>
              ))}
            </div>
            <Button onClick={generate} disabled={loading} size="lg" className="w-full sm:w-auto">
              {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sword size={18} className="mr-2" />}
              {loading
                ? 'Generating Kingdom Plan...'
                : success
                ? 'Plan Generated!'
                : planMode === 'A'
                ? 'Generate Plan A — Alliance Only'
                : 'Generate Plan B — Optimal with Transfers'}
            </Button>
            <p className="text-xs text-slate-500">
              Combines every attending member across participating alliances and assigns them to the castle,
              four turrets, and support — castle is staffed first with the strongest leaders and joiners.
            </p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Plan B — Transfer Recommendations panel */}
      {transferRecommendations.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight size={18} className="text-amber-400" />
              Transfer Recommendations ({transferRecommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-2 pr-3">Player</th>
                    <th className="text-left py-2 pr-3">Home Alliance</th>
                    <th className="text-left py-2 pr-3">Recommended KVK Alliance</th>
                    <th className="text-left py-2 pr-3">Rally Leader</th>
                    <th className="text-left py-2">Est. Strength Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {transferRecommendations.map((t, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-2 pr-3 font-medium text-slate-200">{t.player_name}</td>
                      <td className="py-2 pr-3 text-slate-400">{t.home_alliance}</td>
                      <td className="py-2 pr-3 text-amber-400">{t.recommended_alliance}</td>
                      <td className="py-2 pr-3 text-slate-300">{t.rally_leader}</td>
                      <td className="py-2 text-green-400">{t.strength_improvement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
