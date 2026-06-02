import { NextResponse } from 'next/server'

// Active gift codes fetched from kingshot.net, cached server-side for 15 minutes.
// Degrades gracefully: on upstream failure we serve a stale cache if we have one,
// otherwise return an empty list with a soft error so the UI stays usable.

interface GiftCode {
  id: string
  code: string
  expiresAt: string | null
  createdAt: string | null
}

interface CacheEntry {
  codes: GiftCode[]
  expiresAt: number
}

let cache: CacheEntry | null = null
const CACHE_TTL_MS = 15 * 60 * 1000

// The upstream response shape isn't contractually guaranteed, so normalize
// defensively across several plausible field names.
function normalize(json: any): GiftCode[] {
  const arr: any[] =
    Array.isArray(json) ? json :
    Array.isArray(json?.data) ? json.data :
    Array.isArray(json?.giftCodes) ? json.giftCodes :
    Array.isArray(json?.codes) ? json.codes :
    Array.isArray(json?.data?.giftCodes) ? json.data.giftCodes :
    Array.isArray(json?.data?.codes) ? json.data.codes :
    []

  return arr
    .map((item: any, i: number) => {
      const code = String(item?.code ?? item?.cdk ?? item?.giftCode ?? item?.key ?? '').trim()
      const expiresRaw =
        item?.expiresAt ?? item?.expireAt ?? item?.expiry ?? item?.expiration ??
        item?.expire_at ?? item?.expires_at ?? item?.expireTime ?? null
      const createdRaw =
        item?.createdAt ?? item?.created ?? item?.created_at ?? item?.createTime ?? null
      const id = String(item?.id ?? item?._id ?? code ?? i)
      return {
        id,
        code,
        expiresAt: expiresRaw ? String(expiresRaw) : null,
        createdAt: createdRaw ? String(createdRaw) : null,
      }
    })
    .filter((c: GiftCode) => c.code.length > 0)
}

function isActive(c: GiftCode): boolean {
  if (!c.expiresAt) return true
  const t = Date.parse(c.expiresAt)
  if (isNaN(t)) return true
  return t > Date.now()
}

function respond(codes: GiftCode[], extra: Record<string, any> = {}) {
  const activeCount = codes.filter(isActive).length
  return NextResponse.json(
    { giftCodes: codes, total: codes.length, activeCount, ...extra },
    { headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=300' } },
  )
}

export async function GET() {
  // Fresh cache hit
  if (cache && Date.now() < cache.expiresAt) {
    return respond(cache.codes)
  }

  try {
    const upstream = await fetch('https://kingshot.net/api/gift-codes', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })

    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`)

    const json = await upstream.json()
    const codes = normalize(json)
    cache = { codes, expiresAt: Date.now() + CACHE_TTL_MS }
    return respond(codes)
  } catch {
    // Serve stale cache if available so the UI keeps working
    if (cache) return respond(cache.codes)
    return NextResponse.json(
      { giftCodes: [], total: 0, activeCount: 0, error: 'Gift code service unavailable' },
    )
  }
}
