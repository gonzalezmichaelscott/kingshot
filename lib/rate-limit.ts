// Simple in-memory rate limiter (no external service / cost). Keyed by an
// arbitrary identifier (typically `${routeName}:${userId}`). State lives in the
// server process; it resets on redeploy, which is acceptable for abuse/cost
// protection on a free tier.
//
// NOTE: in a multi-instance deployment each instance keeps its own counters, so
// the effective limit is per-instance. For this app (single instance) that is
// fine; swap the Map for Upstash/Redis if you ever scale horizontally.

interface RateRecord {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateRecord>()

// Occasionally sweep expired records so the Map can't grow unbounded.
let lastSweep = Date.now()
function maybeSweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  rateLimitMap.forEach((rec, key) => {
    if (now > rec.resetTime) rateLimitMap.delete(key)
  })
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  /** ms until the current window resets (0 when a fresh window was started). */
  retryAfterMs: number
}

export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  maybeSweep(now)

  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return { success: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, retryAfterMs: record.resetTime - now }
  }

  record.count++
  return { success: true, remaining: limit - record.count, retryAfterMs: record.resetTime - now }
}

// Common window helpers.
export const HOUR_MS = 60 * 60 * 1000
export const MINUTE_MS = 60 * 1000

/**
 * Convenience wrapper: returns a ready-to-send 429 NextResponse when the limit
 * is exceeded, or null when the request may proceed.
 */
import { NextResponse } from 'next/server'
export function rateLimitResponse(
  identifier: string,
  limit: number,
  windowMs: number,
  message = 'Too many requests — please wait before trying again.'
): NextResponse | null {
  const result = rateLimit(identifier, limit, windowMs)
  if (result.success) return null
  const retryAfterSec = Math.max(1, Math.ceil(result.retryAfterMs / 1000))
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  )
}
