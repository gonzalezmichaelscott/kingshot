// @ts-nocheck
﻿// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewAllianceForm } from '@/components/alliance/NewAllianceForm'

export default async function NewAlliancePage() {
  const supabase = createClient()
  const { data: kingdoms } = await supabase.from('kingdoms').select('id, name, server_number').order('server_number')

  return (
    <div className="max-w-lg mx-auto mt-10 p-4">
      <h1 className="text-2xl font-bold mb-6">Register Alliance</h1>
      <NewAllianceForm kingdoms={kingdoms || []} />
    </div>
  )
}

