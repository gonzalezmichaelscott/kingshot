// @ts-nocheck
'use client'
import { useState } from 'react'
import { Sword, Check } from 'lucide-react'

interface Props {
  children: React.ReactNode
  battlePlans: React.ReactNode
  hasPlan: boolean
}

export function EventPageWrapper({ children, battlePlans, hasPlan }: Props) {
  const [tab, setTab] = useState<'event' | 'battle_plans'>('event')

  const tabBtn = (key: 'event' | 'battle_plans', label: React.ReactNode) => (
    <button
      onClick={() => setTab(key)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        tab === key
          ? 'bg-amber-500 text-slate-900'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-2 mb-6 px-0 max-w-5xl mx-auto">
        {tabBtn('event', 'Event Details')}
        {tabBtn(
          'battle_plans',
          <>
            <Sword size={14} />
            Battle Plans
            {hasPlan && (
              <span className="ml-1 flex items-center justify-center w-4 h-4 bg-green-500 rounded-full">
                <Check size={10} className="text-white" />
              </span>
            )}
          </>,
        )}
      </div>

      {/* Panels — both rendered server-side, CSS toggles visibility */}
      <div className={tab === 'event' ? '' : 'hidden'}>{children}</div>
      <div className={tab === 'battle_plans' ? '' : 'hidden'}>{battlePlans}</div>
    </div>
  )
}
