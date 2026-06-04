// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// FEATURE 2 — remove an account from the blacklist (System Admin only).
const schema = z.object({ id: z.string().uuid() })

export async function DELETE(request: NextRequest) {
  let id: string
  try {
    ({ id } = schema.parse(await request.json()))
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const authed = createClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: actor } = await authed.from('user_profiles').select('role').eq('id', user.id).single()
  if (actor?.role !== 'system_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const { error } = await svc.from('blacklisted_accounts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
