// Languages offered for a member's preferred language and used as Google
// Translate targets. `code` is the Google Translate / BCP-47 code; `label` is
// shown in dropdowns (English name + native name).

export interface LanguageOption {
  code: string
  label: string
  /** Native-name only, used for the "Translated from X" badge. */
  native: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'es', label: 'Spanish — Español', native: 'Español' },
  { code: 'fr', label: 'French — Français', native: 'Français' },
  { code: 'de', label: 'German — Deutsch', native: 'Deutsch' },
  { code: 'pt', label: 'Portuguese — Português', native: 'Português' },
  { code: 'it', label: 'Italian — Italiano', native: 'Italiano' },
  { code: 'ru', label: 'Russian — Русский', native: 'Русский' },
  { code: 'zh-CN', label: 'Chinese Simplified — 中文简体', native: '中文简体' },
  { code: 'zh-TW', label: 'Chinese Traditional — 中文繁體', native: '中文繁體' },
  { code: 'ja', label: 'Japanese — 日本語', native: '日本語' },
  { code: 'ko', label: 'Korean — 한국어', native: '한국어' },
  { code: 'ar', label: 'Arabic — العربية', native: 'العربية' },
  { code: 'tr', label: 'Turkish — Türkçe', native: 'Türkçe' },
  { code: 'vi', label: 'Vietnamese — Tiếng Việt', native: 'Tiếng Việt' },
  { code: 'th', label: 'Thai — ภาษาไทย', native: 'ภาษาไทย' },
  { code: 'id', label: 'Indonesian — Bahasa Indonesia', native: 'Bahasa Indonesia' },
  { code: 'tl', label: 'Filipino — Filipino', native: 'Filipino' },
]

export const DEFAULT_LANGUAGE = 'en'

/** Human-readable name for a language code. Falls back to the raw code. */
export function languageLabel(code: string | null | undefined): string {
  if (!code) return 'Unknown'
  // Google sometimes returns base codes (e.g. "zh") for the Chinese variants.
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase())
  if (exact) return exact.native
  const base = LANGUAGES.find((l) => l.code.toLowerCase().startsWith(code.toLowerCase()))
  return base ? base.native : code
}
