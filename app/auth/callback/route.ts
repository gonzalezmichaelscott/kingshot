// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // FEATURE 2 — blacklist enforcement: after a successful login, block any
      // account whose email is on the blacklist. The blacklist table is readable
      // only by admins, so this must use the service client.
      const email = (data.user.email || '').toLowerCase()
      if (email) {
        const svc = createServiceClient()
        const { data: blocked } = await svc
          .from('blacklisted_accounts')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        if (blocked) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?error=suspended`)
        }
      }

      // Create profile if first login
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!profile) {
        await supabase.from('user_profiles').insert({
          id: data.user.id,
          display_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
          role: 'member',
        })
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
