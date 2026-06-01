'use client'
import { useState } from 'react'
import { LogOut, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  memberId: string
  allianceName: string
  accessToken?: string
  redirectTo?: string
}

export function LeaveAllianceButton({ memberId, allianceName, accessToken, redirectTo }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function confirm() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/members/${memberId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accessToken ? { access_token: accessToken } : {}),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to leave alliance')
      }
      setOpen(false)
      router.push(redirectTo || '/onboarding')
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 transition-colors font-medium"
      >
        <LogOut size={15} />
        Leave Alliance
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h2 className="font-semibold text-slate-100">Leave {allianceName}?</h2>
                <p className="text-sm text-slate-400 mt-1">You can join a different alliance after leaving.</p>
                <p className="text-xs text-amber-400 mt-2">Your profile stats and heroes will be preserved when you join your next alliance.</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-600/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setOpen(false); setError('') }}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? 'Leaving…' : 'Leave Alliance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
