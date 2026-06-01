// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, ExternalLink } from 'lucide-react'
import { VoiceChannelManager } from '@/components/kvk/VoiceChannelManager'
import { notFound, redirect } from 'next/navigation'

const CHANNEL_LABELS: Record<string, string> = {
  battle_leader: 'Battle Leader',
  castle: 'Castle',
  north_turret: 'North Turret',
  east_turret: 'East Turret',
  south_turret: 'South Turret',
  west_turret: 'West Turret',
  general: 'General',
}

export default async function VoiceChannelsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: kingdom } = await supabase
    .from('kingdoms')
    .select('name')
    .eq('id', params.id)
    .single()
  if (!kingdom) notFound()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'member'
  const canManage = ['r5', 'kingdom_leader', 'system_admin'].includes(role)
  const canSeeBattleLeader = ['r5', 'r4', 'kingdom_leader', 'system_admin'].includes(role)

  const { data: channels } = await supabase
    .from('kvk_voice_channels')
    .select('*')
    .eq('kingdom_id', params.id)
    .eq('is_active', true)

  const visibleChannels = (channels || []).filter(c => {
    if (c.channel_name === 'battle_leader') return canSeeBattleLeader
    return true
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Mic className="text-amber-500" size={24} />
        Voice Channels — {kingdom.name}
      </h1>

      {/* Managers (R5/admin): the 7 configuration slots */}
      {canManage ? (
        <VoiceChannelManager kingdomId={params.id} channels={channels || []} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Join a Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {visibleChannels.filter(c => c.discord_invite_url).map(channel => (
                <div key={channel.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                  <span className="font-medium">{CHANNEL_LABELS[channel.channel_name] || channel.channel_name.replace(/_/g, ' ')}</span>
                  <a
                    href={channel.discord_invite_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink size={14} />
                    Join
                  </a>
                </div>
              ))}
              {visibleChannels.filter(c => c.discord_invite_url).length === 0 && (
                <p className="text-slate-400 text-sm">No voice channels configured yet. Ask your R5 to set them up.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
