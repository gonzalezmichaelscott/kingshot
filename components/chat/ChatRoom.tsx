// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, Globe, Trash2, X, Paperclip } from 'lucide-react'
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
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Stable client reference — avoids creating multiple GoTrue clients across renders
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const canDelete = ['r5', 'r4', 'system_admin'].includes(currentUser?.role || '')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription — starts on mount, unsubscribes on unmount
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${allianceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `alliance_id=eq.${allianceId}` },
        async (payload) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('*, user_profiles(display_name, role)')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data])
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

  function showError(msg: string) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 4000)
  }

  function isImageMessage(text: string): boolean {
    if (!text) return false
    try {
      const url = new URL(text.trim())
      return (
        url.pathname.includes('/chat-images/') ||
        /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url.pathname)
      )
    } catch {
      return false
    }
  }

  async function handleImageUpload(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      showError('Only JPG, PNG, GIF, and WebP images are allowed.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('Image must be under 10 MB.')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(filename, file, { contentType: file.type })
    if (error || !data) {
      setUploading(false)
      showError('Failed to upload image. Please try again.')
      return
    }
    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(data.path)
    setUploading(false)
    const { data: inserted } = await supabase.from('chat_messages').insert({
      alliance_id: allianceId,
      author_id: currentUser?.id,
      content: urlData.publicUrl,
    }).select().single()
    if (inserted) {
      setMessages(prev => [...prev, {
        ...inserted,
        user_profiles: { display_name: currentUser?.display_name, role: currentUser?.role },
      }])
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) handleImageUpload(file)
    }
  }

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={22} />
          </button>
        </div>
      )}

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
            const isImage = isImageMessage(msg.content)
            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isOwn && (
                    <span className="text-xs text-slate-400 px-1">
                      {author?.display_name || 'Unknown'}
                      {author?.role && <Badge className="ml-1" variant="default">{author.role}</Badge>}
                    </span>
                  )}
                  <div className={`rounded-2xl text-sm ${isOwn ? 'bg-amber-500 text-slate-900 rounded-tr-sm' : 'bg-slate-800 text-slate-100 rounded-tl-sm'} ${isImage ? 'p-1' : 'px-4 py-2'}`}>
                    {isImage ? (
                      <img
                        src={msg.content}
                        alt="Shared image"
                        className="max-w-[300px] rounded-xl cursor-pointer object-cover hover:opacity-90 transition-opacity"
                        style={{ maxHeight: '240px' }}
                        onClick={() => setLightboxUrl(msg.content)}
                      />
                    ) : (
                      <>
                        {msg.content}
                        {msg._translated && (
                          <p className="text-xs mt-1 opacity-70 italic">{msg._translated}</p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs text-slate-500">{formatTime(msg.created_at)}</span>
                    {!isOwn && !isImage && (
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

        {/* Upload progress */}
        {uploading && (
          <div className="py-2 flex items-center gap-2 text-sm text-amber-400 border-t border-slate-800">
            <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            Uploading image…
          </div>
        )}

        {/* Error toast */}
        {errorMsg && (
          <div className="mb-2 px-4 py-2 bg-red-900/60 text-red-300 text-sm rounded-lg border border-red-800/60">
            {errorMsg}
          </div>
        )}

        {/* Input */}
        <form onSubmit={sendMessage} className="flex gap-2 pt-4 border-t border-slate-800">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            title="Upload image"
            className="w-11 h-11 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Paperclip size={18} className="text-slate-400" />
          </button>
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            onPaste={handlePaste}
            placeholder="Type a message..."
            className="flex-1 px-4 h-11 bg-slate-800 border border-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={sending || uploading || !content.trim()}
            className="w-11 h-11 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send size={18} className="text-slate-900" />
          </button>
        </form>
      </div>
    </>
  )
}
