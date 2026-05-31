// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'
import Link from 'next/link'

export default async function JoinAlliancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('alliance_id, role')
    .eq('id', user.id)
    .single()

  // If they already have an alliance, send them to dashboard
  if (profile?.alliance_id) redirect('/dashboard')

  return (
    <div className="max-w-lg mx-auto mt-20 text-center space-y-6">
      <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
        <Shield className="text-amber-500" size={32} />
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2">You're not in an alliance yet</h1>
        <p className="text-slate-400">
          Ask your R5 or alliance leader to add you to the roster, or register a new alliance if you're starting one.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/alliances/new"
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-6 py-3 rounded-lg"
        >
          Register an Alliance
        </Link>
        <Link
          href="/kingdoms"
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-6 py-3 rounded-lg"
        >
          Browse Kingdoms
        </Link>
      </div>
    </div>
  )
}
