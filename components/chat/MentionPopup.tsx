'use client'
import { useEffect, useRef } from 'react'
import { AtSign } from 'lucide-react'
import type { MentionMember } from '@/lib/chat'

interface Props {
  candidates: MentionMember[]
  activeIndex: number
  onSelect: (m: MentionMember) => void
}

/** Mention autocomplete popup, anchored above the message input. */
export function MentionPopup({ candidates, activeIndex, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  // Keep the highlighted item in view as the user arrows through the list.
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (candidates.length === 0) return null

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-2 max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[60] py-1"
    >
      {candidates.map((m, i) => (
        <button
          key={m.id}
          type="button"
          // onMouseDown (not onClick) so it fires before the input blur.
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(m)
          }}
          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
            i === activeIndex ? 'bg-amber-500/20 text-amber-300' : 'text-slate-200 hover:bg-slate-700'
          }`}
        >
          <AtSign size={13} className="text-amber-500 flex-shrink-0" />
          <span className="truncate">{m.player_name}</span>
        </button>
      ))}
    </div>
  )
}
