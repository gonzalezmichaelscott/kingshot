// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sword, Shield } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function KvkPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: kingdom } = await supabase
    .from('kingdoms')
    .select('*, alliances(id, name, tag, kvk_enabled)')
    .eq('id', params.id)
    .single()

  if (!kingdom) notFound()

  const alliances = (kingdom.alliances as any[])?.filter(a => a.kvk_enabled) || []

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .single()

  const canSeeVoice = ['r5', 'r4', 'kingdom_leader', 'system_admin'].includes(profile?.role || '')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Sword className="text-amber-500" size={24} />
        KVK — {kingdom.name}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Participating Alliances</CardTitle>
        </CardHeader>
        <CardContent>
          {alliances.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {alliances.map((a: any) => (
                <div key={a.id} className="bg-slate-800 rounded-lg p-3">
                  <p className="font-semibold text-amber-400">[{a.tag}]</p>
                  <p className="text-sm text-slate-300">{a.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No alliances have KVK enabled for this kingdom.</p>
          )}
        </CardContent>
      </Card>

      {canSeeVoice && (
        <Card>
          <CardHeader>
            <CardTitle>Voice Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/kingdoms/${params.id}/kvk/voice`} className="text-amber-500 hover:text-amber-400 text-sm">
              Manage Voice Channel Links →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
