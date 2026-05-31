// @ts-nocheck
﻿// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, Globe } from 'lucide-react'
import Link from 'next/link'

export default async function KingdomsPage() {
  const supabase = createClient()
  const { data: kingdoms } = await supabase
    .from('kingdoms')
    .select('*, alliances(id, name, tag)')
    .order('server_number')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="text-amber-500" size={24} />
          Kingdoms
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kingdoms?.map(k => (
          <Link key={k.id} href={`/kingdoms/${k.id}`}>
            <Card className="hover:border-amber-500/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe size={16} className="text-amber-500" />
                  {k.name}
                  {k.server_number && (
                    <span className="text-slate-500 text-sm font-normal">#{k.server_number}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400">
                  {(k.alliances as any[])?.length ?? 0} alliances
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(k.alliances as any[])?.slice(0, 5).map((a: any) => (
                    <span key={a.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      [{a.tag}]
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(!kingdoms || kingdoms.length === 0) && (
          <p className="text-slate-400 col-span-3">No kingdoms found.</p>
        )}
      </div>
    </div>
  )
}

