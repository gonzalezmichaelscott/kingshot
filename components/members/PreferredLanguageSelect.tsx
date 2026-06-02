// @ts-nocheck
'use client'
import { useState } from 'react'
import { Languages, Check, Loader2 } from 'lucide-react'
import { LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/languages'

interface Props {
  accessToken: string
  initial?: string | null
  /** Optional compact layout for tight card sections. */
  className?: string
}

/**
 * Dropdown for a member's preferred language. Saves to both members and the
 * linked user_profile (via /api/member/language) as soon as the value changes.
 */
export function PreferredLanguageSelect({ accessToken, initial, className = '' }: Props) {
  const [value, setValue] = useState(initial || DEFAULT_LANGUAGE)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function onChange(next: string) {
    setValue(next)
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/member/language', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, preferred_language: next }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Save failed')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={className}>
      <label className="text-sm text-slate-400 mb-1 flex items-center gap-1.5">
        <Languages size={14} className="text-amber-500" />
        Preferred Language
      </label>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          className="flex-1 h-11 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        {saving && <Loader2 size={16} className="text-slate-400 animate-spin flex-shrink-0" />}
        {saved && !saving && <Check size={16} className="text-green-400 flex-shrink-0" />}
      </div>
      <p className="text-xs text-slate-500 mt-1">
        Used to auto-translate chat, board posts, and event instructions.
      </p>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
