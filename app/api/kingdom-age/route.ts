// @ts-nocheck
/**
 * FIX 10 — Proxy for the kingshot.net Kingdom Tracker API.
 * GET /api/kingdom-age?kingdomId={number}
 * Returns { data } with { kingdomId, openTime, isExclusive, languages, isVerified }.
 * Cached for 24 hours (kingdom open dates never change).
 */
import { NextRequest, NextResponse } from 'next/server'

interface CacheEntry {
  data: any | null // null = known-not-found
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const kingdomId = searchParams.get('kingdomId')?.trim()

  if (!kingdomId || !/^\d{1,10}$/.test(kingdomId)) {
    return NextResponse.json({ error: 'Invalid kingdomId' }, { status: 400 })
  }

  const cached = cache.get(kingdomId)
  if (cached && Date.now() < cached.expiresAt) {
    if (cached.data === null) return NextResponse.json({ data: null }, { status: 404 })
    return NextResponse.json({ data: cached.data })
  }

  try {
    const upstream = await fetch(
      `https://kingshot.net/api/kingdom-tracker?kingdomId=${encodeURIComponent(kingdomId)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    )

    if (!upstream.ok) {
      // Cache the "no data" result so we don't keep hammering upstream.
      cache.set(kingdomId, { data: null, expiresAt: Date.now() + CACHE_TTL_MS })
      return NextResponse.json({ data: null }, { status: 404 })
    }

    const json = await upstream.json().catch(() => null)
    // The Kingdom Tracker API shape is:
    //   { status, data: { servers: [ { kingdomId, openTime, isExclusive,
    //     languages, isVerified, ... } ], total, filters }, message }
    // Pick the matching server (by kingdomId) or the first one returned.
    const servers = json?.data?.servers
    const server = Array.isArray(servers)
      ? (servers.find((s: any) => String(s?.kingdomId) === kingdomId) ?? servers[0])
      // Tolerate older/alternate shapes that returned the object directly.
      : (json?.data?.openTime ? json.data : null)

    const data = server && server.openTime
      ? {
          kingdomId: server.kingdomId ?? Number(kingdomId),
          openTime: server.openTime,
          isExclusive: server.isExclusive ?? false,
          languages: server.languages ?? null,
          isVerified: server.isVerified ?? false,
        }
      : null

    if (!data) {
      cache.set(kingdomId, { data: null, expiresAt: Date.now() + CACHE_TTL_MS })
      return NextResponse.json({ data: null }, { status: 404 })
    }

    cache.set(kingdomId, { data, expiresAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json({ data }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch {
    if (cached?.data) return NextResponse.json({ data: cached.data })
    return NextResponse.json({ data: null }, { status: 502 })
  }
}
