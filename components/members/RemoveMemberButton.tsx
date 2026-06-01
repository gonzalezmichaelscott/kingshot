'use client'
import { useState } from 'react'
import { Trash2, UserMinus, X, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  memberId: string
  playerName: string
  allianceName: string
  mode: 'remove' | 'delete'
  redirectTo?: string
}

export function RemoveMemberButton({ memberId, playerName, allianceName, mode, redirectTo }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmName, setConfirmName] = useState('')
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
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
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
    ? `This will permanently delete ${playerName}'s profile including all stats, heroes, and assignments. This cannot be undone.`
    : `This will remove ${playerName} from the alliance. Their profile stats and heroes will be preserved.`

  const deleteConfirmRequired = mode === 'delete'
  const deleteConfirmValid = !deleteConfirmRequired || confirmName === playerName

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true) }}
        className={`transition-colors p-1 rounded ${
          mode === 'delete'
            ? 'text-red-500/60 hover:text-red-400'
            : 'text-slate-500 hover:text-amber-400'
        }`}
        title={mode === 'delete' ? 'Delete profile permanently' : 'Remove from alliance'}
      >
        {mode === 'delete' ? <Trash2 size={15} /> : <UserMinus size={15} />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h2 className="font-semibold text-slate-100">{title}</h2>
                <p className="text-sm text-slate-400 mt-1">{body}</p>
                {mode === 'remove' && (
                  <p className="text-xs text-amber-400 mt-2">Their stats and heroes are preserved when they join their next alliance.</p>
                )}
              </div>
            </div>

            {deleteConfirmRequired && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Type <span className="font-mono text-slate-200">{playerName}</span> to confirm permanent deletion
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={e => setConfirmName(e.target.value)}
                  placeholder={playerName}
                  className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setOpen(false); setConfirmName('') }}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={loading || !deleteConfirmValid}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing…' : mode === 'delete' ? 'Delete Profile' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
