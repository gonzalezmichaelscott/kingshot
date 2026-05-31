// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, Shield, Sword } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function KingdomPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: kingdom } = await supabase
    .from('kingdoms')
    .select('*, alliances(id, name, tag, kvk_enabled)')
    .eq('id', params.id)
    .single()

  if (!kingdom) notFound()

  const alliances = kingdom.alliances as any[]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="text-amber-500" size={24} />
          {kingdom.name}
          {kingdom.server_number && <span className="text-slate-400 font-normal">#{kingdom.server_number}</span>}
        </h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href={`/kingdoms/${kingdom.id}/kvk`}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm">
          <Sword size={16} />
          KVK Coordination
        </Link>
      </div>

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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
