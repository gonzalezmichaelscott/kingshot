// @ts-nocheck
/**
 * Shared helpers for the per-kingdom KVK Command hub.
 *
 * MODEL (per FIX 2): each kvk_enabled alliance runs its OWN "Castle Battle (KVK)"
 * event. Members submit attendance + availability on their alliance's event. The
 * kingdom hub aggregates only the ATTENDING members across every participating
 * alliance's active event. Each member's battle-plan assignment is stored on their
 * own alliance's event, so the normal alliance-scoped RLS lets them see it.
 *
 * Cross-alliance reads here go through the service client — callers MUST verify
 * access (kingdom membership + backend role) before calling.
 */
import { createServiceClient } from '@/lib/supabase/server'

export const KVK_SLUG = 'kvk_castle_battle'

/** The six holdable structures, the member_scores column used to rank recommended
 *  players, the matching voice channel, and the default formation guidance. */
export const KVK_STRUCTURES = [
  { key: 'castle', label: 'Castle', scoreField: 'castle_score', voiceChannel: 'castle', formation: '60% Infantry / 20% Cavalry / 20% Archer (garrison)' },
  { key: 'north_turret', label: 'North Turret', scoreField: 'turret_score', voiceChannel: 'north_turret', formation: '50% Infantry / 20% Cavalry / 30% Archer (rally)' },
  { key: 'east_turret', label: 'East Turret', scoreField: 'turret_score', voiceChannel: 'east_turret', formation: '50% Infantry / 20% Cavalry / 30% Archer (rally)' },
  { key: 'south_turret', label: 'South Turret', scoreField: 'turret_score', voiceChannel: 'south_turret', formation: '50% Infantry / 20% Cavalry / 30% Archer (rally)' },
  { key: 'west_turret', label: 'West Turret', scoreField: 'turret_score', voiceChannel: 'west_turret', formation: '50% Infantry / 20% Cavalry / 30% Archer (rally)' },
  { key: 'support', label: 'Support', scoreField: 'support_score', voiceChannel: 'general', formation: 'Weakening rallies — bring your strongest troops' },
] as const

/** The role stored in event_assignments when a player is manually placed on a structure. */
export function roleForSquad(squad: string): string {
  if (squad === 'castle') return 'castle'
  if (squad === 'support') return 'support'
  return 'turret_joiner'
}

/** Marker prefix written into event_assignments.reasoning for manual overrides. */
export const MANUAL_MARKER = 'Manually assigned'
export function isManualAssignment(reasoning: string | null | undefined): boolean {
  return !!reasoning && reasoning.startsWith(MANUAL_MARKER)
}

/** Mark a KVK event completed once its battle_end_utc has passed (FIX 7 auto-reset). */
async function autoCompleteIfEnded(svc: any, ev: any) {
  if (!ev) return ev
  if (ev.status !== 'completed' && ev.battle_end_utc && new Date(ev.battle_end_utc) < new Date()) {
    await svc.from('events').update({ status: 'completed' }).eq('id', ev.id)
    return { ...ev, status: 'completed' }
  }
  return ev
}

/**
 * Resolve the KVK context for a kingdom: the event type plus every kvk_enabled
 * alliance with its latest Castle Battle event (auto-completing expired ones).
 * `activeEvent` is the latest event that is NOT completed.
 */
export async function getKvkContext(kingdomId: string) {
  const svc = createServiceClient()

  const { data: eventType } = await svc
    .from('event_types')
    .select('*')
    .eq('slug', KVK_SLUG)
    .single()

  if (!eventType) {
    // Without the event type, no alliance can have an "active" KVK event — make
    // that loud rather than silently returning 0 attending members.
    console.warn(`[KVK] getKvkContext: no event_types row for slug "${KVK_SLUG}" — run the schema seed.`)
  }

  const { data: alliances } = await svc
    .from('alliances')
    .select('id, name, tag, kvk_enabled')
    .eq('kingdom_id', kingdomId)

  const enabled = (alliances || []).filter(a => a.kvk_enabled)
  console.log(`[KVK] getKvkContext kingdom=${kingdomId} kvkEnabledAlliances=${enabled.length} (of ${(alliances || []).length})`)

  const result: any[] = []
  for (const a of enabled) {
    let latest: any = null
    if (eventType) {
      // No date filter on purpose: the latest non-completed event (upcoming OR
      // currently active) is the one members submit attendance on.
      const { data: evs } = await svc
        .from('events')
        .select('*, event_types(*)')
        .eq('alliance_id', a.id)
        .eq('event_type_id', eventType.id)
        .order('battle_start_utc', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
      latest = await autoCompleteIfEnded(svc, evs?.[0] || null)
    }
    const isActive = !!(latest && latest.status !== 'completed')
    console.log(
      `[KVK] getKvkContext alliance=[${a.tag}](${a.id}) latestEvent=${latest?.id || 'none'} ` +
      `status=${latest?.status || '-'} battle_start=${latest?.battle_start_utc || '-'} active=${isActive}`
    )
    result.push({
      ...a,
      event: latest,
      activeEvent: isActive ? latest : null,
    })
  }

  return { eventType, alliances: result }
}

/**
 * Load only the ATTENDING members (will_attend = true) across the given active
 * event ids, each annotated with its availability row and source event id.
 */
export async function loadAttendingKvkMembers(activeEventIds: string[]) {
  if (!activeEventIds.length) {
    console.log('[KVK] loadAttendingKvkMembers: no active event ids → 0 attending members')
    return []
  }
  const svc = createServiceClient()
  // IMPORTANT: `members` has TWO foreign keys to `alliances` (alliance_id and
  // previous_alliance_id), so a bare `alliances(...)` embed is AMBIGUOUS and makes
  // PostgREST reject the whole query (data=null → 0 members). Disambiguate with the
  // explicit FK name, exactly as the rest of the codebase does.
  const { data: avail, error } = await svc
    .from('event_availability')
    .select(`
      *,
      members (
        *,
        alliances!members_alliance_id_fkey (name, tag),
        member_scores (*),
        member_combat_stats (troop_type_primary, id),
        member_heroes (id)
      )
    `)
    .in('event_id', activeEventIds)
    .eq('will_attend', true)

  if (error) {
    console.error('[KVK] loadAttendingKvkMembers query FAILED:', error.message, error.details || '', error.hint || '')
    return []
  }

  const rows = avail || []
  const withMember = rows.filter(a => a.members)
  console.log(
    `[KVK] loadAttendingKvkMembers eventIds=${JSON.stringify(activeEventIds)} ` +
    `attendanceRows=${rows.length} resolvedMembers=${withMember.length} ` +
    `droppedMissingMember=${rows.length - withMember.length}`
  )

  return withMember.map(a => ({ ...a.members, _availability: a, _eventId: a.event_id }))
}
