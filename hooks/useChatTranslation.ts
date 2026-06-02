import { useState, useEffect, useRef, useCallback } from 'react'
import { translateText } from '@/lib/translate'

interface TranslationEntry {
  text: string
  from: string
}

/**
 * Manages per-message translation state for a chat view:
 *  - manual translate / show-original toggle per message
 *  - an auto-translate preference persisted to localStorage per user
 *  - an in-memory cache so the same message is never translated twice
 */
export function useChatTranslation(userId: string, preferredLang: string) {
  const [translations, setTranslations] = useState<Record<string, TranslationEntry>>({})
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [autoTranslate, setAutoTranslateState] = useState(false)
  const inFlight = useRef<Set<string>>(new Set())

  const storageKey = `ks-chat-autotranslate-${userId}`

  useEffect(() => {
    try {
      setAutoTranslateState(localStorage.getItem(storageKey) === '1')
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const setAutoTranslate = useCallback(
    (v: boolean) => {
      setAutoTranslateState(v)
      try {
        localStorage.setItem(storageKey, v ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  )

  // Fetch + cache a translation for a message (no-op if already cached/in-flight).
  const fetchTranslation = useCallback(
    async (id: string, text: string): Promise<TranslationEntry | null> => {
      if (translations[id]) return translations[id]
      if (inFlight.current.has(id)) return null
      inFlight.current.add(id)
      setPending((p) => ({ ...p, [id]: true }))
      const r = await translateText(text, preferredLang)
      inFlight.current.delete(id)
      setPending((p) => ({ ...p, [id]: false }))
      if (r.error) return null
      const entry = { text: r.translatedText, from: r.detectedSourceLanguage }
      setTranslations((prev) => ({ ...prev, [id]: entry }))
      return entry
    },
    [preferredLang, translations]
  )

  // Manual translate button: toggles between original and translation.
  const toggle = useCallback(
    async (id: string, text: string) => {
      if (visible[id]) {
        setVisible((v) => ({ ...v, [id]: false }))
        return
      }
      if (!translations[id]) {
        const entry = await fetchTranslation(id, text)
        if (!entry) return
      }
      setVisible((v) => ({ ...v, [id]: true }))
    },
    [visible, translations, fetchTranslation]
  )

  // Auto-translate: ensure a message is translated and shown (used in an effect).
  const ensureAuto = useCallback(
    async (id: string, text: string) => {
      const entry = translations[id] || (await fetchTranslation(id, text))
      if (!entry) return
      // Only reveal if the detected source differs from the user's language.
      if (entry.from && entry.from.toLowerCase().startsWith(preferredLang.toLowerCase())) return
      setVisible((v) => (v[id] ? v : { ...v, [id]: true }))
    },
    [translations, fetchTranslation, preferredLang]
  )

  return {
    translations,
    visible,
    pending,
    autoTranslate,
    setAutoTranslate,
    toggle,
    ensureAuto,
  }
}
