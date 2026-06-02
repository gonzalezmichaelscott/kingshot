// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FileText } from 'lucide-react'
import { requireAllianceAccess, canManageAlliance } from '@/lib/access'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { TemplatesClient } from '@/components/templates/TemplatesClient'

// Shown (and seeded) on first load when an alliance has no templates yet.
const EXAMPLE_TEMPLATES = [
  {
    title: 'KVK Attendance Request',
    category: 'KVK',
    body: 'KVK is coming up! Please go to [APP LINK] and mark your attendance and available hours for the Castle Battle event. We need accurate attendance to build the best battle plan.',
  },
  {
    title: 'Stats Update Reminder',
    category: 'Maintenance',
    body: 'Please update your stats at your profile link. We need current power, march size, and troop data to optimize our battle plans.',
  },
  {
    title: 'Swordland Reminder',
    category: 'Events',
    body: 'Swordland Showdown is coming up! Please select your Legion (1 or 2) at your profile link and confirm your attendance.',
  },
]

export default async function TemplatesPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { user, profile } = await requireAllianceAccess(supabase, params.id)

  const { data: alliance } = await supabase
    .from('alliances')
    .select('name, tag, kingdoms(id, name, server_number)')
    .eq('id', params.id)
    .single()

  if (!alliance) notFound()
  const kingdom = (alliance as any)?.kingdoms
  const canManage = canManageAlliance(profile?.role)

  let { data: templates } = await supabase
    .from('message_templates')
    .select('id, title, body, category')
    .eq('alliance_id', params.id)
    .order('created_at', { ascending: true })

  // Seed the example templates the first time a manager visits an empty list.
  if ((!templates || templates.length === 0) && canManage) {
    const { data: seeded } = await supabase
      .from('message_templates')
      .insert(EXAMPLE_TEMPLATES.map(t => ({ ...t, alliance_id: params.id, created_by: user.id })))
      .select('id, title, body, category')
    if (seeded && seeded.length) templates = seeded
  }

  const breadcrumbs = [
    { label: 'Kingdoms', href: '/kingdoms' },
    ...(kingdom ? [{ label: `${kingdom.name}${kingdom.server_number ? ` #${kingdom.server_number}` : ''}`, href: `/kingdoms/${kingdom.id}` }] : []),
    { label: `[${alliance.tag}] ${alliance.name}`, href: `/alliances/${params.id}` },
    { label: 'Templates' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbs} />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="text-amber-500" size={24} />
          Message Templates
        </h1>
        <p className="text-slate-400 text-sm mt-1">Save and reuse common messages. Click Copy to grab the full message for in-game chat or Discord.</p>
      </div>

      <TemplatesClient allianceId={params.id} templates={templates || []} canManage={canManage} />
    </div>
  )
}
