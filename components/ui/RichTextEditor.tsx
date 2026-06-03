// @ts-nocheck
'use client'
import { useRef, useState } from 'react'
import { Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Eye, Edit2, ImagePlus, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sanitizeHtml } from '@/lib/sanitize'

export function parseMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Images: ![alt|size](url) — size optional: sm/md/lg
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const parts = alt.split('|')
    const altText = parts[0] || 'image'
    const size = parts[1]?.trim()
    const sizeClass = size === 'sm' ? 'max-w-xs' : size === 'lg' ? 'max-w-full' : 'max-w-lg'
    return `<img src="${url}" alt="${altText}" class="${sizeClass} rounded-lg my-2 cursor-pointer hover:opacity-90 transition-opacity inline-block" data-lightbox="1" />`
  })

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-1">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')

  // Bold / Italic / Underline
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/__(.+?)__/g, '<u>$1</u>')

  // Bullet lists — group consecutive lines
  html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map(l => `<li>${l.replace(/^- /, '')}</li>`)
      .join('')
    return `<ul class="list-disc list-inside space-y-0.5 my-2">${items}</ul>`
  })

  // Numbered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`)
      .join('')
    return `<ol class="list-decimal list-inside space-y-0.5 my-2">${items}</ol>`
  })

  // Paragraphs: blank lines → <br>
  html = html.replace(/\n\n+/g, '<br/><br/>')
  html = html.replace(/\n/g, '<br/>')

  // Final defense: strip anything outside the allowed tag/attr set (e.g. a
  // crafted image URL that tries to inject attributes or scripts).
  return sanitizeHtml(html)
}

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
  /** When provided, enables image upload. Used as subfolder in the event-images bucket. */
  uploadFolder?: string
}

export function RichTextEditor({ value, onChange, placeholder, rows = 10, uploadFolder }: Props) {
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cursorPosRef = useRef<number>(0)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const uploadEnabled = !!uploadFolder

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  function insertAround(before: string, after: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || 'text'
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    setTimeout(() => {
      el.focus()
      el.selectionStart = start + before.length
      el.selectionEnd = start + before.length + selected.length
    }, 0)
  }

  function insertLine(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    setTimeout(() => {
      el.focus()
      el.selectionStart = lineStart + prefix.length
      el.selectionEnd = lineStart + prefix.length
    }, 0)
  }

  function insertAtCursor(text: string, cursorPos?: number) {
    const pos = cursorPos ?? cursorPosRef.current ?? value.length
    const next = value.slice(0, pos) + text + '\n' + value.slice(pos)
    onChange(next)
  }

  async function uploadImageFile(file: File, pos?: number) {
    if (!uploadEnabled) return
    setUploadError('')
    setUploading(true)
    try {
      const supabase = getSupabase()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp']
      if (!allowed.includes(ext)) {
        setUploadError('Only JPG, PNG, GIF, and WebP images are supported.')
        return
      }
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path = `${uploadFolder}/${filename}`
      const { error } = await supabase.storage
        .from('event-images')
        .upload(path, file, { upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('event-images').getPublicUrl(path)
      insertAtCursor(`![image](${data.publicUrl})`, pos)
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleImageButtonClick() {
    // Save cursor position before the file dialog steals focus
    cursorPosRef.current = textareaRef.current?.selectionStart ?? value.length
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadImageFile(file, cursorPosRef.current)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      const pos = textareaRef.current?.selectionStart ?? value.length
      if (file) uploadImageFile(file, pos)
    }
  }

  function handlePreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG' && target.dataset.lightbox) {
      setLightboxSrc((target as HTMLImageElement).src)
    }
  }

  const toolbarBtn = 'p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors'

  return (
    <>
      <div className="border border-slate-700 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-800 border-b border-slate-700 flex-wrap">
          <button type="button" onClick={() => insertAround('**', '**')} className={toolbarBtn} title="Bold">
            <Bold size={14} />
          </button>
          <button type="button" onClick={() => insertAround('*', '*')} className={toolbarBtn} title="Italic">
            <Italic size={14} />
          </button>
          <button type="button" onClick={() => insertAround('__', '__')} className={toolbarBtn} title="Underline">
            <Underline size={14} />
          </button>
          <div className="w-px h-4 bg-slate-600 mx-1" />
          <button type="button" onClick={() => insertLine('## ')} className={toolbarBtn} title="Heading 2">
            <Heading2 size={14} />
          </button>
          <button type="button" onClick={() => insertLine('### ')} className={toolbarBtn} title="Heading 3">
            <Heading3 size={14} />
          </button>
          <div className="w-px h-4 bg-slate-600 mx-1" />
          <button type="button" onClick={() => insertLine('- ')} className={toolbarBtn} title="Bullet list">
            <List size={14} />
          </button>
          <button type="button" onClick={() => insertLine('1. ')} className={toolbarBtn} title="Numbered list">
            <ListOrdered size={14} />
          </button>
          {uploadEnabled && (
            <>
              <div className="w-px h-4 bg-slate-600 mx-1" />
              <button
                type="button"
                onClick={handleImageButtonClick}
                disabled={uploading}
                className={`${toolbarBtn} flex items-center gap-1 text-xs disabled:opacity-50`}
                title="Insert image (also supports Ctrl+V paste)"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {uploading ? 'Uploading…' : 'Image'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPreview(p => !p)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
              preview ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {preview ? <Edit2 size={12} /> : <Eye size={12} />}
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border-b border-red-800/40">
            <p className="text-red-400 text-xs flex-1">{uploadError}</p>
            <button type="button" onClick={() => setUploadError('')} className="text-red-400 hover:text-red-300">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Editor / Preview */}
        {preview ? (
          <div
            className="min-h-[160px] p-3 bg-slate-900 text-slate-200 text-sm leading-relaxed prose-invert"
            dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(value || '') || '<span class="text-slate-500">Nothing to preview.</span>' }}
            onClick={handlePreviewClick}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onPaste={uploadEnabled ? handlePaste : undefined}
            rows={rows}
            placeholder={placeholder || 'Write your instructions here...\n\nUse **bold**, *italic*, __underline__\n## Heading 2  ### Heading 3\n- Bullet item\n1. Numbered item'}
            className="w-full p-3 bg-slate-900 text-slate-100 text-sm leading-relaxed resize-y focus:outline-none placeholder:text-slate-600"
          />
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} className="max-w-full max-h-full rounded-lg shadow-2xl" alt="Enlarged view" />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1 hover:bg-black/70"
            onClick={() => setLightboxSrc(null)}
          >
            <X size={22} />
          </button>
        </div>
      )}
    </>
  )
}
