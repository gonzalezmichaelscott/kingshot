// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, Globe, Trash2, X, Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScreenStayOn } from '@/components/ui/ScreenStayOn'
import { MentionText } from '@/components/chat/MentionText'
import { MentionPopup } from '@/components/chat/MentionPopup'
import { useMentionInput } from '@/hooks/useMentionInput'
import { buildMemberByUser, resolveSenderName } from '@/lib/chat'

interface Props {
  allianceId: string
  allianceName: string
  currentUserId: string
  currentUserRole: string
  open: boolean
  onClose: () => void
  targetMessageId?: string
  targetNonce?: number
}

export function ChatPanel({ allianceId, allianceName, currentUserId, currentUserRole, open, onClose, targetMessageId, targetNonce }: Props) {
  const [messages, setMessages] = useState<any[]>([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [translating, setTranslating] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Stable client reference — avoids creating multiple GoTrue clients across renders
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const canDelete = ['r5', 'r4', 'system_admin'].includes(currentUserRole || '')
  const hasTranslate = typeof window !== 'undefined' && !!(process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_KEY)

  // ---- Game-tag name resolution (Part 3) + @ mention data (Part 4) ----
  const memberByUser = buildMemberByUser(members)
  const memberNames = members.map((m) => m.player_name)
  const viewerName = resolveSenderName(currentUserId, myDisplayName, memberByUser)
  const myMemberId = members.find((m) => m.linked_user_id === currentUserId)?.id || null

  const mention = useMentionInput(members, content, setContent, inputRef)

  // Load alliance members (sender names + mentions) and the viewer's display name
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: mems }, { data: prof }] = await Promise.all([
        supabase.from('members').select('id, player_name, linked_user_id').eq('alliance_id', allianceId),
        supabase.from('user_profiles').select('display_name').eq('id', currentUserId).maybeSingle(),
      ])
      if (cancelled) return
      if (mems) setMembers(mems)
      if (prof) setMyDisplayName(prof.display_name)
    })()
    return () => { cancelled = true }
  }, [allianceId, currentUserId])

  // Reading the chat marks this user's mentions in this alliance as read (Part 5)
  useEffect(() => {
    if (!open || !myMemberId) return
    supabase
      .from('chat_mentions')
      .update({ is_read: true })
      .eq('alliance_id', allianceId)
      .eq('mentioned_member_id', myMemberId)
      .eq('is_read', false)
      .then(() => {})
  }, [open, myMemberId, allianceId, messages.length])

  // Load initial messages when panel opens for the first time
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

  // Jump-to-message from a notification: scroll to the target and flash a highlight.
  // Best-effort — only works if the message is within the loaded window.
  useEffect(() => {
    if (!open || !targetMessageId || !initialized) return
    const el = document.getElementById(`panelmsg-${targetMessageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(targetMessageId)
    const t = setTimeout(() => setHighlightId(null), 2500)
    return () => clearTimeout(t)
  }, [open, targetMessageId, targetNonce, initialized, messages.length])

  // Auto-scroll on new messages only when near the bottom
  useEffect(() => {
    if (messages.length > 0) {
      const list = listRef.current
      if (list && list.scrollTop > list.scrollHeight - list.clientHeight - 200) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // Realtime subscription — starts on mount, unsubscribes on unmount
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
      .subscribe((status, err) => {
        console.log('[ChatPanel] Realtime status:', status, err ?? '')
      })
    return () => { supabase.removeChannel(channel) }
  }, [allianceId])

  async function processMentions(messageId: string) {
    try {
      await fetch('/api/chat/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, allianceId }),
      })
    } catch {
      // Non-fatal
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    const text = content.trim()
    setContent('')
    mention.close()
    const { data: inserted } = await supabase.from('chat_messages').insert({
      alliance_id: allianceId,
      author_id: currentUserId,
      content: text,
    }).select().single()
    setSending(false)
    if (inserted) {
      setMessages(prev => [...prev, {
        ...inserted,
        user_profiles: { display_name: myDisplayName, role: currentUserRole },
      }])
      processMentions(inserted.id)
    }
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
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
  }

  async function handleScrollTop() {
    if (!hasMore || loadingMore || messages.length === 0) return
    const oldest = messages[0]?.created_at
    if (oldest) await loadMessages(oldest)
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
      author_id: currentUserId,
      content: urlData.publicUrl,
    }).select().single()
    if (inserted) {
      setMessages(prev => [...prev, {
        ...inserted,
        user_profiles: { display_name: myDisplayName, role: currentUserRole },
      }])
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      {/* Keep the screen awake while the chat panel is visible */}
      <ScreenStayOn active={open} />

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
        </div>
      )}

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
            const isOwn = msg.author_id === currentUserId
            const isImage = isImageMessage(msg.content)
            const senderName = resolveSenderName(msg.author_id, msg.user_profiles?.display_name, memberByUser)
            return (
              <div key={msg.id} id={`panelmsg-${msg.id}`} className={`flex gap-1.5 ${isOwn ? 'flex-row-reverse' : ''} ${highlightId === msg.id ? 'ring-2 ring-amber-400 rounded-xl -m-1 p-1' : ''}`}>
                <div className={`max-w-[85%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <span className="text-[10px] text-slate-400 px-1">
                      {senderName}
                      {msg.user_profiles?.role && <Badge className="ml-1 text-[9px] py-0" variant="default">{msg.user_profiles.role.toUpperCase()}</Badge>}
                    </span>
                  )}
                  <div className={`rounded-xl px-3 py-1.5 text-sm leading-snug ${isOwn ? 'bg-amber-500 text-slate-900 rounded-tr-sm' : 'bg-slate-800 text-slate-100 rounded-tl-sm'} ${isImage ? 'p-1' : ''}`}>
                    {isImage ? (
                      <img
                        src={msg.content}
                        alt="Shared image"
                        className="max-w-[220px] rounded-lg cursor-pointer object-cover hover:opacity-90 transition-opacity"
                        style={{ maxHeight: '180px' }}
                        onClick={() => setLightboxUrl(msg.content)}
                      />
                    ) : (
                      <>
                        <MentionText content={msg.content} memberNames={memberNames} viewerName={viewerName} />
                        {msg._translated && (
                          <p className="text-xs mt-1 opacity-70 italic">{msg._translated}</p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[10px] text-slate-500">{formatTime(msg.created_at)}</span>
                    {!isOwn && !isImage && hasTranslate && (
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

        {/* Upload progress */}
        {uploading && (
          <div className="px-4 py-1.5 bg-slate-800/80 border-t border-slate-700 flex items-center gap-2 text-xs text-amber-400">
            <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            Uploading image…
          </div>
        )}

        {/* Error toast */}
        {errorMsg && (
          <div className="mx-3 mb-1 px-3 py-2 bg-red-900/60 text-red-300 text-xs rounded-lg border border-red-800/60">
            {errorMsg}
          </div>
        )}

        {/* Input */}
        <form onSubmit={sendMessage} className="p-3 border-t border-slate-800 flex-shrink-0">
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
              className="w-9 h-9 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <Paperclip size={14} className="text-slate-400" />
            </button>
            <input
              ref={inputRef}
              value={content}
              onChange={mention.onChange}
              onKeyDown={e => {
                if (mention.onKeyDown(e)) return
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any) }
              }}
              onPaste={handlePaste}
              placeholder="Message… (@ to mention)"
              className="flex-1 px-3 h-9 bg-slate-800 border border-slate-700 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 min-w-0"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={sending || uploading || !content.trim()}
              className="w-9 h-9 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <Send size={15} className="text-slate-900" />
            </button>
          </div>
          {/* Confirm which name others will see */}
          <p className="text-[10px] text-slate-500 mt-1 px-1">
            Sending as: <span className="text-amber-400 font-medium">{viewerName}</span>
          </p>
        </form>
      </div>
    </>
  )
}
