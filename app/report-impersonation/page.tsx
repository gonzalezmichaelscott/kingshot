// @ts-nocheck
import Link from 'next/link'
import type { Metadata } from 'next'
import { Sword, ArrowLeft } from 'lucide-react'
import { ReportImpersonationForm } from '@/components/impersonation/ReportImpersonationForm'

export const metadata: Metadata = {
  title: 'Report Impersonation — KS Command',
  description: 'Report a falsely claimed Kingshot profile for System Admin review.',
}

// Public — no login required (see middleware publicPaths).
export default function ReportImpersonationPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sword className="text-amber-500" size={22} />
            <span className="font-bold text-amber-500">KS Command</span>
          </div>
          <Link href="/login" className="text-sm text-slate-400 hover:text-amber-400 flex items-center gap-1">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
        <ReportImpersonationForm />
      </div>
    </div>
  )
}
