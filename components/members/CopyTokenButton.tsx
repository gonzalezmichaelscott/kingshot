'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    const url = `${window.location.origin}/member/${token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      title="Copy member link"
      className="text-slate-400 hover:text-amber-400 transition-colors p-1"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  )
}
