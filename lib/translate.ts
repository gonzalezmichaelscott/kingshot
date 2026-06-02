// Client helper for calling the /api/translate proxy.

export interface TranslateResult {
  translatedText: string
  detectedSourceLanguage: string
  error?: boolean
}

export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslateResult> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage, sourceLanguage }),
    })
    if (!res.ok) return { translatedText: text, detectedSourceLanguage: sourceLanguage || '', error: true }
    return await res.json()
  } catch {
    return { translatedText: text, detectedSourceLanguage: sourceLanguage || '', error: true }
  }
}
