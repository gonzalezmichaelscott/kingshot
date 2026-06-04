// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { z } from 'zod'

// FEATURE 2 — System Admin actions on an impersonation report.
const schema = z.object({
  report_id: z.string().uuid(),
  action: z.enum(['investigating', 'restore', 'blacklist', 'dismiss']),
  admin_note: z.string().max(4000).optional().default(''),
  blacklist_user_id: z.boolean().optional().default(false),
})

function stamp(note: string, existing: string | null): string {
  const ts = new Date().toISOString()
  const line = note ? `[${ts}] ${note}` : `[${ts}]`
  return existing ? `${existing}\n${line}` : line
}

export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message || 'Invalid request' }, { status: 400 })
  }

  const authed = createClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: actor } = await authed.from('user_profiles').select('role').eq('id', user.id).single()
  if (actor?.role !== 'system_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const { data: report } = await svc.from('impersonation_reports').select('*').eq('id', body.report_id).maybeSingle()
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  // ---- Mark investigating ----
  if (body.action === 'investigating') {
    await svc.from('impersonation_reports').update({
      status: 'investigating',
      admin_notes: stamp(body.admin_note || 'Marked investigating.', report.admin_notes),
    }).eq('id', report.id)
    await sendEmail({
      to: report.reporter_email,
      subject: 'KS Command — your impersonation report is under review',
      text: 'We are investigating your report. The System Admin will verify your identity via in-game private message before taking any action.',
    })
    return NextResponse.json({ ok: true })
  }

  // ---- Dismiss (admin note required) ----
  if (body.action === 'dismiss') {
    if (!body.admin_note?.trim()) {
      return NextResponse.json({ error: 'An admin note is required to dismiss a report.' }, { status: 400 })
    }
    await svc.from('impersonation_reports').update({
      status: 'resolved_dismissed',
      admin_notes: stamp(`Dismissed: ${body.admin_note}`, report.admin_notes),
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', report.id)
    return NextResponse.json({ ok: true })
  }

  // Both restore + blacklist need the suspected member + its current holder.
  const memberId = report.suspected_member_id
  if (!memberId) {
    return NextResponse.json({ error: 'No member record is linked to this report.' }, { status: 400 })
  }
  const { data: member } = await svc.from('members').select('id, linked_user_id').eq('id', memberId).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Suspected member record not found.' }, { status: 404 })
  const holderUserId = member.linked_user_id

  // ---- Blacklist the current account holder ----
  if (body.action === 'blacklist') {
    if (!holderUserId) {
      return NextResponse.json({ error: 'This profile is not currently linked to any account.' }, { status: 400 })
    }
    let holderEmail: string | null = null
    try {
      const { data: holder } = await svc.auth.admin.getUserById(holderUserId)
      holderEmail = holder?.user?.email || null
    } catch { /* ignore */ }
    if (!holderEmail) {
      return NextResponse.json({ error: 'Could not resolve the account holder email.' }, { status: 400 })
    }
    await svc.from('blacklisted_accounts').upsert({
      email: holderEmail.toLowerCase(),
      user_id: body.blacklist_user_id ? holderUserId : null,
      reason: 'Account impersonation',
      blacklisted_by: user.id,
    }, { onConflict: 'email', ignoreDuplicates: true })
    await svc.from('impersonation_reports').update({
      admin_notes: stamp(`Blacklisted account holder ${holderEmail}.`, report.admin_notes),
    }).eq('id', report.id)
    return NextResponse.json({ ok: true })
  }

  // ---- Restore Profile (atomic series of steps) ----
  // 1) Unlink the member record.
  await svc.from('members').update({ linked_user_id: null, updated_at: new Date().toISOString() }).eq('id', memberId)
  // 2) Remove all profile links for this member.
  await svc.from('user_member_profiles').delete().eq('member_id', memberId)
  // 3) Detach any user whose ACTIVE profile was this member.
  await svc.from('user_profiles').update({ active_member_id: null, alliance_id: null }).eq('active_member_id', memberId)
  // 5 + 6) Resolve the report with a timestamped note.
  await svc.from('impersonation_reports').update({
    status: 'resolved_restored',
    admin_notes: stamp(body.admin_note ? `Restored: ${body.admin_note}` : 'Profile restored and made available to claim.', report.admin_notes),
    resolved_by: user.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', report.id)
  await sendEmail({
    to: report.reporter_email,
    subject: 'KS Command — your profile has been restored',
    text: 'After verification, the profile you reported has been unlinked from the other account and is available to claim again. Use your self-service link or Player ID search to re-claim it.',
  })

  return NextResponse.json({ ok: true })
}
