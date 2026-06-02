'use client'
import { Share, Plus, X } from 'lucide-react'

interface Props {
  onClose: () => void
}

/**
 * Step-by-step "Add to Home Screen" guide for iOS Safari, which doesn't support
 * beforeinstallprompt. Uses text + simple icon diagrams (no Apple imagery).
 */
export function IosInstallModal({ onClose }: Props) {
  const steps = [
    {
      icon: <Share size={18} className="text-amber-400" />,
      text: 'Tap the Share button (□↑) at the bottom of your Safari browser',
    },
    {
      icon: <Plus size={18} className="text-amber-400" />,
      text: "Scroll down in the share menu and tap 'Add to Home Screen'",
    },
    {
      icon: <span className="text-amber-400 font-bold text-sm">↵</span>,
      text: "Tap 'Add' in the top right to confirm",
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-100">Add KS Command to your Home Screen</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 -mr-1">
            <X size={20} />
          </button>
        </div>

        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-amber-400 text-sm">
                {i + 1}
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  {s.icon}
                </span>
                <p className="text-sm text-slate-300">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
