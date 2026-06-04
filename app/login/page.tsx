// @ts-nocheck
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'
import { Sword, ArrowRight, ShieldAlert } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const suspended = searchParams?.error === 'suspended'

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-8">
        <Sword className="text-amber-500 w-9 h-9" />
        <h1 className="text-2xl font-bold text-amber-500">KS Command</h1>
      </div>

      <div className="w-full max-w-sm">
        {suspended && (
          <div className="mb-4 bg-red-950/40 border border-red-800/60 rounded-xl px-4 py-3 text-sm text-red-200">
            This account has been suspended due to a terms of service violation. If you believe this is an error, contact the administrator.
          </div>
        )}

        <LoginForm />

        {/* Learn more about KS Command */}
        <Link
          href="/welcome"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm text-amber-500 hover:text-amber-400"
        >
          Learn more about KS Command <ArrowRight size={15} />
        </Link>

        {/* Report a falsely-claimed profile */}
        <Link
          href="/report-impersonation"
          className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
        >
          <ShieldAlert size={13} /> Report account impersonation
        </Link>
      </div>
    </div>
  )
}
