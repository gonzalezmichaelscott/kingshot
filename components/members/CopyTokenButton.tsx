// @ts-nocheck
'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  token: string
  /** When true, shows a full "Copy member link" button instead of just the icon */
  showUrl?: boolean
}

export function CopyTokenButton({ token, showUrl = false }: Props) {
  const [copied, setCopied] = useState(false)

  function copy() {
    const url = `${window.location.origin}/member/${token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (showUrl) {
    return (
      <Button size="sm" variant="secondary" onClick={copy}>
        {copied
          ? <><Check size={14} className="mr-1.5 text-green-400" />Copied!</>
          : <><Copy size={14} className="mr-1.5" />Copy member link</>
        }
      </Button>
    )
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
