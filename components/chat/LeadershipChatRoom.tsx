// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Globe, Trash2, X, Paperclip, ShieldCheck } from 'lucide-react'
import { useNoSleep } from '@/hooks/useNoSleep'
import { MentionText } from '@/components/chat/MentionText'
import { MentionPopup } from '@/components/chat/MentionPopup'
import { useMentionInput } from '@/hooks/useMentionInput'
import { useChatTranslation } from '@/hooks/useChatTranslation'
import { languageLabel, DEFAULT_LANGUAGE } from '@/lib/languages'
import { resolveWorldIdentity } from '@/lib/world-chat'

interface Props {
  kingdomId: string
  initialMessages: any[]
  currentUserId: string
  currentUserLang?: string
  /** auth user id -> { name, allianceTag } for sender labels + own messages */
  directory: Record<string, { name: string; allianceTag: string; role?: string }>
  /** members-shaped list ({ id, player_name, linked_user_id }) — the kingdom's R4/R5 for @ autocomplete */
  mentionMembers: any[]
  canDelete: boolean
}

// FIX 4 — Leadership Chat: kingdom-level room for R4/R5/system_admin across all
// alliances in a kingdom. Mirrors World Chat (realtime, image upload, @ mentions,
// auto-translate, author/admin delete) but is scoped to one kingdom.
export function LeadershipChatRoom({
  kingdomId,
  initialMessages,
  currentUserId,
  currentUserLang,
  directory,
  mentionMembers,
  canDelete,
}: Props) {
  const [messages, setMessages] = useState<any[]>(initialMessages)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showNewMsg, setShowNewMsg] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const didInitialScrollRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  const channelIdRef = useRef<string>(`leadership-chat:${kingdomId}:${Math.random().toString(36).slice(2)}`)

  // ---- Translation ----
  const preferredLang = currentUserLang || DEFAULT_LANGUAGE
  const tr = useChatTranslation(currentUserId || 'anon', preferredLang)

  // ---- Names + @ mention data ----
  const memberNames = mentionMembers.map((m) => m.player_name)
  const myIdentity = resolveWorldIdentity(currentUserId, directory)
  const viewerName = myIdentity.name

  const mention = useMentionInput(mentionMembers, content, setContent, inputRef)

  useNoSleep(true)

  // Auto-scroll to the newest message on load; afterwards only when near bottom.
  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
    setShowNewMsg(false)
  }

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true
      scrollToBottom('auto')
      return
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (nearBottom) scrollToBottom('smooth')
    else setShowNewMsg(true)
  }, [messages])

  // Realtime subscription — self-heals on CLOSED/TIMED_OUT.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const addMessage = (data: any) => {
      if (!data) return
      if (messagesRef.current.some(m => m.id === data.id)) return
      setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]))
    }

    const subscribe = () => {
      if (cancelled) return
      channel = supabase
        .channel(channelIdRef.current, { config: { broadcast: { self: false } } })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'leadership_chat_messages', filter: `kingdom_id=eq.${kingdomId}` },
          async (payload) => {
            const { data } = await supabase
              .from('leadership_chat_messages')
              .select('*')
              .eq('id', payload.new.id)
              .single()
            addMessage(data)
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'leadership_chat_messages', filter: `kingdom_id=eq.${kingdomId}` },
          (payload) => {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          }
        )
        .subscribe((status, err) => {
          console.log('[LeadershipChatRoom] Realtime status:', status, err ?? '')
          if ((status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') && !cancelled) {
            if (reconnectTimer) clearTimeout(reconnectTimer)
            reconnectTimer = setTimeout(() => {
              if (cancelled) return
              if (channel) supabase.removeChannel(channel)
              subscribe()
            }, 2000)
          }
        })
    }

    subscribe()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [kingdomId])

  // Parse @mentions server-side so any mentioned leader gets a notification.
  async function processMentions(messageId: string) {
    try {
      await fetch('/api/leadership-chat/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
    } catch {
      // Non-fatal: the message still sends even if mention parsing fails
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    const text = content.trim()
    setContent('')
    mention.close()
    const res = await fetch('/api/leadership-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, kingdomId }),
    })
    setSending(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      showError(d.error || 'Failed to send message.')
      setContent(text)
      return
    }
    const { message: inserted } = await res.json()
    if (inserted) {
      setMessages(prev => (prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted]))
      processMentions(inserted.id)
    }
  }

  // Auto-translate incoming messages to the viewer's preferred language
  useEffect(() => {
    if (!tr.autoTranslate) return
    for (const m of messages) {
      if (m.author_id === currentUserId) continue
      if (isImageMessage(m.content)) continue
      tr.ensureAuto(m.id, m.content)
    }
  }, [tr.autoTranslate, messages])

  async function deleteMessage(messageId: string) {
    const res = await fetch('/api/leadership-chat/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    })
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    } else {
      const d = await res.json().catch(() => ({}))
      showError(d.error || 'Failed to delete message.')
    }
  }

  function formatTime(ts: string) {
    const d = new Date(ts)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
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
    const fd = new FormData()
    fd.append('file', file)
    const upRes = await fetch('/api/chat/upload-image', { method: 'POST', body: fd })
    if (!upRes.ok) {
      setUploading(false)
      const d = await upRes.json().catch(() => ({}))
      showError(d.error || 'Failed to upload image. Please try again.')
      return
    }
    const { url } = await upRes.json()
    setUploading(false)
    const res = await fetch('/api/leadership-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: url, kingdomId }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      showError(d.error || 'Failed to send image.')
      return
    }
    const { message: inserted } = await res.json()
    if (inserted) {
      setMessages(prev => (prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted]))
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

      <div className="flex flex-col flex-1 min-h-0 w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 pb-4 border-b border-slate-800 flex-shrink-0">
          <ShieldCheck className="text-amber-500 flex-shrink-0" size={20} />
          <h1 className="font-bold truncate">Leadership Chat</h1>
          <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0 hidden sm:inline">
            R4+
          </span>
          <label className="ml-auto flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400">
            <Globe size={13} className="text-amber-500" />
            <span className="hidden sm:inline">Auto-translate</span>
            <button
              type="button"
              role="switch"
              aria-checked={tr.autoTranslate}
              onClick={() => tr.setAutoTranslate(!tr.autoTranslate)}
              className={`relative w-9 h-5 rounded-full transition-colors ${tr.autoTranslate ? 'bg-amber-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${tr.autoTranslate ? 'translate-x-4' : ''}`} />
            </button>
          </label>
        </div>

        {/* Messages — the only scrolling region */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">No messages yet. Start the leadership conversation.</p>
          )}
          {messages.map(msg => {
            const isOwn = msg.author_id === currentUserId
            const isImage = isImageMessage(msg.content)
            const identity = resolveWorldIdentity(msg.author_id, directory)
            // Only a System Admin may delete a System Admin's message. Here
            // canDelete is admin-only (set by the page), so it doubles as the
            // viewer-is-admin signal.
            const authorIsAdmin = identity.role === 'system_admin'
            const canDeleteThis = (canDelete || isOwn) && (canDelete || !authorIsAdmin)
            return (
              <div key={msg.id} id={`leadmsg-${msg.id}`} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isOwn && (
                    <span className="text-xs text-slate-400 px-1">
                      <span className="text-amber-500/80 font-medium">[{identity.allianceTag}]</span> {identity.name}
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
                        {tr.visible[msg.id] && tr.translations[msg.id] ? (
                          <>
                            <p className="whitespace-pre-wrap">{tr.translations[msg.id].text}</p>
                            <p className="text-[10px] mt-1 opacity-70 italic">
                              Translated from {languageLabel(tr.translations[msg.id].from)}
                            </p>
                          </>
                        ) : (
                          <MentionText content={msg.content} memberNames={memberNames} viewerName={viewerName} />
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs text-slate-500">{formatTime(msg.created_at)}</span>
                    {!isOwn && !isImage && (
                      <button
                        onClick={() => tr.toggle(msg.id, msg.content)}
                        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-0.5"
                        disabled={tr.pending[msg.id]}
                      >
                        <Globe size={10} />
                        {tr.pending[msg.id] ? '...' : tr.visible[msg.id] ? 'Show Original' : 'Translate'}
                      </button>
                    )}
                    {canDeleteThis && (
                      <button onClick={() => deleteMessage(msg.id)} title="Delete message" className="text-xs text-red-500/50 hover:text-red-400">
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

        {/* New message jump button (shown when scrolled up) */}
        {showNewMsg && (
          <div className="relative">
            <button
              onClick={() => scrollToBottom('smooth')}
              className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-semibold rounded-full shadow-lg transition-colors"
            >
              New message ↓
            </button>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="py-2 flex items-center gap-2 text-sm text-amber-400 border-t border-slate-800 flex-shrink-0">
            <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            Uploading image…
          </div>
        )}

        {/* Error toast */}
        {errorMsg && (
          <div className="mb-2 px-4 py-2 bg-red-900/60 text-red-300 text-sm rounded-lg border border-red-800/60 flex-shrink-0">
            {errorMsg}
          </div>
        )}

        {/* Input — fixed at bottom */}
        <form onSubmit={sendMessage} className="pt-4 border-t border-slate-800 flex-shrink-0">
          <div className="flex gap-2 relative">
            {mention.open && (
              <MentionPopup
                candidates={mention.candidates}
                activeIndex={mention.activeIndex}
                onSelect={mention.select}
              />
            )}
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
              ref={inputRef}
              value={content}
              onChange={mention.onChange}
              onKeyDown={e => { if (mention.onKeyDown(e)) return }}
              onPaste={handlePaste}
              placeholder="Message kingdom leadership... (@ to mention)"
              className="flex-1 min-w-0 px-4 h-11 bg-slate-800 border border-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={sending || uploading || !content.trim()}
              className="w-11 h-11 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <Send size={18} className="text-slate-900" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 px-1">
            Sending as: <span className="text-amber-400 font-medium">[{myIdentity.allianceTag}] {viewerName}</span>
          </p>
        </form>
      </div>
    </>
  )
}
