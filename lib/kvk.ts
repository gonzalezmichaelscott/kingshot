// @ts-nocheck
/**
 * Shared helpers for the per-kingdom KVK Command hub.
 *
 * The KVK hub combines members from ALL kvk_enabled alliances in a kingdom.
 * Battle-plan assignments are anchored to a single "Kingdom KVK Castle Battle"
 * event so they can live in the existing event_assignments table. Because that
 * event belongs to one alliance but the data spans the whole kingdom, all reads
 * here go through the service client — callers MUST verify access first.
 */
import { createServiceClient } from '@/lib/supabase/server'

/** The six holdable structures on the KVK battlefield, with the member_scores
 *  column used to rank recommended players and the matching voice channel. */
export const KVK_STRUCTURES = [
  { key: 'castle', label: 'Castle', scoreField: 'castle_score', voiceChannel: 'castle' },
  { key: 'north_turret', label: 'North Turret', scoreField: 'turret_score', voiceChannel: 'north_turret' },
  { key: 'east_turret', label: 'East Turret', scoreField: 'turret_score', voiceChannel: 'east_turret' },
  { key: 'south_turret', label: 'South Turret', scoreField: 'turret_score', voiceChannel: 'south_turret' },
  { key: 'west_turret', label: 'West Turret', scoreField: 'turret_score', voiceChannel: 'west_turret' },
  { key: 'support', label: 'Support', scoreField: 'support_score', voiceChannel: 'general' },
] as const

/** The role stored in event_assignments when a player is manually placed on a structure. */
export function roleForSquad(squad: string): string {
  if (squad === 'castle') return 'castle'
  if (squad === 'support') return 'support'
  return 'turret_joiner'
}

/**
 * Find (and optionally create) the single anchor event used to store kingdom-wide
 * KVK assignments. Returns the event joined with its event_type plus the list of
 * kvk_enabled alliance ids in the kingdom.
 */
export async function findOrCreateKingdomKvkEvent(kingdomId: string, create = false) {
  const supabase = createServiceClient()

  const { data: alliances } = await supabase
    .from('alliances')
    .select('id')
    .eq('kingdom_id', kingdomId)
    .eq('kvk_enabled', true)

  const allianceIds = (alliances || []).map(a => a.id)

  const { data: eventType } = await supabase
    .from('event_types')
    .select('*')
    .eq('slug', 'kvk_castle_battle')
    .single()

  if (allianceIds.length === 0) return { event: null, allianceIds, eventType }

  let event: any = null
  if (eventType) {
    const { data: existing } = await supabase
      .from('events')
      .select('*, event_types(*)')
      .in('alliance_id', allianceIds)
      .eq('event_type_id', eventType.id)
      .order('battle_start_utc', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
    event = existing?.[0] || null
  }

  if (!event && create && eventType) {
    const { data: created } = await supabase
      .from('events')
      .insert({
        alliance_id: allianceIds[0],
        event_type_id: eventType.id,
        name: 'Kingdom KVK Castle Battle',
        status: 'planning',
      })
      .select('*, event_types(*)')
      .single()
    event = created
  }

  return { event, allianceIds, eventType }
}
