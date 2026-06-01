import { NextRequest, NextResponse } from 'next/server'

interface PlayerData {
  profilePhoto: string
  name: string
  kingdom: number
  level: number
}

interface CacheEntry {
  data: PlayerData | null   // null = known-not-found
  expiresAt: number
}

// Module-level in-memory cache (survives across requests within one server instance).
// TTL: 1 hour — avatars rarely change.
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get('playerId')?.trim()

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
  }

  // --- Cache hit ---
  const cached = cache.get(playerId)
  if (cached && Date.now() < cached.expiresAt) {
    if (cached.data === null) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    return NextResponse.json({ data: cached.data })
  }

  // --- Upstream fetch ---
  try {
    const upstream = await fetch(
      `https://kingshot.net/api/player-info?playerId=${encodeURIComponent(playerId)}`,
      {
        headers: { Accept: 'application/json' },
        // Abort after 8 s so slow upstream doesn't stall the route
        signal: AbortSignal.timeout(8000),
      }
    )

    // Rate-limited by upstream — serve stale cache if available, else 429
    if (upstream.status === 429) {
      if (cached) {
        if (cached.data === null) {
          return NextResponse.json({ error: 'Player not found' }, { status: 404 })
        }
        return NextResponse.json({ data: cached.data })
      }
      return NextResponse.json(
        { error: 'Rate limited — please try again shortly' },
        { status: 429 }
      )
    }

    const json = await upstream.json()

    // Upstream signals player not found
    if (
      !upstream.ok ||
      json.status === 'fail' ||
      json.meta?.errorKey === 'PLAYER_NOT_FOUND'
    ) {
      cache.set(playerId, { data: null, expiresAt: Date.now() + CACHE_TTL_MS })
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const playerData: PlayerData = {
      profilePhoto: json.data?.profilePhoto ?? '',
      name: json.data?.name ?? '',
      kingdom: json.data?.kingdom ?? 0,
      level: json.data?.level ?? 0,
    }

    cache.set(playerId, { data: playerData, expiresAt: Date.now() + CACHE_TTL_MS })

    // Also set a Cache-Control header so CDN/browser can cache the response
    return NextResponse.json({ data: playerData }, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
    })
  } catch (err) {
    // Network error / timeout — return stale cache if we have it
    if (cached?.data) {
      return NextResponse.json({ data: cached.data })
    }
    return NextResponse.json(
      { error: 'Failed to reach kingshot.net' },
      { status: 502 }
    )
  }
}
