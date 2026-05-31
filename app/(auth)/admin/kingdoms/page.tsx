// @ts-nocheck
﻿// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Globe } from 'lucide-react'
import { KingdomAdminPanel } from '@/components/admin/KingdomAdminPanel'

export default async function AdminKingdomsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/admin')

  const { data: kingdoms } = await supabase
    .from('kingdoms')
    .select('*, alliances(id, name, tag, kvk_enabled)')
    .order('server_number')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Globe className="text-amber-500" size={24} />
        Kingdom Management
      </h1>
      <KingdomAdminPanel kingdoms={kingdoms || []} />
    </div>
  )
}

