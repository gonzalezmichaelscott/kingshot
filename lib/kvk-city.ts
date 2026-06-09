// @ts-nocheck
// FEATURE 3 — server helpers for the Castle Positioning Map.
//
// The kingdom KVK hub aggregates several alliance events, but kvk_city_assignments
// is keyed by a single event_id. We anchor the kingdom's map to a deterministic
// "primary" event (the lowest active event id) so the page, the API and the
// auto-populate all agree on where assignments live.
import { createServiceClient } from '@/lib/supabase/server'
import { getKvkContext } from '@/lib/kvk'
import { slotQueueForStructure, ALL_SLOTS_NEAREST_FIRST } from '@/lib/castle-map'

/** Deterministic anchor event for a kingdom's shared city map. */
export function primaryEventIdFrom(activeEventIds: string[]): string | null {
  if (!activeEventIds || activeEventIds.length === 0) return null
  return [...activeEventIds].sort()[0]
}

export async function loadCityAssignments(eventId: string | null) {
  if (!eventId) return []
  const svc = createServiceClient()
  const { data } = await svc
    .from('kvk_city_assignments')
    .select('member_id, slot_position')
    .eq('event_id', eventId)
  return data || []
}

const STRUCTURE_ORDER = ['castle-1', 'castle-2', 'north_turret', 'east_turret', 'south_turret', 'west_turret']

function groupKey(squad: string, rallyNumber: number | null): string {
  if (squad === 'castle') return `castle-${rallyNumber === 2 ? 2 : 1}`
  return squad
}

/**
 * Re-derive city slot positions from the stored battle-plan assignments. Leaders
 * are placed on the front-line slot of their structure's preferred face; joiners
 * fill outward (largest march first). Overflow spills to the nearest free slot
 * anywhere; anyone who doesn't fit stays in the Support list (no slot row).
 * Overwrites the kingdom's primary-event city assignments.
 */
export async function autoPopulateCityAssignments(kingdomId: string): Promise<{ eventId: string | null; count: number }> {
  const svc = createServiceClient()
  const { alliances } = await getKvkContext(kingdomId)
  const activeEventIds = alliances.filter(a => a.activeEvent).map(a => a.activeEvent.id)
  const eventId = primaryEventIdFrom(activeEventIds)
  if (!eventId) return { eventId: null, count: 0 }

  // Pull assignments + each member's march size (for ordering) across active events.
  const { data: rows } = await svc
    .from('event_assignments')
    .select('member_id, squad, role, rally_number, is_backup, members(id, march_size)')
    .in('event_id', activeEventIds)

  const assignments = (rows || []).filter(a => a.member_id && !a.is_backup && a.squad && a.squad !== 'support')

  // Build ordered groups: leader first, then joiners by march desc.
  const groups: Record<string, { leaders: any[]; joiners: any[] }> = {}
  for (const a of assignments) {
    const key = groupKey(a.squad, a.rally_number)
    if (!STRUCTURE_ORDER.includes(key)) continue
    ;(groups[key] ||= { leaders: [], joiners: [] })
    const march = Number((a.members as any)?.march_size) || 0
    const entry = { member_id: a.member_id, squad: a.squad, rally_number: a.rally_number, march }
    if ((a.role || '').toLowerCase().includes('leader')) groups[key].leaders.push(entry)
    else groups[key].joiners.push(entry)
  }

  const occupied = new Set<string>()
  const placements: { member_id: string; slot_position: string }[] = []

  const placeInto = (memberId: string, faceQueue: string[]) => {
    // Prefer the structure's own face, then any nearest-free slot globally.
    for (const id of faceQueue) {
      if (!occupied.has(id)) { occupied.add(id); placements.push({ member_id: memberId, slot_position: id }); return true }
    }
    for (const id of ALL_SLOTS_NEAREST_FIRST) {
      if (!occupied.has(id)) { occupied.add(id); placements.push({ member_id: memberId, slot_position: id }); return true }
    }
    return false // map full → leave for the Support list
  }

  for (const key of STRUCTURE_ORDER) {
    const g = groups[key]
    if (!g) continue
    // Leader takes the centred slot of the structure's target row; joiners fill
    // outward along that face, then spill globally to the nearest free slot.
    const faceQueue = slotQueueForStructure(key)
    const ordered = [
      ...g.leaders,
      ...g.joiners.sort((a, b) => (b.march || 0) - (a.march || 0)),
    ]
    for (const m of ordered) placeInto(m.member_id, faceQueue)
  }

  // Overwrite this event's city assignments atomically-ish.
  await svc.from('kvk_city_assignments').delete().eq('event_id', eventId)
  if (placements.length > 0) {
    await svc.from('kvk_city_assignments').insert(
      placements.map(p => ({ event_id: eventId, member_id: p.member_id, slot_position: p.slot_position }))
    )
  }
  return { eventId, count: placements.length }
}
