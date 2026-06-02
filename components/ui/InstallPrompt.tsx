'use client'
import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const DISMISS_KEY = 'ks-install-prompt-dismissed-until'
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

// The browser fires `beforeinstallprompt` with this shape on installable PWAs.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isMobile() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  )
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isMobile() || isStandalone()) return

    // Respect a recent dismissal (7-day cooldown).
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (until && Date.now() < until) return

    const onBeforeInstall = (e: Event) => {
      // Prevent the default mini-infobar so we can show our own banner.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const onInstalled = () => setVisible(false)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS))
    setVisible(false)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[120] p-3 lg:hidden">
      <div className="mx-auto max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Download size={20} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200">
            Install <span className="font-semibold text-amber-400">KS Command</span> on your home
            screen for quick access
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={install}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-semibold rounded-full transition-colors"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-full transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-slate-500 hover:text-slate-300 p-1 flex-shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
