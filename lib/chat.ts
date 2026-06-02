// Shared helpers for alliance chat: in-game name resolution and @ mentions.

export interface MentionMember {
  id: string
  player_name: string
  linked_user_id: string | null
}

/** Map of auth user id -> player_name, for resolving message sender names. */
export function buildMemberByUser(members: MentionMember[]): Map<string, MentionMember> {
  const map = new Map<string, MentionMember>()
  for (const m of members) {
    if (m.linked_user_id) map.set(m.linked_user_id, m)
  }
  return map
}

/**
 * The name to display for a chat message author:
 *   member.player_name  ->  user_profiles.display_name  ->  "Unknown"
 */
export function resolveSenderName(
  authorId: string | null | undefined,
  displayName: string | null | undefined,
  memberByUser: Map<string, MentionMember>
): string {
  const m = authorId ? memberByUser.get(authorId) : undefined
  return m?.player_name || displayName || 'Unknown'
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Active @ mention query at the caret, or null. Looks back from the caret to the
 * nearest "@" that starts a token (preceded by start-of-string or whitespace) and
 * with no whitespace between it and the caret.
 */
export function getMentionQuery(
  text: string,
  caret: number
): { query: string; start: number } | null {
  let i = caret - 1
  while (i >= 0) {
    const ch = text[i]
    if (ch === '@') {
      const prev = text[i - 1]
      if (i === 0 || prev === ' ' || prev === '\n' || prev === '\t') {
        return { query: text.slice(i + 1, caret), start: i }
      }
      return null
    }
    if (ch === ' ' || ch === '\n' || ch === '\t') return null
    i--
  }
  return null
}

/** Members whose player_name matches the query (case-insensitive partial), sorted A→Z. */
export function filterMentionCandidates(
  members: MentionMember[],
  query: string
): MentionMember[] {
  const q = query.toLowerCase()
  return members
    .filter((m) => m.player_name && m.player_name.toLowerCase().includes(q))
    .sort((a, b) => a.player_name.localeCompare(b.player_name))
}

/**
 * Replace the active mention token (from `start` to `caret`) with "@Name ".
 * Returns the new text and the caret position after the inserted mention.
 */
export function insertMention(
  text: string,
  start: number,
  caret: number,
  name: string
): { text: string; caret: number } {
  const before = text.slice(0, start)
  const after = text.slice(caret)
  const insert = `@${name} `
  return { text: before + insert + after, caret: before.length + insert.length }
}

export interface MentionSegment {
  text: string
  /** matched player name when this segment is a mention, else null */
  mention: string | null
}

/**
 * Split message content into plain/mention segments by matching against the known
 * alliance member names (longest first, so "@Idaho Potato" wins over "@Idaho").
 */
export function splitMentions(content: string, memberNames: string[]): MentionSegment[] {
  const names = [...memberNames].filter(Boolean).sort((a, b) => b.length - a.length)
  if (names.length === 0) return [{ text: content, mention: null }]

  const pattern = new RegExp('@(' + names.map(escapeRegExp).join('|') + ')', 'g')
  const segments: MentionSegment[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > last) {
      segments.push({ text: content.slice(last, match.index), mention: null })
    }
    segments.push({ text: match[0], mention: match[1] })
    last = match.index + match[0].length
  }
  if (last < content.length) segments.push({ text: content.slice(last), mention: null })
  return segments
}
