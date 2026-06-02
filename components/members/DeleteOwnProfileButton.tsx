// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle } from 'lucide-react'

/**
 * Profile self-deletion for a logged-in member who has claimed their profile.
 * Lives on the member dashboard (NOT the public self-service link page) — the
 * caller only renders it when the profile is linked to the current user.
 */
export function DeleteOwnProfileButton({ accessToken }: { accessToken: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/member/delete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Delete failed')
      }
      router.push('/onboarding')
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Danger Zone</p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-400 border border-red-800/40 hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={14} />
          Delete My Profile
        </button>
      ) : (
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-slate-100 text-sm">Delete My Profile?</p>
              <p className="text-xs text-slate-400 mt-1">
                This will permanently delete your profile and all your data including stats, heroes, and assignments. This cannot be undone.
              </p>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Deleting…' : 'Yes, delete permanently'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
