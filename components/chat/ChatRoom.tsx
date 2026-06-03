// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, Globe, Trash2, X, Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useNoSleep } from '@/hooks/useNoSleep'
import { MentionText } from '@/components/chat/MentionText'
import { MentionPopup } from '@/components/chat/MentionPopup'
import { useMentionInput } from '@/hooks/useMentionInput'
import { buildMemberByUser, resolveSenderName } from '@/lib/chat'
import { useChatTranslation } from '@/hooks/useChatTranslation'
import { languageLabel, DEFAULT_LANGUAGE } from '@/lib/languages'

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
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showNewMsg, setShowNewMsg] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const didInitialScrollRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Stable client reference — avoids creating multiple GoTrue clients across renders
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  // Live ref to current messages so the realtime callback never reads a stale closure
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Unique channel name per component instance so multiple tabs/mounts don't collide
  const channelIdRef = useRef<string>(`chat:${allianceId}:${Math.random().toString(36).slice(2)}`)

  const canDelete = ['r5', 'r4', 'system_admin'].includes(currentUser?.role || '')

  // ---- Translation (Feature 2) ----
  const preferredLang = currentUser?.preferred_language || DEFAULT_LANGUAGE
  const tr = useChatTranslation(currentUser?.id || 'anon', preferredLang)

  // ---- Game-tag name resolution (Part 3) + @ mention data (Part 4) ----
  const memberByUser = buildMemberByUser(members)
  const memberNames = members.map((m) => m.player_name)
  const viewerName = resolveSenderName(currentUser?.id, currentUser?.display_name, memberByUser)
  const myMemberId = members.find((m) => m.linked_user_id === currentUser?.id)?.id || null

  // Load alliance members for sender names + mention autocomplete
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('members')
        .select('id, player_name, linked_user_id')
        .eq('alliance_id', allianceId)
      if (!cancelled && data) setMembers(data)
    })()
    return () => { cancelled = true }
  }, [allianceId])

  // Opening the chat reads its messages → mark this user's mentions here as read (Part 5)
  useEffect(() => {
    if (!myMemberId) return
    supabase
      .from('chat_mentions')
      .update({ is_read: true })
      .eq('alliance_id', allianceId)
      .eq('mentioned_member_id', myMemberId)
      .eq('is_read', false)
      .then(() => {})
  }, [myMemberId, allianceId, messages.length])

  const mention = useMentionInput(members, content, setContent, inputRef)

  // Keep the screen awake while the chat room is open (silent — no badge)
  useNoSleep(true)

  // FIX 9 — default to the newest message. On first load jump to the bottom
  // instantly; afterwards auto-scroll only when the user is already near the
  // bottom, otherwise surface a "New message ↓" button.
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

  // Jump-to-message from a notification (?msg=<id>): scroll to it and flash a highlight
  useEffect(() => {
    if (typeof window === 'undefined') return
    const msgId = new URLSearchParams(window.location.search).get('msg')
    if (!msgId) return
    const el = document.getElementById(`msg-${msgId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(msgId)
    const t = setTimeout(() => setHighlightId(null), 2500)
    return () => clearTimeout(t)
  }, [messages.length])

  // Realtime subscription — starts on mount, unsubscribes on unmount.
  // Self-heals: resubscribes on CLOSED/TIMED_OUT.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const addMessage = (data: any) => {
      // Dedupe against the live ref (avoids stale closure) before appending
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
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `alliance_id=eq.${allianceId}` },
          async (payload) => {
            const { data } = await supabase
              .from('chat_messages')
              .select('*, user_profiles(display_name, role)')
              .eq('id', payload.new.id)
              .single()
            addMessage(data)
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `alliance_id=eq.${allianceId}` },
          (payload) => {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          }
        )
        .subscribe((status, err) => {
          console.log('[ChatRoom] Realtime status:', status, err ?? '')
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
  }, [allianceId])

  // Parse @mentions server-side so recipients get notifications
  async function processMentions(messageId: string) {
    try {
      await fetch('/api/chat/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, allianceId }),
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
    // Send via the rate-limited API route (60 msgs/min/user).
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, allianceId }),
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
      setMessages(prev => [...prev, {
        ...inserted,
        user_profiles: { display_name: currentUser?.display_name, role: currentUser?.role },
      }])
      processMentions(inserted.id)
    }
  }

  // Auto-translate incoming messages to the viewer's preferred language
  useEffect(() => {
    if (!tr.autoTranslate) return
    for (const m of messages) {
      if (m.author_id === currentUser?.id) continue
      if (isImageMessage(m.content)) continue
      tr.ensureAuto(m.id, m.content)
    }
  }, [tr.autoTranslate, messages])

  async function deleteMessage(messageId: string) {
    await supabase.from('chat_messages').delete().eq('id', messageId)
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }

  function formatTime(ts: string) {
    // Deterministic UTC formatting — identical on server and client, so the
    // server-rendered timestamp matches client hydration (no #425/#418/#423).
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
    // Upload via the hardened server route (re-validates MIME/size/magic bytes).
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
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: url, allianceId }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      showError(d.error || 'Failed to send image.')
      return
    }
    const { message: inserted } = await res.json()
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

      {/* Fills the height handed down by the page wrapper; only the message list
           scrolls (min-h-0 lets the flex child shrink so it can scroll). */}
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-3xl mx-auto">
        {/* Header — fixed at top */}
        <div className="flex items-center gap-2 pb-4 border-b border-slate-800 flex-shrink-0">
          <MessageSquare className="text-amber-500" size={20} />
          <h1 className="font-bold">{allianceName} — Chat</h1>
          {/* Auto-translate toggle */}
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
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3 relative">
          {messages.map(msg => {
            const isOwn = msg.author_id === currentUser?.id
            const isImage = isImageMessage(msg.content)
            const senderName = resolveSenderName(msg.author_id, msg.user_profiles?.display_name, memberByUser)
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} ${highlightId === msg.id ? 'ring-2 ring-amber-400 rounded-2xl -m-1 p-1' : ''}`}>
                <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isOwn && (
                    <span className="text-xs text-slate-400 px-1">
                      {senderName}
                      {msg.user_profiles?.role && <Badge className="ml-1" variant="default">{msg.user_profiles.role}</Badge>}
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

        {/* Input — fixed at bottom */}
        <form onSubmit={sendMessage} className="pt-4 border-t border-slate-800 flex-shrink-0">
          <div className="flex gap-2 relative">
            {/* Mention autocomplete */}
            {mention.open && (
              <MentionPopup
                candidates={mention.candidates}
                activeIndex={mention.activeIndex}
                onSelect={mention.select}
              />
            )}
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
              ref={inputRef}
              value={content}
              onChange={mention.onChange}
              onKeyDown={e => { if (mention.onKeyDown(e)) return }}
              onPaste={handlePaste}
              placeholder="Type a message... (@ to mention)"
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
          </div>
          {/* Confirm which name others will see */}
          <p className="text-xs text-slate-500 mt-1.5 px-1">
            Sending as: <span className="text-amber-400 font-medium">{viewerName}</span>
          </p>
        </form>
      </div>
    </>
  )
}
