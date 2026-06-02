'use client'
import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { IosInstallModal } from '@/components/ui/IosInstallModal'

const DISMISS_KEY = 'ks-install-prompt-dismissed-until'
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

function isMobile() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

export function InstallPrompt() {
  const { canPrompt, ios, standalone, promptInstall } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Decide whether to show the banner. Shows on first visit (including iOS, which
  // never fires beforeinstallprompt), respecting the 7-day dismissal.
  useEffect(() => {
    if (!isMobile() || standalone) {
      setVisible(false)
      return
    }
    let dismissedUntil = 0
    try {
      dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0)
    } catch {
      /* ignore */
    }
    if (dismissedUntil && Date.now() < dismissedUntil) {
      setVisible(false)
      return
    }
    // Android: show once the prompt is available. iOS: show right away.
    setVisible(ios || canPrompt)
  }, [ios, canPrompt, standalone])

  // Hide the banner once the app is installed.
  useEffect(() => {
    if (standalone) setVisible(false)
  }, [standalone])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS))
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  async function install() {
    if (ios) {
      setShowModal(true)
      return
    }
    const outcome = await promptInstall()
    if (outcome === 'accepted') setVisible(false)
  }

  if (!visible && !showModal) return null

  return (
    <>
      {visible && (
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
      )}
      {showModal && <IosInstallModal onClose={() => setShowModal(false)} />}
    </>
  )
}
