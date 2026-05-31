'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function BackButton({ href }: { href: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(href)}
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4"
    >
      <ArrowLeft size={15} />
      Back
    </button>
  )
}
