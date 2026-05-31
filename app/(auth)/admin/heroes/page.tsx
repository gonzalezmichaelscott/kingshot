// @ts-nocheck
﻿// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'
import { HeroAdminTable } from '@/components/admin/HeroAdminTable'

export default async function AdminHeroesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/admin')

  const { data: heroes } = await supabase
    .from('heroes')
    .select('*')
    .order('generation')
    .order('name')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Star className="text-amber-500" size={24} />
        Hero Database
      </h1>
      <HeroAdminTable heroes={heroes || []} />
    </div>
  )
}

