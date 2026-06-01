'use client'
import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

export function UtcClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      const y = now.getUTCFullYear()
      const mo = String(now.getUTCMonth() + 1).padStart(2, '0')
      const d = String(now.getUTCDate()).padStart(2, '0')
      const h = String(now.getUTCHours()).padStart(2, '0')
      const mi = String(now.getUTCMinutes()).padStart(2, '0')
      const s = String(now.getUTCSeconds()).padStart(2, '0')
      setTime(`${y}-${mo}-${d} ${h}:${mi}:${s} UTC`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  return (
    <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xs select-none">
      <Clock size={13} className="opacity-70 flex-shrink-0" />
      <span>{time}</span>
    </div>
  )
}
