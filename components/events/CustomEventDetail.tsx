// @ts-nocheck
'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor, parseMarkdownToHtml } from '@/components/ui/RichTextEditor'
import { Calendar, Edit2, X, Save, ImagePlus, ZoomIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { TranslateButton } from '@/components/ui/TranslateButton'

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  planning: 'Draft',
  published: 'Published',
  registration: 'Published',
  active: 'Active',
  completed: 'Completed',
}
const statusColor: Record<string, string> = {
  draft: 'bg-slate-600/30 text-slate-400 border-slate-600',
  planning: 'bg-slate-600/30 text-slate-400 border-slate-600',
  published: 'bg-green-500/20 text-green-400 border-green-500/30',
  registration: 'bg-green-500/20 text-green-400 border-green-500/30',
  active: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-600',
}

interface Image {
  url: string
  caption?: string
  uploaded_at?: string
}

interface Props {
  event: any
  canManage: boolean
  allianceId: string
  memberId?: string | null
  memberAttendance?: any
  accessToken?: string
  viewerLang?: string
}

/** Strip HTML tags to plain text for translation. */
function htmlToPlainText(html: string): string {
  if (typeof document !== 'undefined') {
    const el = document.createElement('div')
    el.innerHTML = html
    return (el.textContent || el.innerText || '').trim()
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function ImageGallery({ images }: { images: Image[] }) {
  const [zoomed, setZoomed] = useState<string | null>(null)
  if (!images.length) return null
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Attachments</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative group">
            <img
              src={img.url}
              alt={img.caption || `Image ${i + 1}`}
              className="w-full h-36 object-cover rounded-lg cursor-pointer border border-slate-700 hover:border-amber-500/50 transition-colors"
              onClick={() => setZoomed(img.url)}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn size={20} className="text-white drop-shadow" />
            </div>
            {img.caption && (
              <p className="text-xs text-slate-400 mt-1 text-center truncate">{img.caption}</p>
            )}
          </div>
        ))}
      </div>
      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomed(null)}
        >
          <img src={zoomed} className="max-w-full max-h-full rounded-lg" />
          <button className="absolute top-4 right-4 text-white" onClick={() => setZoomed(null)}>
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}

function AttendanceToggle({
  eventId,
  memberId,
  accessToken,
  existing,
}: {
  eventId: string
  memberId: string
  accessToken?: string
  existing: any
}) {
  const [willAttend, setWillAttend] = useState(existing?.will_attend ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  async function save(attend: boolean) {
    setSaving(true)
    await fetch('/api/member/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        event_id: eventId,
        will_attend: attend,
        available_from_utc: null,
        available_to_utc: null,
      }),
    })
    setWillAttend(attend)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={willAttend}
          disabled={saving}
          onChange={e => save(e.target.checked)}
          className="w-5 h-5 rounded accent-amber-500"
        />
        <span className="text-sm font-medium">
          {saved ? 'Saved!' : willAttend ? "I'll attend" : 'Mark as attending'}
        </span>
      </label>
    </div>
  )
}

