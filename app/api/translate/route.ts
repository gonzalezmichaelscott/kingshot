// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, HOUR_MS } from '@/lib/rate-limit'
import { translateSchema } from '@/lib/validation'

const schema = translateSchema

// Simple in-memory cache: same text + same target (+ optional source) is only
// ever sent to Google once per server instance.
const cache = new Map<string, { translatedText: string; detectedSourceLanguage: string }>()
const MAX_CACHE = 2000

function cacheKey(text: string, target: string, source?: string) {
  return `${target}::${source || 'auto'}::${text}`
}

export async function POST(request: NextRequest) {
  let text = ''
  let targetLanguage = ''
  let sourceLanguage: string | undefined
  try {
    const parsed = schema.parse(await request.json())
    text = parsed.text
    targetLanguage = parsed.targetLanguage
    sourceLanguage = parsed.sourceLanguage
  } catch {
    return NextResponse.json({ error: 'Bad request — text must be ≤ 5000 chars' }, { status: 400 })
  }

  // Rate limit: 100 translations per hour, per user (falls back to client IP).
  let identifier = ''
  try {
    const { data: { user } } = await createClient().auth.getUser()
    identifier = user?.id || ''
  } catch { /* anonymous */ }
  if (!identifier) {
    identifier = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anon'
  }
  const rl = rateLimit(`translate:${identifier}`, 100, HOUR_MS)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests — please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  // Nothing to translate.
  if (!text.trim()) {
    return NextResponse.json({ translatedText: text, detectedSourceLanguage: sourceLanguage || '' })
  }

  const key = cacheKey(text, targetLanguage, sourceLanguage)
  const cached = cache.get(key)
  if (cached) return NextResponse.json(cached)

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) {
    // Fail gracefully — return the original text flagged so the UI can react.
    return NextResponse.json(
      { translatedText: text, detectedSourceLanguage: sourceLanguage || '', error: true },
      { status: 200 }
    )
  }

  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          target: targetLanguage,
          ...(sourceLanguage ? { source: sourceLanguage } : {}),
          format: 'text',
        }),
      }
    )

    if (!res.ok) {
      return NextResponse.json(
        { translatedText: text, detectedSourceLanguage: sourceLanguage || '', error: true },
        { status: 200 }
      )
    }

    const data = await res.json()
    const t = data?.data?.translations?.[0]
    const result = {
      translatedText: t?.translatedText ?? text,
      detectedSourceLanguage: t?.detectedSourceLanguage ?? sourceLanguage ?? '',
    }

    // Store in cache (with a crude size cap).
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value
      if (firstKey !== undefined) cache.delete(firstKey)
    }
    cache.set(key, result)

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { translatedText: text, detectedSourceLanguage: sourceLanguage || '', error: true },
      { status: 200 }
    )
  }
}
