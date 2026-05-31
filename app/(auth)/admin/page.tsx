// @ts-nocheck
﻿// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Star, Calendar, BarChart3, Globe } from 'lucide-react'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/dashboard')

  const adminSections = [
    { href: '/admin/heroes', icon: Star, label: 'Hero Database', desc: 'Add, edit, and manage the hero roster' },
    { href: '/admin/events', icon: Calendar, label: 'Event Types', desc: 'Configure event rules and scoring weights' },
    { href: '/admin/scoring', icon: BarChart3, label: 'Scoring Formulas', desc: 'Tune combat score weights per role' },
    { href: '/admin/kingdoms', icon: Globe, label: 'Kingdoms', desc: 'Manage kingdoms and alliances' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Shield className="text-amber-500" size={24} />
        System Admin
      </h1>
      <div className="grid sm:grid-cols-2 gap-4">
        {adminSections.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-amber-500/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon size={18} className="text-amber-500" />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

