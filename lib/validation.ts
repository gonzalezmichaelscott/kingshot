// Shared Zod schemas + helpers for validating API request bodies.
//
// Routes should `schema.parse(body)` inside a try/catch and return 400 on
// failure, or use `parseBody` / `validationError` below for a consistent shape.

import { z } from 'zod'
import { NextResponse } from 'next/server'

// ---- Common field schemas ----
export const uuid = z.string().uuid()

/** Numeric game stats with sane upper bounds (block absurd / overflow values). */
export const memberStatsSchema = z.object({
  power: z.number().int().min(0).max(10_000_000_000).optional(),
  troop_count: z.number().int().min(0).max(50_000_000).optional(),
  march_size: z.number().int().min(0).max(5_000_000).optional(),
  rally_capacity: z.number().int().min(0).max(10_000_000).optional(),
})

/** Chat / world-chat message body. */
export const chatMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  allianceId: uuid,
})

export const worldChatMessageSchema = z.object({
  content: z.string().min(1).max(2000),
})

/** Translation request — cap text length to protect upstream cost. */
export const translateSchema = z.object({
  text: z.string().max(5000),
  targetLanguage: z.string().min(1).max(16),
  sourceLanguage: z.string().max(16).optional(),
})

/** Gift-code redemption inputs (player id + code format). */
export const giftCodeRedeemSchema = z.object({
  playerId: z.string().regex(/^\d+$/, 'Player ID must be numeric').max(32),
  code: z.string().min(1).max(64).regex(/^[A-Za-z0-9]+$/, 'Invalid code format'),
})

/** A free-text report reason. */
export const reportReasonSchema = z.string().max(500).optional()

// ---- Helpers ----

/** Build a consistent 400 response from a ZodError. */
export function validationError(err: unknown): NextResponse {
  if (err instanceof z.ZodError) {
    const first = err.issues[0]
    const path = first?.path?.join('.')
    const msg = first ? `${path ? path + ': ' : ''}${first.message}` : 'Invalid request'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
}

/**
 * Parse + validate a request's JSON body against a schema.
 * Returns `{ data }` on success or `{ response }` (a 400) on failure.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; response?: undefined } | { data?: undefined; response: NextResponse }> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return { response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }
  const result = schema.safeParse(json)
  if (!result.success) return { response: validationError(result.error) }
  return { data: result.data }
}
