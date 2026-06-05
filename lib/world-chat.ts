// Helpers for World Chat — the global room open to every authenticated user.
//
// World chat messages store only author_id; the sender's game tag and alliance
// tag are resolved at read time from a directory built on the server:
//   name        = member.player_name -> user_profiles.display_name -> "Unknown"
//   allianceTag = the user's alliance tag, or "Guest" when they have no alliance.

export interface WorldChatIdentity {
  name: string
  allianceTag: string
  // Author's account role (e.g. 'system_admin'), used to gate delete-button
  // visibility — only a System Admin may delete a System Admin's message.
  role?: string
}

/** Map of auth user id -> { name, allianceTag }. */
export type WorldChatDirectory = Record<string, WorldChatIdentity>

export function resolveWorldIdentity(
  authorId: string | null | undefined,
  directory: WorldChatDirectory
): WorldChatIdentity {
  const found = authorId ? directory[authorId] : undefined
  return found || { name: 'Unknown', allianceTag: 'Guest' }
}

/** "[TNT] IdahoPotato" — alliance tag in brackets next to the game tag. */
export function formatWorldSender(
  authorId: string | null | undefined,
  directory: WorldChatDirectory
): string {
  const { name, allianceTag } = resolveWorldIdentity(authorId, directory)
  return `[${allianceTag}] ${name}`
}
