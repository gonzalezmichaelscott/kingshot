'use client'
import { splitMentions } from '@/lib/chat'

interface Props {
  content: string
  memberNames: string[]
  viewerName: string | null
}

/**
 * Renders message text with @PlayerName mentions highlighted.
 *
 * - Mentions of OTHER users: amber/gold (#f59e0b = amber-500), bold, with a
 *   subtle lighter highlight behind the text.
 * - A mention of the CURRENT viewer: a high-contrast pill (dark background +
 *   bright amber text + ring) so it stands out clearly. Because it uses its own
 *   dark background, it stays readable inside BOTH a sent bubble (amber) and a
 *   received bubble (dark slate).
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
                ? 'font-bold rounded px-1 bg-slate-900 text-amber-300 ring-1 ring-amber-400/70'
                : 'font-bold rounded px-0.5 text-amber-500 bg-amber-500/15'
            }
          >
            {seg.text}
          </span>
        )
      })}
    </>
  )
}
