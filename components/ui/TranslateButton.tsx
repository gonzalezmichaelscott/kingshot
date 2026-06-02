// @ts-nocheck
'use client'
import { useState } from 'react'
import { Globe, Loader2 } from 'lucide-react'
import { translateText } from '@/lib/translate'
import { languageLabel } from '@/lib/languages'

interface Props {
  text: string
  targetLang: string
  /** Button label before translating (default "Translate"). */
  label?: string
  /** "link" = subtle inline text (board/replies), "button" = pill (event page). */
  variant?: 'link' | 'button'
}

/**
 * Self-contained translate / show-original control for a single block of text.
 * Caches the result so re-toggling never re-calls the API.
 */
export function TranslateButton({ text, targetLang, label = 'Translate', variant = 'link' }: Props) {
  const [result, setResult] = useState<{ text: string; from: string } | null>(null)
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function onClick() {
    setError(false)
    if (show) {
      setShow(false)
      return
    }
    if (result) {
      setShow(true)
      return
    }
    setLoading(true)
    const r = await translateText(text, targetLang)
    setLoading(false)
    if (r.error) {
      setError(true)
      return
    }
    setResult({ text: r.translatedText, from: r.detectedSourceLanguage })
    setShow(true)
  }

  const btnClass =
    variant === 'button'
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-200 transition-colors'
      : 'inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors'

  return (
    <div className={variant === 'button' ? '' : 'inline-block'}>
      <button onClick={onClick} disabled={loading} className={btnClass}>
        {loading ? <Loader2 size={variant === 'button' ? 14 : 12} className="animate-spin" /> : <Globe size={variant === 'button' ? 14 : 12} />}
        {show ? 'Show Original' : label}
      </button>
      {error && <span className="ml-2 text-xs text-red-400">Translation unavailable</span>}
      {show && result && (
        <div className="mt-2 bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{result.text}</p>
          <p className="text-[10px] text-slate-500 italic mt-1">
            Translated from {languageLabel(result.from)}
          </p>
        </div>
      )}
    </div>
  )
}
