// @ts-nocheck
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'
import { Sword, ArrowRight } from 'lucide-react'

export default async function LoginPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-8">
        <Sword className="text-amber-500 w-9 h-9" />
        <h1 className="text-2xl font-bold text-amber-500">KS Command</h1>
      </div>

      <div className="w-full max-w-sm">
        <LoginForm />

        {/* Learn more about KS Command */}
        <Link
          href="/welcome"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm text-amber-500 hover:text-amber-400"
        >
          Learn more about KS Command <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}
