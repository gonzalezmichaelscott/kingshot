// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { calculateEffectiveTroopStrength, detectPrimaryTroopType } from '@/lib/scoring'

const troopTierSchema = z.record(z.number().int().min(0))
const troopDataSchema = z
  .object({
    infantry: troopTierSchema.optional(),
    cavalry: troopTierSchema.optional(),
    archer: troopTierSchema.optional(),
  })
  .optional()

const schema = z.object({
  access_token: z.string(),
  power: z.number().int().min(0).optional(),
  troop_count: z.number().int().min(0).optional(),
  march_size: z.number().int().min(0).optional(),
  rally_capacity: z.number().int().min(0).optional(),
  timezone: z.string().optional(),
  kvk_willing_to_move: z.boolean().optional(),
  troop_data: troopDataSchema,
})

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, troop_data, ...rest } = schema.parse(body)

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (rest.power !== undefined) updates.power = rest.power
    if (rest.troop_count !== undefined) updates.troop_count = rest.troop_count
    if (rest.march_size !== undefined) updates.march_size = rest.march_size
    if (rest.rally_capacity !== undefined) updates.rally_capacity = rest.rally_capacity
    if (rest.timezone !== undefined) updates.timezone = rest.timezone
    if (rest.kvk_willing_to_move !== undefined) {
      updates.kvk_willing_to_move = rest.kvk_willing_to_move
      // Self-set via the member's own access token — clear any "set by leader" marker.
      updates.kvk_willing_set_by = null
    }

    if (troop_data !== undefined) {
      updates.troop_data = troop_data
      // Auto-calculate troop_count as sum of all tier values
      let computed = 0
      for (const typeData of Object.values(troop_data ?? {})) {
        for (const v of Object.values(typeData ?? {})) {
          computed += v || 0
        }
      }
      updates.troop_count = computed
    }

    const supabase = createServiceClient()

    // Fetch the member id first (needed for combat_stats upsert)
    const { data: member, error: fetchErr } = await supabase
      .from('members')
      .select('id, member_combat_stats(id, troop_type_primary)')
      .eq('access_token', access_token)
      .single()

    if (fetchErr || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('access_token', access_token)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // When troop_data changes, auto-update troop_type_primary in member_combat_stats
    if (troop_data !== undefined) {
      const primaryType = detectPrimaryTroopType(troop_data as any)
      const existingStats = (member.member_combat_stats as any[])?.[0]

      if (existingStats?.id) {
        await supabase
          .from('member_combat_stats')
          .update({ troop_type_primary: primaryType })
          .eq('id', existingStats.id)
      } else {
        // Create a minimal combat stats row so primary_troop_type is stored
        await supabase
          .from('member_combat_stats')
          .insert({ member_id: member.id, troop_type_primary: primaryType })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bad request' }, { status: 400 })
  }
}
