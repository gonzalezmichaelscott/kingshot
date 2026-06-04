// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, Shield, Sword, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddAllianceForm } from '@/components/alliance/AddAllianceForm'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { BackButton } from '@/components/nav/BackButton'
import { KingdomAgeBar } from '@/components/kingdoms/KingdomAgeBar'

export default async function KingdomPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    : { data: null }

  const { data: kingdom } = await supabase
    .from('kingdoms')
    .select('*, alliances(id, name, tag, kvk_enabled)')
    .eq('id', params.id)
    .single()

  if (!kingdom) notFound()

  // Alliance creation now flows through onboarding + System Admin approval.
  // Direct creation here is System Admin only (matches the alliances RLS write policy).
  const canAddAlliance = profile?.role === 'system_admin'
  // Leadership Chat link — R4/R5/system_admin only (FIX 4)
  const canLeadershipChat = ['r4', 'r5', 'system_admin'].includes(profile?.role || '')

  const alliances = kingdom.alliances as any[]

  const breadcrumbs = [
    { label: 'Kingdoms', href: '/kingdoms' },
    { label: `${kingdom.name}${kingdom.server_number ? ` #${kingdom.server_number}` : ''}` },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbs} />
      <BackButton href="/kingdoms" />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="text-amber-500" size={24} />
          {kingdom.name}
          {kingdom.server_number && <span className="text-slate-400 font-normal">#{kingdom.server_number}</span>}
        </h1>
        {kingdom.server_number && <KingdomAgeBar kingdomNumber={kingdom.server_number} />}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href={`/kingdoms/${kingdom.id}/kvk`}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm">
          <Sword size={16} />
          KVK Coordination
        </Link>
        {canLeadershipChat && (
          <Link href={`/kingdoms/${kingdom.id}/leadership-chat`}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-medium px-4 py-2 rounded-lg text-sm">
            <ShieldCheck size={16} className="text-amber-500" />
            Leadership Chat
          </Link>
        )}
      </div>

      {canAddAlliance && (
        <AddAllianceForm kingdomId={kingdom.id} kingdomName={kingdom.name} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} className="text-amber-500" />
            Alliances ({alliances?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alliances?.map(a => (
              <Link key={a.id} href={`/alliances/${a.id}`}>
                <div className="bg-slate-800 hover:bg-slate-700 rounded-lg p-3 transition-colors">
                  <p className="font-semibold text-amber-400">[{a.tag}]</p>
                  <p className="text-sm text-slate-300">{a.name}</p>
                  {a.kvk_enabled && (
                    <span className="text-xs text-green-400 mt-1 block">KVK Active</span>
                  )}
                </div>
              </Link>
            ))}
            {(!alliances || alliances.length === 0) && (
              <p className="text-slate-400 text-sm col-span-3">No alliances yet. Add one above.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
