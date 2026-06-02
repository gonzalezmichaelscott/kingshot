'use client'
import { useState } from 'react'
import { Zap } from 'lucide-react'
import { useNoSleep } from '@/hooks/useNoSleep'

interface Props {
  active: boolean
}

/**
 * Keeps the screen awake while `active` is true (via NoSleep) and shows a small
 * amber "Screen stay-on active" badge in the bottom corner. Tapping the badge
 * reveals a tooltip explaining the behaviour.
 *
 * Drop this into any high-activity area (chat, KVK hub, running rally timer).
 */
export function ScreenStayOn({ active }: Props) {
  const [showTip, setShowTip] = useState(false)
  useNoSleep(active)

  if (!active) return null

  return (
    <div className="fixed bottom-4 right-4 z-[110] select-none">
      {showTip && (
        <div className="mb-2 max-w-[220px] ml-auto bg-slate-900 border border-amber-500/40 text-slate-200 text-xs rounded-lg shadow-xl px-3 py-2">
          Your screen will stay on while you&apos;re in this area.
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowTip((v) => !v)}
        className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 text-xs font-medium rounded-full px-3 py-1.5 shadow-lg backdrop-blur-sm transition-colors"
        title="Your screen will stay on while you're in this area."
      >
        <Zap size={13} className="fill-amber-400" />
        Screen stay-on active
      </button>
    </div>
  )
}
