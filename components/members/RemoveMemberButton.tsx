'use client'
import { useState } from 'react'
import { Trash2, X, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  memberId: string
  playerName: string
  allianceName: string
  mode: 'remove' | 'delete'
}

export function RemoveMemberButton({ memberId, playerName, allianceName, mode }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function confirm() {
    setLoading(true)
    setError('')
    try {
      let res: Response
      if (mode === 'delete') {
        res = await fetch(`/api/members/${memberId}/delete`, { method: 'DELETE' })
      } else {
        res = await fetch(`/api/members/${memberId}/remove`, { method: 'POST' })
      }
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed')
      }
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'delete'
    ? `Delete ${playerName}?`
    : `Remove ${playerName} from ${allianceName}?`
  const body = mode === 'delete'
    ? `This will permanently delete ${playerName}'s record including all stats, heroes, and assignments.`
    : `This will not delete their account. Their stats and heroes will be preserved if they join a new alliance.`

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true) }}
        className="text-red-500/60 hover:text-red-400 transition-colors p-1 rounded"
        title={mode === 'delete' ? 'Delete member' : 'Remove from alliance'}
      >
        <Trash2 size={15} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h2 className="font-semibold text-slate-100">{title}</h2>
                <p className="text-sm text-slate-400 mt-1">{body}</p>
                {mode === 'remove' && (
                  <p className="text-xs text-amber-400 mt-2">Their profile stats and heroes will be preserved when they join their next alliance.</p>
                )}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing…' : mode === 'delete' ? 'Delete' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
