// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, Globe, Trash2, X, Image as ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Props {
  allianceId: string
  allianceName: string
  currentUserId: string
  currentUserRole: string
  open: boolean
  onClose: () => void
}

export function ChatPanel({ allianceId, allianceName, currentUserId, currentUserRole, open, onClose }: Props) {
  const [messages, setMessages] = useState<any[]>([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [translating, setTranslating] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const canDelete = ['r5', 'r4', 'system_admin'].includes(currentUserRole || '')
  const hasTranslate = typeof window !== 'undefined' && !!(process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_KEY)

  // Load initial messages when panel opens
  useEffect(() => {
    if (!open || initialized) return
    loadMessages()
  }, [open])

  async function loadMessages(before?: string) {
    if (before) setLoadingMore(true)
    let q = supabase
      .from('chat_messages')
      .select('*, user_profiles(display_name, role)')
      .eq('alliance_id', allianceId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (before) q = q.lt('created_at', before)
    const { data } = await q
    const msgs = (data || []).reverse()
    if (before) {
      setMessages(prev => [...msgs, ...prev])
      setHasMore(msgs.length >= 50)
    } else {
      setMessages(msgs)
      setHasMore(msgs.length >= 50)
      setInitialized(true)
    }
    if (before) setLoadingMore(false)
  }

  // Scroll to bottom on first load
  useEffect(() => {
    if (initialized && open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [initialized, open])

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      const list = listRef.current
      if (list && list.scrollTop > list.scrollHeight - list.clientHeight - 200) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    if (!allianceId) return
    const channel = supabase
      .channel(`chatpanel:${allianceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `alliance_id=eq.${allianceId}` },
        async (payload) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('*, user_profiles(display_name, role)')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages(prev => [...prev, data])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `alliance_id=eq.${allianceId}` },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [allianceId])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    await supabase.from('chat_messages').insert({
      alliance_id: allianceId,
      author_id: currentUserId,
      content: content.trim(),
    })
    setContent('')
    setSending(false)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function translate(messageId: string, text: string) {
    setTranslating(messageId)
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_KEY
      if (!apiKey) return
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: navigator.language.split('-')[0] }),
      })
      const data = await res.json()
      const translated = data.data?.translations?.[0]?.translatedText
      if (translated) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, _translated: translated } : m))
      }
    } finally {
      setTranslating(null)
    }
  }

  async function deleteMessage(messageId: string) {
    await supabase.from('chat_messages').delete().eq('id', messageId)
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }

  function formatTime(ts: string) {
    const d = new Date(ts)
    return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`
  }

  async function handleScrollTop() {
    if (!hasMore || loadingMore || messages.length === 0) return
    const oldest = messages[0]?.created_at
    if (oldest) await loadMessages(oldest)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div className={`fixed right-0 top-0 h-full w-80 max-w-full bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-slate-800 flex-shrink-0 bg-slate-900">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-amber-500" />
            <span className="font-semibold text-sm truncate">{allianceName} Chat</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto py-3 px-3 space-y-2"
          onScroll={(e) => {
            if ((e.target as HTMLDivElement).scrollTop < 60) handleScrollTop()
          }}
        >
          {loadingMore && (
            <p className="text-center text-xs text-slate-500 py-2">Loading more…</p>
          )}
          {messages.length === 0 && initialized && (
            <p className="text-center text-xs text-slate-500 py-8">No messages yet. Say hello!</p>
          )}
          {messages.map(msg => {
            const author = msg.user_profiles
            const isOwn = msg.author_id === currentUserId
            return (
              <div key={msg.id} className={`flex gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[85%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <span className="text-[10px] text-slate-400 px-1">
                      {author?.display_name || 'Unknown'}
                      {author?.role && <Badge className="ml-1 text-[9px] py-0" variant="default">{author.role.toUpperCase()}</Badge>}
                    </span>
                  )}
                  <div className={`rounded-xl px-3 py-1.5 text-sm leading-snug ${isOwn ? 'bg-amber-500 text-slate-900 rounded-tr-sm' : 'bg-slate-800 text-slate-100 rounded-tl-sm'}`}>
                    {msg.content}
                    {msg._translated && (
                      <p className="text-xs mt-1 opacity-70 italic">{msg._translated}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[10px] text-slate-500">{formatTime(msg.created_at)}</span>
                    {!isOwn && hasTranslate && (
                      <button
                        onClick={() => translate(msg.id, msg.content)}
                        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5"
                        disabled={translating === msg.id}
                      >
                        <Globe size={9} />
                        {translating === msg.id ? '…' : 'TR'}
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteMessage(msg.id)} className="text-[10px] text-red-500/50 hover:text-red-400">
                        <Trash2 size={9} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t border-slate-800 flex-shrink-0">
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any) } }}
            placeholder="Message…"
            className="flex-1 px-3 h-9 bg-slate-800 border border-slate-700 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 min-w-0"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="w-9 h-9 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send size={15} className="text-slate-900" />
          </button>
        </form>
      </div>
    </>
  )
}
