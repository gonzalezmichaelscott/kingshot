// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ChatRoom } from '@/components/chat/ChatRoom'

export default async function ChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: alliance } = await supabase.from('alliances').select('name, tag').eq('id', params.id).single()
  if (!alliance) notFound()

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
    <ChatRoom
      allianceId={params.id}
      allianceName={`[${alliance.tag}] ${alliance.name}`}
      initialMessages={(messages || []).reverse()}
      currentUser={profile}
    />
  )
}