function EditForm({ event, onDone }: { event: any; onDone: () => void }) {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({
    name: event.name || '',
    battle_start_utc: event.battle_start_utc
      ? new Date(event.battle_start_utc).toISOString().slice(0, 16)
      : '',
    battle_end_utc: event.battle_end_utc
      ? new Date(event.battle_end_utc).toISOString().slice(0, 16)
      : '',
    custom_instructions: event.custom_instructions || '',
    status: event.status || 'planning',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState<Image[]>((event.custom_images as Image[]) || [])

  async function save() {
    setSaving(true)
    const { parseMarkdownToHtml } = await import('@/components/ui/RichTextEditor')
    await supabase
      .from('events')
      .update({
        name: form.name || null,
        battle_start_utc: form.battle_start_utc || null,
        battle_end_utc: form.battle_end_utc || null,
        custom_instructions: form.custom_instructions,
        custom_instructions_html: parseMarkdownToHtml(form.custom_instructions),
        custom_images: images,
        status: form.status,
      })
      .eq('id', event.id)
    setSaving(false)
    router.refresh()
    onDone()
  }

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `events/${event.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('event-images')
        .upload(path, file, { upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('event-images').getPublicUrl(path)
      setImages(imgs => [
        ...imgs,
        { url: data.publicUrl, caption: file.name, uploaded_at: new Date().toISOString() },
      ])
    } catch (e) {
      console.error('Upload failed', e)
    }
    setUploading(false)
  }

  const statusOptions = [
    { value: 'planning', label: 'Draft' },
    { value: 'registration', label: 'Published (visible to members)' },
    { value: 'completed', label: 'Completed' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 block mb-1">Event Name</label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Event name (required)" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Start Date & Time (UTC)</label>
          <Input
            type="datetime-local"
            value={form.battle_start_utc}
            onChange={e => setForm(f => ({ ...f, battle_start_utc: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">End Date & Time (UTC) <span className="text-slate-500">(optional)</span></label>
          <Input
            type="datetime-local"
            value={form.battle_end_utc}
            onChange={e => setForm(f => ({ ...f, battle_end_utc: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Status</label>
        <select
          value={form.status}
          onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Battle Plan / Instructions</label>
        <RichTextEditor
          value={form.custom_instructions}
          onChange={v => setForm(f => ({ ...f, custom_instructions: v }))}
          rows={12}
          uploadFolder={`events/${event.id}`}
        />
      </div>
      {/* Image upload */}
      <div>
        <label className="text-xs text-slate-400 block mb-2">Images / Attachments</label>
        <label className="flex items-center gap-2 cursor-pointer w-fit bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg text-sm transition-colors">
          <ImagePlus size={14} className="text-amber-400" />
          {uploading ? 'Uploading…' : 'Add Image'}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            disabled={uploading}
            onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])}
          />
        </label>
        {images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img.url} className="w-16 h-16 object-cover rounded border border-slate-700" />
                <button
                  type="button"
                  onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving} className="flex items-center gap-1.5">
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

function InlineImageLightbox({ html }: { html: string }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG' && (target as HTMLImageElement).dataset.lightbox) {
      setLightboxSrc((target as HTMLImageElement).src)
    }
  }

  return (
    <>
      <div
        className="text-sm text-slate-200 leading-relaxed prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
      />
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} className="max-w-full max-h-full rounded-lg shadow-2xl" alt="Enlarged view" />
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1" onClick={() => setLightboxSrc(null)}>
            <X size={22} />
          </button>
        </div>
      )}
    </>
  )
}

export function CustomEventDetail({ event, canManage, allianceId, memberId, memberAttendance, accessToken, viewerLang = 'en' }: Props) {
  const [editing, setEditing] = useState(false)
  const images: Image[] = (event.custom_images as Image[]) || []
  const html = event.custom_instructions_html || parseMarkdownToHtml(event.custom_instructions || '')
  const status = event.status || 'planning'
  // Plain-text source for translating the battle plan instructions.
  const instructionsText = (event.custom_instructions || '').trim() || htmlToPlainText(html)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${statusColor[status] || statusColor.planning}`}>
              {statusLabel[status] || status}
            </span>
            <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded font-medium">
              Custom Event
            </span>
          </div>
          <h1 className="text-2xl font-bold">{event.name || 'Custom Event'}</h1>
          {event.battle_start_utc && (
            <p className="flex items-center gap-1.5 text-slate-400 text-sm">
              <Calendar size={13} />
              {event.battle_end_utc ? (
                <>
                  {new Date(event.battle_start_utc).toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                  {' — '}
                  {new Date(event.battle_end_utc).toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} UTC
                </>
              ) : (
                <>{new Date(event.battle_start_utc).toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} UTC</>
              )}
            </p>
          )}
        </div>
        {canManage && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Edit2 size={13} className="mr-1.5" /> Edit
          </Button>
        )}
      </div>

      {/* Edit form */}
      {editing && canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Event</CardTitle>
          </CardHeader>
          <CardContent>
            <EditForm event={event} onDone={() => setEditing(false)} />
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!editing && (
        <>
          {html ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-base">Battle Plan / Instructions</CardTitle>
                  {instructionsText && (
                    <TranslateButton text={instructionsText} targetLang={viewerLang} label="Translate Instructions" variant="button" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <InlineImageLightbox html={html} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-slate-400 text-sm">
                  {canManage
                    ? 'No instructions yet. Click Edit to add a battle plan.'
                    : 'Battle plan not yet published — check back before the event.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Images */}
          {images.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <ImageGallery images={images} />
              </CardContent>
            </Card>
          )}

          {/* Attendance for members */}
          {memberId && accessToken && (
            <Card>
              <CardContent className="py-4">
                <AttendanceToggle
                  eventId={event.id}
                  memberId={memberId}
                  accessToken={accessToken}
                  existing={memberAttendance}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
