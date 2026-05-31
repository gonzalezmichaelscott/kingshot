// @ts-nocheck
﻿// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calculateRoleScores, calculateHeroScore } from '@/lib/scoring'
import { z } from 'zod'

const schema = z.object({ allianceId: z.string().uuid() })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { allianceId } = schema.parse(body)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Load a sample event type to get default scoring weights
    const serviceClient = createServiceClient()
    const { data: eventType } = await serviceClient
      .from('event_types')
      .select('scoring_weights')
      .eq('slug', 'swordland_showdown')
      .single()

    const weights = (eventType?.scoring_weights as Record<string, Record<string, number>>) || {}

    // Load all members with their data
    const { data: members } = await serviceClient
      .from('members')
      .select('id, power, troop_count, march_size, rally_capacity, member_combat_stats(*), member_heroes(*, heroes(generation))')
      .eq('alliance_id', allianceId)

    if (!members) return NextResponse.json({ updated: 0 })

    let updated = 0
    for (const m of members) {
      const stats = (m.member_combat_stats as any)?.[0]
      const heroData = (m.member_heroes as any[])?.map((mh: any) => ({
        hero: { generation: mh.heroes?.generation || 1 },
        starLevel: mh.star_level || 0,
        widgetLevel: mh.widget_level || 0,
        expeditionSkillLevels: mh.expedition_skill_levels || {},
      })) || []

      const profile = {
        id: m.id,
        power: m.power || 0,
        troopCount: m.troop_count || 0,
        marchSize: m.march_size || 0,
        rallyCapacity: m.rally_capacity || 0,
        primaryTroopType: (stats?.troop_type_primary || 'mixed') as any,
        heroes: heroData,
        combatStats: {
          infantryAttack: stats?.infantry_attack || 0,
          infantryDefense: stats?.infantry_defense || 0,
          infantryHealth: stats?.infantry_health || 0,
          infantryLethality: stats?.infantry_lethality || 0,
          cavalryAttack: stats?.cavalry_attack || 0,
          cavalryDefense: stats?.cavalry_defense || 0,
          cavalryHealth: stats?.cavalry_health || 0,
          cavalryLethality: stats?.cavalry_lethality || 0,
          archerAttack: stats?.archer_attack || 0,
          archerDefense: stats?.archer_defense || 0,
          archerHealth: stats?.archer_health || 0,
          archerLethality: stats?.archer_lethality || 0,
        },
      }

      const scores = calculateRoleScores(profile, weights)

      await serviceClient.from('member_scores').upsert({
        member_id: m.id,
        overall_score: scores.overall,
        rally_leader_score: scores.rallyLeader,
        joiner_score: scores.joiner,
        castle_score: scores.castle,
        turret_score: scores.turret,
        support_score: scores.support,
        defender_score: scores.defender,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'member_id' })

      updated++
    }

    return NextResponse.json({ updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

