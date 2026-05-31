// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { requireAllianceAccess } from '@/lib/access'

export default async function ChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  await requireAllianceAccess(supabase, params.id)

  const { data: alliance } = await supabase
    .from('alliances')
    .select('name, tag, kingdoms(id, name, server_number)')
    .eq('id', params.id)
    .single()
  if (!alliance) notFound()

  const kingdom = (alliance as any).kingdoms
  const breadcrumbs = [
    { label: 'Kingdoms', href: '/kingdoms' },
    ...(kingdom ? [{ label: `${kingdom.name}${kingdom.server_number ? ` #${kingdom.server_number}` : ''}`, href: `/kingdoms/${kingdom.id}` }] : []),
    { label: `[${alliance.tag}] ${alliance.name}`, href: `/alliances/${params.id}` },
    { label: 'Chat' },
  ]

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user!.id).single()

  // Load last 50 messages
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*, user_profiles(display_name, role)')
    .eq('alliance_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-3">
      <Breadcrumbs items={breadcrumbs} />
      <ChatRoom
        allianceId={params.id}
        allianceName={`[${alliance.tag}] ${alliance.name}`}
        initialMessages={(messages || []).reverse()}
        currentUser={profile}
      />
    </div>
  )
}
