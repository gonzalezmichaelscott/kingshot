import { useEffect, useState, useCallback } from 'react'

// Shared, module-level capture of the (single) beforeinstallprompt event so that
// multiple components (the nav button AND the banner) can react to it.

type Handler = () => void

let deferredPrompt: any = null
let installed = false
let initialized = false
const subscribers = new Set<Handler>()

function emit() {
  subscribers.forEach((h) => h())
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    emit()
  })
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

export interface PwaInstall {
  canPrompt: boolean
  installed: boolean
  ios: boolean
  standalone: boolean
  /** Triggers the native Android/Chrome prompt. Returns the user's choice. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export function usePwaInstall(): PwaInstall {
  init()
  const [, force] = useState(0)

  useEffect(() => {
    const h = () => force((x) => x + 1)
    subscribers.add(h)
    return () => {
      subscribers.delete(h)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    emit()
    return outcome as 'accepted' | 'dismissed'
  }, [])

  return {
    canPrompt: !!deferredPrompt,
    installed,
    ios: isIOS(),
    standalone: isStandalone(),
    promptInstall,
  }
}
