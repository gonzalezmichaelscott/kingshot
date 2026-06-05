// @ts-nocheck
// OCR endpoint for Kingshot battle-stat screenshots.
//
// Accepts EITHER:
//   - multipart/form-data with an `image` file field, or
//   - application/json with `{ imageBase64 }` (data-URL prefix optional).
//
// Pipeline: validate (size + true magic bytes) → resize if oversized (to keep
// Vision payloads small) → Google Cloud Vision TEXT_DETECTION → parseKingshotStats.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  validateImageUpload,
  verifyImageMagicBytes,
  MAX_FILE_SIZE,
} from '@/lib/image-validation'
import { parseKingshotStats } from '@/lib/ocr-parser'

// Images above this size are downscaled before hitting Vision — the API bills on
// request size and rarely needs more than ~2000px of width to read stat text.
const RESIZE_THRESHOLD = 4 * 1024 * 1024 // 4MB

const jsonSchema = z.object({
  imageBase64: z.string().min(1),
})

/** Standard "give up gracefully, let the member type it in" response. */
function manualFallback(message: string) {
  return NextResponse.json({
    resource: {},
    left: {},
    right: {},
    dualColumn: false,
    confidence: {},
    raw: '',
    message,
    manual_entry_required: true,
  })
}

async function callGoogleVision(base64: string): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  // Log whether the key was loaded from the environment — NEVER the key itself.
  console.log(
    '[OCR] GOOGLE_VISION_API_KEY present:',
    !!apiKey,
    apiKey ? `(length ${apiKey.length})` : '(missing)'
  )
  if (!apiKey) throw new Error('Google Vision API key not configured')

  // Defensive: Vision requires RAW base64 — strip any lingering data-URL prefix
  // (e.g. "data:image/jpeg;base64,") that may have slipped through.
  const content = base64.includes(',') ? base64.split(',').pop()! : base64

  // Pass the API key via the x-goog-api-key header (Google's recommended way)
  // rather than a ?key= query parameter — this can sidestep "requests blocked"
  // errors tied to HTTP-referrer / query-key restrictions.
  const endpoint = 'https://vision.googleapis.com/v1/images:annotate'
  const requestBody = {
    requests: [
      {
        image: { content },
        features: [{ type: 'TEXT_DETECTION' }],
      },
    ],
  }
  console.log('[OCR] Vision request: base64 length', content.length, '| feature TEXT_DETECTION | auth via x-goog-api-key header')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  })

  const data = await res.json().catch(() => null)
  // Log the HTTP status and the FULL response body so any error surfaces in logs.
  console.log('[OCR] Vision HTTP status:', res.status, res.statusText)
  console.log('[OCR] Vision full response:', JSON.stringify(data))

  if (!data) {
    throw new Error(`Vision API returned a non-JSON response (HTTP ${res.status})`)
  }
  // Top-level error — invalid/again restricted API key, billing disabled, or the
  // Vision API not enabled for the project. This was previously unchecked.
  if (data.error) {
    throw new Error(data.error.message || `Vision API error (HTTP ${res.status})`)
  }
  // Per-image error (e.g. unsupported image, bad content).
  if (data.responses?.[0]?.error) {
    throw new Error(data.responses[0].error.message || 'Vision API per-image error')
  }
  // Non-2xx without a structured error object.
  if (!res.ok) {
    throw new Error(`Vision API request failed (HTTP ${res.status})`)
  }

  return data.responses?.[0]?.fullTextAnnotation?.text || ''
}

/**
 * Downscale an oversized image to cut Vision costs. Best-effort: if sharp isn't
 * available at runtime we just return the original buffer rather than failing.
 */
async function maybeResize(buffer: Buffer): Promise<Buffer> {
  if (buffer.byteLength <= RESIZE_THRESHOLD) return buffer
  try {
    const sharp = (await import('sharp')).default
    return await sharp(buffer)
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  } catch {
    return buffer
  }
}

/** Pull the raw image bytes from either a multipart upload or a JSON base64 body. */
async function readImage(
  request: NextRequest
): Promise<{ buffer: Buffer; error?: never } | { buffer?: never; error: string }> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('image')
    if (!(file instanceof File)) return { error: 'No image file provided' }

    const meta = validateImageUpload(file)
    if (!meta.valid) return { error: meta.error! }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!verifyImageMagicBytes(buffer)) return { error: 'Invalid or unsupported image format' }
    return { buffer }
  }

  // JSON base64 path.
  const body = await request.json()
  const { imageBase64 } = jsonSchema.parse(body)
  // Tolerate a `data:image/png;base64,...` prefix from FileReader.readAsDataURL.
  const base64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
  const buffer = Buffer.from(base64, 'base64')

  if (buffer.byteLength === 0) return { error: 'Image file is empty' }
  if (buffer.byteLength > MAX_FILE_SIZE) return { error: 'Image must be under 10MB' }
  if (!verifyImageMagicBytes(buffer)) return { error: 'Invalid or unsupported image format' }
  return { buffer }
}

export async function POST(request: NextRequest) {
  try {
    // Log key presence up front (value is never logged) so the no-key path is
    // also diagnosable from the server logs.
    console.log('[OCR] request received | API key present:', !!process.env.GOOGLE_VISION_API_KEY)

    // Fail fast (and clearly) when OCR isn't configured, so the UI can route the
    // member straight to manual entry instead of showing a generic error.
    if (!process.env.GOOGLE_VISION_API_KEY) {
      return manualFallback('OCR unavailable — GOOGLE_VISION_API_KEY is not set on the server.')
    }

    const read = await readImage(request)
    if (read.error) {
      return NextResponse.json({ error: read.error }, { status: 400 })
    }

    const resized = await maybeResize(read.buffer)

    // Isolate the Vision call so its real error message can be returned to the
    // client (and logged), rather than being swallowed by the generic fallback.
    let rawText: string
    try {
      rawText = await callGoogleVision(resized.toString('base64'))
    } catch (visionError: any) {
      const detail = visionError?.message || 'Unknown Vision API error'
      console.error('[OCR] Vision API call failed:', detail)
      return NextResponse.json(
        {
          resource: {},
          left: {},
          right: {},
          dualColumn: false,
          confidence: {},
          raw: '',
          error: detail,
          message: `Vision API error: ${detail}`,
          manual_entry_required: true,
        },
        { status: 502 }
      )
    }

    const { resource, left, right, dualColumn, confidence, raw } = parseKingshotStats(rawText)
    const foundCount =
      Object.keys(resource).length + Object.keys(left).length + Object.keys(right).length

    if (foundCount === 0) {
      return NextResponse.json({
        resource,
        left,
        right,
        dualColumn,
        confidence,
        raw,
        message: 'No stats found in the screenshot. Please enter them manually.',
        manual_entry_required: false,
      })
    }

    return NextResponse.json({
      resource,
      left,
      right,
      dualColumn,
      confidence,
      raw,
      message: dualColumn
        ? 'Battle report detected — pick your column, then choose which stats to apply.'
        : 'Review the extracted values, then choose which to apply.',
    })
  } catch (error: any) {
    console.error('OCR battle-stats error:', error)
    return manualFallback('Could not read screenshot. Please enter stats manually.')
  }
}
