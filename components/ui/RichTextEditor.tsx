// @ts-nocheck
'use client'
import { useRef, useState } from 'react'
import { Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Eye, Edit2 } from 'lucide-react'

export function parseMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

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

  return html
}

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
}

export function RichTextEditor({ value, onChange, placeholder, rows = 10 }: Props) {
  const [preview, setPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const toolbarBtn = 'p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors'

  return (
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

      {/* Editor / Preview */}
      {preview ? (
        <div
          className="min-h-[160px] p-3 bg-slate-900 text-slate-200 text-sm leading-relaxed prose-invert"
          dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(value || '') || '<span class="text-slate-500">Nothing to preview.</span>' }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder || 'Write your instructions here...\n\nUse **bold**, *italic*, __underline__\n## Heading 2  ### Heading 3\n- Bullet item\n1. Numbered item'}
          className="w-full p-3 bg-slate-900 text-slate-100 text-sm leading-relaxed resize-y focus:outline-none placeholder:text-slate-600"
        />
      )}
    </div>
  )
}
