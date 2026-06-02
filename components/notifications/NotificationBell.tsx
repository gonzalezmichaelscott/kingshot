'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NotificationItem {
  id: string
  messageId: string
  allianceId: string
  allianceName: string
  authorName: string
  preview: string
  createdAt: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.max(1, Math.floor(diff / 1000))
  if (s < 60) return `${s} second${s === 1 ? '' : 's'} ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function setAppBadge(count: number) {
  if (typeof navigator === 'undefined') return
  try {
    if (count > 0 && 'setAppBadge' in navigator) {
      ;(navigator as any).setAppBadge(count)
    } else if ('clearAppBadge' in navigator) {
      ;(navigator as any).clearAppBadge()
    }
  } catch {
    // Badging API not supported / permission denied — ignore
  }
}

interface Props {
  userId: string
  role?: string | null
}

export function NotificationBell({ userId, role }: Props) {
  // R4/R5/system_admin can open the full chat page; R1–R3 use the slide-out panel.
  const isBackend = ['r5', 'r4', 'system_admin'].includes(role || '')
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const count = items.length

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items || [])
      setAppBadge(data.count || 0)
    } catch {
      // ignore
    }
  }, [])

  // Initial load
  useEffect(() => { refresh() }, [refresh])

  // Realtime: RLS only delivers chat_mentions rows belonging to this user, so an
  // unfiltered subscription still only fires for our own mentions.
  useEffect(() => {
    const channel = supabase
      .channel(`mentions:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_mentions' },
        () => { refresh() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, refresh])

  async function markAllRead() {
    setItems([])
    setAppBadge(0)
    await fetch('/api/chat/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }

  async function openNotification(n: NotificationItem) {
    // Optimistically remove + clear, then mark read on the server
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== n.id)
      setAppBadge(next.length)
      return next
    })
    setOpen(false)
    fetch('/api/chat/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: n.id }),
    }).catch(() => {})

    if (isBackend) {
      // Backend roles can access the full chat page; scroll handled there via ?msg=
      router.push(`/alliances/${n.allianceId}/chat?msg=${n.messageId}`)
    } else {
      // Member roles (R1–R3) have no chat page — open the slide-out ChatPanel
      // (rendered by the Sidebar) and scroll to the mentioned message there.
      window.dispatchEvent(
        new CustomEvent('ks:open-chat', {
          detail: { allianceId: n.allianceId, messageId: n.messageId },
        })
      )
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative text-slate-300 hover:text-amber-400 transition-colors p-1"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-[90]" onClick={() => setOpen(false)} />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed right-0 top-0 h-full w-80 max-w-full bg-slate-900 border-l border-slate-800 z-[95] flex flex-col shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-amber-500" />
            <span className="font-semibold text-sm">Notifications</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-100 p-1">
            <X size={18} />
          </button>
        </div>

        {count > 0 && (
          <div className="px-4 py-2 border-b border-slate-800/60 flex justify-end">
            <button onClick={markAllRead} className="text-xs text-amber-400 hover:text-amber-300 font-medium">
              Mark all as read
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {count === 0 ? (
            <p className="text-center text-sm text-slate-500 py-12">No new mentions</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/60 transition-colors"
              >
                <p className="text-sm text-slate-200">
                  <span className="font-semibold text-amber-400">{n.authorName}</span> mentioned you in{' '}
                  <span className="text-slate-300">{n.allianceName}</span> chat
                </p>
                {n.preview && (
                  <p className="text-xs text-slate-400 mt-1 truncate">&ldquo;{n.preview}&rdquo;</p>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-slate-500">{timeAgo(n.createdAt)}</span>
                  <span className="text-[11px] text-amber-500 flex items-center gap-1">
                    <MessageSquare size={11} /> Jump to message
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
