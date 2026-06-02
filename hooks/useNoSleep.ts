import { useEffect, useRef } from 'react'

export function useNoSleep(active: boolean) {
  const noSleepRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const initNoSleep = async () => {
      const NoSleep = (await import('nosleep.js')).default
      noSleepRef.current = new NoSleep()
    }
    initNoSleep()
  }, [])

  useEffect(() => {
    if (!noSleepRef.current) return
    if (active) {
      noSleepRef.current.enable().catch(() => {})
    } else {
      noSleepRef.current.disable()
    }
    return () => { if (noSleepRef.current) noSleepRef.current.disable() }
  }, [active])
}
