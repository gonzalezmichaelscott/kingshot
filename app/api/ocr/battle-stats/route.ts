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
    fields: {},
    confidence: {},
    raw: '',
    message,
    manual_entry_required: true,
  })
}

async function callGoogleVision(base64: string): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) throw new Error('Google Vision API key not configured')

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    }
  )

  const data = await res.json()
  if (data.responses?.[0]?.error) {
    throw new Error(data.responses[0].error.message || 'Vision API error')
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
    // Fail fast (and clearly) when OCR isn't configured, so the UI can route the
    // member straight to manual entry instead of showing a generic error.
    if (!process.env.GOOGLE_VISION_API_KEY) {
      return manualFallback('OCR unavailable — please enter stats manually.')
    }

    const read = await readImage(request)
    if (read.error) {
      return NextResponse.json({ error: read.error }, { status: 400 })
    }

    const resized = await maybeResize(read.buffer)
    const rawText = await callGoogleVision(resized.toString('base64'))

    const { fields, confidence, raw } = parseKingshotStats(rawText)

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({
        fields,
        confidence,
        raw,
        message: 'No stats found in the screenshot. Please enter them manually.',
        manual_entry_required: false,
      })
    }

    return NextResponse.json({
      fields,
      confidence,
      raw,
      message: 'Review the extracted values, then choose which to apply.',
    })
  } catch (error: any) {
    console.error('OCR battle-stats error:', error)
    return manualFallback('Could not read screenshot. Please enter stats manually.')
  }
}
