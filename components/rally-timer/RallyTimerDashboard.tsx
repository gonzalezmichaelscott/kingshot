'use client'
import { useState } from 'react'
import { Timer, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RallyTimerSession } from './RallyTimerSession'

interface Props {
  allianceId: string | null
  userId: string
  canEdit: boolean
  initialSessions: any[]
}

const DEFAULT_LABELS = ['Castle', 'North Turret', 'East Turret', 'South Turret', 'West Turret']

export function RallyTimerDashboard({ allianceId, userId, canEdit, initialSessions }: Props) {
  const [sessions, setSessions] = useState<any[]>(
    initialSessions.length > 0
      ? initialSessions
      // Leaders start empty and create a PERSISTED session (which has a shareable
      // link). Non-leaders / no-alliance get a local-only placeholder.
      : (canEdit && allianceId)
        ? []
        : [{ id: null, label: 'Castle', players: [], status: 'idle', started_at: null, _local: true }]
  )
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  async function addSession() {
    if (sessions.length >= 5) return
    if (!canEdit || !allianceId) {
      // Local-only session for non-leaders
      setSessions(prev => [...prev, {
        id: null,
        label: DEFAULT_LABELS[prev.length] || `Rally ${prev.length + 1}`,
        players: [],
        status: 'idle',
        started_at: null,
        _local: true,
      }])
      return
    }
    setCreating(true)
    const res = await fetch('/api/rally-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: DEFAULT_LABELS[sessions.length] || `Rally ${sessions.length + 1}` }),
    })
    const { session } = await res.json()
    setSessions(prev => [...prev, session])
    setCreating(false)
  }

  async function removeSession(idx: number) {
    const s = sessions[idx]
    setDeleting(true)
    try {
      if (s.id && canEdit) {
        // Tell anyone currently watching the shared link the timer is gone, then delete.
        try {
          const channel = supabase.channel(`rally-timer:${s.id}`)
          await channel.subscribe()
          await channel.send({ type: 'broadcast', event: 'session_deleted', payload: {} })
          supabase.removeChannel(channel)
        } catch { /* best-effort broadcast */ }
        await fetch(`/api/rally-timer?id=${s.id}`, { method: 'DELETE' })
      }
      setSessions(prev => prev.filter((_, i) => i !== idx))
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  function updateSession(idx: number, updated: any) {
    setSessions(prev => prev.map((s, i) => i === idx ? { ...s, ...updated } : s))
  }

  return (
    <div className="min-h-screen bg-slate-950 p-3 sm:p-4 max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Timer className="text-amber-500 flex-shrink-0" size={26} />
            <h1 className="text-xl sm:text-2xl font-bold">Rally Timer</h1>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full ml-1 whitespace-nowrap">
              {sessions.length}/5 targets
            </span>
          </div>
          {sessions.length < 5 && (
            <button
              onClick={addSession}
              disabled={creating}
              className="flex items-center justify-center gap-2 px-4 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
              Add Target
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500">
          BASE player opens their rally FIRST. Timer counts up. When elapsed time = time difference between march times, that player launches. All troops arrive simultaneously.
          {allianceId && ' Share individual session links so your team can see the live timer.'}
        </p>

        {/* Empty state — leaders create their first persisted (shareable) timer */}
        {sessions.length === 0 && (
          <div className="border border-dashed border-slate-700 rounded-xl p-8 text-center">
            <Timer className="mx-auto text-slate-600 mb-3" size={32} />
            <p className="text-slate-400 text-sm mb-4">No rally timers yet. Create one to get a shareable link for your squad.</p>
            <button
              onClick={addSession}
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
              Create Rally Timer
            </button>
          </div>
        )}

        {/* Sessions grid — single column on mobile, side by side on larger screens */}
        <div className={`grid grid-cols-1 gap-4 ${sessions.length > 1 ? 'lg:grid-cols-2 xl:grid-cols-3' : ''}`}>
          {sessions.map((session, idx) => (
            <div key={session.id || idx} className="relative min-w-0">
              {/* Delete session — R4/R5/system_admin only (canEdit). Local-only
                  placeholder sessions (no id) can always be removed from the view. */}
              {(canEdit || !session.id) && (
                <button
                  onClick={() => session.id ? setConfirmDelete(idx) : removeSession(idx)}
                  className="absolute top-2 right-2 z-10 bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-lg shadow"
                  title="Delete this timer session"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <RallyTimerSession
                session={session}
                canEdit={canEdit}
                allianceId={allianceId}
                onUpdate={(updated) => updateSession(idx, updated)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Trash2 size={18} className="text-red-500" />
              <h3 className="font-bold text-lg">Delete timer session</h3>
            </div>
            <p className="text-sm text-slate-400">
              Delete this timer session? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => removeSession(confirmDelete)}
                disabled={deleting}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
