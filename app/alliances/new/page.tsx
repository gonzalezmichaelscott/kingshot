// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewAllianceForm } from '@/components/alliance/NewAllianceForm'

export default async function NewAlliancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: kingdoms } = await supabase
    .from('kingdoms')
    .select('id, name, server_number')
    .order('server_number')

  return (
    <div className="min-h-screen bg-slate-950 flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-2">Register Your Alliance</h1>
        <p className="text-slate-400 text-sm mb-6">
          Pick your kingdom, enter your alliance name and tag. You'll be set as R5 automatically.
        </p>
        <NewAllianceForm kingdoms={kingdoms || []} />
      </div>
    </div>
  )
}
