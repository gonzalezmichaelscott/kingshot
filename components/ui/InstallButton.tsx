'use client'
import { useEffect, useState } from 'react'
import { Download, Check } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { IosInstallModal } from '@/components/ui/IosInstallModal'

/**
 * "Save to Home Screen" control for the top navigation. Mobile-only.
 * - iOS Safari: opens a step-by-step instruction modal.
 * - Android/Chrome: triggers the native install prompt (only shown once available).
 * - Already installed / standalone: hidden.
 */
export function InstallButton() {
  const { canPrompt, installed, ios, standalone, promptInstall } = usePwaInstall()
  const [showModal, setShowModal] = useState(false)
  const [hideAfterInstall, setHideAfterInstall] = useState(false)

  // After an install, flash "App installed!" then hide the button.
  useEffect(() => {
    if (!installed) return
    const t = setTimeout(() => setHideAfterInstall(true), 2500)
    return () => clearTimeout(t)
  }, [installed])

  if (standalone) return null
  if (installed && hideAfterInstall) return null
  // On Android only show once the prompt is available.
  if (!ios && !canPrompt && !installed) return null

  async function onClick() {
    if (ios) {
      setShowModal(true)
      return
    }
    await promptInstall()
  }

  return (
    <>
      <button
        onClick={onClick}
        className="lg:hidden flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-400 transition-colors px-2 py-1 rounded-lg"
        title="Save KS Command to your home screen"
      >
        {installed ? (
          <>
            <Check size={14} className="text-green-400" />
            <span className="hidden sm:inline">App installed!</span>
          </>
        ) : (
          <>
            <Download size={14} />
            <span className="hidden sm:inline">Save to Home Screen</span>
          </>
        )}
      </button>
      {showModal && <IosInstallModal onClose={() => setShowModal(false)} />}
    </>
  )
}
