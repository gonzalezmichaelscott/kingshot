// @ts-nocheck
'use client'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, ShieldX, Loader2, AlertTriangle } from 'lucide-react'

interface FlaggedItem {
  messageId: string
  content: string
  deleted: boolean
  authorName: string
  createdAt: string
  reportCount: number
  reasons: string[]
}

function isImageUrl(text: string): boolean {
  if (!text) return false
  try {
    const url = new URL(text.trim())
    return url.pathname.includes('/chat-images/') || /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url.pathname)
  } catch {
    return false
  }
}

export function FlaggedMessagesClient({ initialItems }: { initialItems: FlaggedItem[] }) {
  const [items, setItems] = useState<FlaggedItem[]>(initialItems)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function resolve(messageId: string, action: 'delete' | 'dismiss') {
    setBusy(messageId)
    setError('')
    const res = await fetch('/api/admin/flagged/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, action }),
    })
    setBusy(null)
    if (res.ok) {
      setItems(prev => prev.filter(i => i.messageId !== messageId))
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Action failed')
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-10">No flagged messages — all clear.</p>
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {items.map(item => (
        <Card key={item.messageId} className="border-red-500/30">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-slate-200">{item.authorName}</span>
                <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
                  <AlertTriangle size={11} /> {item.reportCount} report{item.reportCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="border border-slate-700" onClick={() => resolve(item.messageId, 'dismiss')} disabled={busy === item.messageId}>
                  {busy === item.messageId ? <Loader2 size={14} className="mr-1 animate-spin" /> : <ShieldX size={14} className="mr-1" />}
                  Dismiss
                </Button>
                <Button size="sm" onClick={() => resolve(item.messageId, 'delete')} disabled={busy === item.messageId || item.deleted} className="bg-red-600 hover:bg-red-700">
                  <Trash2 size={14} className="mr-1" />
                  Delete message
                </Button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-sm text-slate-200">
              {item.deleted ? (
                <em className="text-slate-500">Message already deleted.</em>
              ) : isImageUrl(item.content) ? (
                <img src={item.content} alt="Reported image" className="max-h-48 rounded-lg" />
              ) : (
                <p className="whitespace-pre-wrap break-words">{item.content}</p>
              )}
            </div>

            {item.reasons.length > 0 && (
              <div className="text-xs text-slate-400">
                <span className="text-slate-500">Reasons: </span>
                {item.reasons.join(' · ')}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
