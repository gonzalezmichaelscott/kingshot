'use client'
import { useNoSleep } from '@/hooks/useNoSleep'

/**
 * Headless helper: keeps the screen awake while `active` is true and renders
 * nothing. Use it from server components (e.g. the KVK hub page) that can't call
 * the useNoSleep hook directly. Client components should call useNoSleep instead.
 */
export function KeepAwake({ active = true }: { active?: boolean }) {
  useNoSleep(active)
  return null
}
