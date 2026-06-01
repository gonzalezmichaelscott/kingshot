// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sword, Send, Trash2, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  kingdomId: string
  currentUserId: string
  currentUserRole: string
  allianceId: string
}

export function KvkChatSection({ kingdomId, currentUserId, currentUserRole, allianceId }: Props) {
  const [messages, setMessages] = useState<any[]>([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [translating, setTranslating] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const canDelete = ['r5', 'r4', 'system_admin'].includes(currentUserRole)
  const hasTranslate = !!(process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_KEY)

  useEffect(() => {
    loadMessages()
  }, [])

  async function loadMessages() {
    // Use chat_messages filtered by a kvk-specific pattern in alliance_id
    // We store KVK messages as alliance_id = kingdom_id (hack using the existing table)
    // The kingdom_id is used as the "alliance_id" for KVK chat to separate namespaces
    const { data } = await supabase
      .from('chat_messages')
      .select('*, user_profiles(display_name, role)')
      .eq('alliance_id', `kvk_${kingdomId}`)
      .order('created_at', { ascending: false })
      .limit(50)
    setMessages((data || []).reverse())
    setInitialized(true)
    setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
  }

  useEffect(() => {
    const channel = supabase
      .channel(`kvkchat:${kingdomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `alliance_id=eq.kvk_${kingdomId}` }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, user_profiles(display_name, role)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages(prev => [...prev, data])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `alliance_id=eq.kvk_${kingdomId}` }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [kingdomId])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    await supabase.from('chat_messages').insert({
      alliance_id: `kvk_${kingdomId}`,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sword size={18} className="text-amber-500" />
          KVK Command Chat
          <Badge variant="amber">Cross-Alliance</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-2">
          {!initialized && <p className="text-center text-slate-500 text-sm pt-8">Loading…</p>}
          {initialized && messages.length === 0 && (
            <p className="text-center text-slate-500 text-sm pt-8">KVK chat is empty. Be the first to send a message!</p>
          )}
          {messages.map(msg => {
            const author = msg.user_profiles
            const isOwn = msg.author_id === currentUserId
            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[80%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <span className="text-[10px] text-slate-400 px-1">
                      {author?.display_name || 'Unknown'}
                      {author?.role && <Badge className="ml-1 text-[9px] py-0" variant="default">{author.role.toUpperCase()}</Badge>}
                    </span>
                  )}
                  <div className={`rounded-xl px-3 py-1.5 text-sm ${isOwn ? 'bg-amber-500 text-slate-900 rounded-tr-sm' : 'bg-slate-800 rounded-tl-sm'}`}>
                    {msg.content}
                    {msg._translated && <p className="text-xs mt-1 opacity-70 italic">{msg._translated}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[10px] text-slate-500">{formatTime(msg.created_at)}</span>
                    {!isOwn && hasTranslate && (
                      <button onClick={() => translate(msg.id, msg.content)} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5" disabled={translating === msg.id}>
                        <Globe size={9} />{translating === msg.id ? '…' : 'TR'}
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
        <form onSubmit={sendMessage} className="flex gap-2 p-4 border-t border-slate-800">
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any) } }}
            placeholder="KVK command message…"
            className="flex-1 px-4 h-10 bg-slate-800 border border-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="w-10 h-10 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <Send size={16} className="text-slate-900" />
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
