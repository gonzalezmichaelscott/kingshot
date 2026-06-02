'use client'
import { splitMentions } from '@/lib/chat'

interface Props {
  content: string
  memberNames: string[]
  viewerName: string | null
}

/**
 * Renders message text with @PlayerName mentions highlighted. A mention of the
 * current viewer is given a brighter amber-background treatment so they can spot
 * when they've been tagged.
 */
export function MentionText({ content, memberNames, viewerName }: Props) {
  const segments = splitMentions(content, memberNames)
  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.mention) return <span key={i}>{seg.text}</span>
        const isViewer =
          viewerName != null && seg.mention.toLowerCase() === viewerName.toLowerCase()
        return (
          <span
            key={i}
            className={
              isViewer
                ? 'font-bold bg-amber-400 text-slate-900 rounded px-1'
                : 'font-semibold text-amber-400'
            }
          >
            {seg.text}
          </span>
        )
      })}
    </>
  )
}
