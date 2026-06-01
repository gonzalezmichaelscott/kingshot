// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, Globe, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Props {
  allianceId: string
  allianceName: string
  initialMessages: any[]
  currentUser: any
}

export function ChatRoom({ allianceId, allianceName, initialMessages, currentUser }: Props) {
  const [messages, setMessages] = useState<any[]>(initialMessages)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [translating, setTranslating] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Stable client reference — avoids creating multiple GoTrue clients across renders
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const canDelete = ['r5', 'r4', 'system_admin'].includes(currentUser?.role || '')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${allianceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `alliance_id=eq.${allianceId}` },
        async (payload) => {
          // Fetch with user profile
          const { data } = await supabase
            .from('chat_messages')
            .select('*, user_profiles(display_name, role)')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages(prev => [...prev, data])
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
      author_id: currentUser?.id,
      content: content.trim(),
    })
    setContent('')
    setSending(false)
  }

  async function translate(messageId: string, text: string) {
    setTranslating(messageId)
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_KEY
      if (!apiKey) { setTranslating(null); return }
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: navigator.language.split('-')[0] }),
      })
      const data = await res.json()
      const translated = data.data?.translations?.[0]?.translatedText
      if (translated) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, _translated: translated } : m
        ))
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
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
        <MessageSquare className="text-amber-500" size={20} />
        <h1 className="font-bold">{allianceName} — Chat</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.map(msg => {
          const author = msg.user_profiles
          const isOwn = msg.author_id === currentUser?.id
          return (
            <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {!isOwn && (
                  <span className="text-xs text-slate-400 px-1">
                    {author?.display_name || 'Unknown'}
                    {author?.role && <Badge className="ml-1" variant="default">{author.role}</Badge>}
                  </span>
                )}
                <div className={`rounded-2xl px-4 py-2 text-sm ${isOwn ? 'bg-amber-500 text-slate-900 rounded-tr-sm' : 'bg-slate-800 text-slate-100 rounded-tl-sm'}`}>
                  {msg.content}
                  {msg._translated && (
                    <p className="text-xs mt-1 opacity-70 italic">{msg._translated}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-slate-500">{formatTime(msg.created_at)}</span>
                  {!isOwn && (
                    <button
                      onClick={() => translate(msg.id, msg.content)}
                      className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-0.5"
                      disabled={translating === msg.id}
                    >
                      <Globe size={10} />
                      {translating === msg.id ? '...' : 'Translate'}
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => deleteMessage(msg.id)} className="text-xs text-red-500/50 hover:text-red-400">
                      <Trash2 size={10} />
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
      <form onSubmit={sendMessage} className="flex gap-2 pt-4 border-t border-slate-800">
        <input
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 h-11 bg-slate-800 border border-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="w-11 h-11 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <Send size={18} className="text-slate-900" />
        </button>
      </form>
    </div>
  )
}
