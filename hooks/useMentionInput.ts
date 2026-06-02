import { useState, type RefObject } from 'react'
import {
  getMentionQuery,
  filterMentionCandidates,
  insertMention,
  type MentionMember,
} from '@/lib/chat'

/**
 * Drives the @ mention autocomplete for a chat text input. Owns popup
 * open/candidates/active-index state and exposes handlers to wire onto the input.
 *
 * onKeyDown returns true when it consumed the key (e.g. Enter selected a mention),
 * so the caller knows not to also submit the form.
 */
export function useMentionInput(
  members: MentionMember[],
  content: string,
  setContent: (v: string) => void,
  inputRef: RefObject<HTMLInputElement>
) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(0)
  const [candidates, setCandidates] = useState<MentionMember[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  function refresh(text: string, caret: number) {
    const q = getMentionQuery(text, caret)
    if (!q) {
      setOpen(false)
      return
    }
    const c = filterMentionCandidates(members, q.query)
    setCandidates(c)
    setStart(q.start)
    setActiveIndex(0)
    setOpen(c.length > 0)
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value
    setContent(text)
    refresh(text, e.target.selectionStart ?? text.length)
  }

  function select(m: MentionMember) {
    const caret = inputRef.current?.selectionStart ?? content.length
    const { text, caret: newCaret } = insertMention(content, start, caret, m.player_name)
    setContent(text)
    setOpen(false)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(newCaret, newCaret)
      }
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): boolean {
    if (!open || candidates.length === 0) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, candidates.length - 1))
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return true
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      select(candidates[activeIndex])
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return true
    }
    return false
  }

  return { open, candidates, activeIndex, onChange, onKeyDown, select, close: () => setOpen(false) }
}
