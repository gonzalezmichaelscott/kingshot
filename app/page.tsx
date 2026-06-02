// @ts-nocheck
﻿// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { Sword, Shield, Users, Calendar, ArrowRight } from 'lucide-react'

export default async function LandingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="flex items-center gap-3 mb-6">
          <Sword className="text-amber-500 w-10 h-10" />
          <h1 className="text-3xl font-bold text-amber-500">Kingshot Hub</h1>
        </div>
        <p className="text-slate-300 text-lg max-w-md mb-2">
          Alliance Coordination Platform
        </p>
        <p className="text-slate-400 text-sm max-w-sm mb-10">
          Optimize your battle formations, coordinate KVK events, and generate AI-powered battle plans for your alliance.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-10">
          {[
            { icon: Shield, label: 'Battle Planning', desc: 'AI-generated formations for Swordland, KVK & Tri Alliance' },
            { icon: Users, label: 'Member Management', desc: 'Track power, heroes, and combat stats across your roster' },
            { icon: Calendar, label: 'Event Coordination', desc: 'Availability tracking, squad assignments, and rotation plans' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-left">
              <Icon className="text-amber-500 mb-2" size={20} />
              <p className="font-semibold text-sm mb-1">{label}</p>
              <p className="text-slate-400 text-xs">{desc}</p>
            </div>
          ))}
        </div>

        {/* Login */}
        <div className="w-full max-w-sm">
          <LoginForm />
          <Link
            href="/welcome"
            className="mt-5 flex items-center justify-center gap-1.5 text-sm text-amber-500 hover:text-amber-400"
          >
            Learn more about KS Command <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}

