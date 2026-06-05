// @ts-nocheck
// Legacy OCR endpoint used by CombatStatsEditor. Parsing now lives in the shared
// lib/ocr-parser (also used by /api/ocr/battle-stats) so the two endpoints stay
// in lock-step; this route keeps its original `{ imageBase64, type }` contract
// and response shape for backwards compatibility.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseKingshotStats } from '@/lib/ocr-parser'

const schema = z.object({
  imageBase64: z.string(),
  type: z.enum(['battle_report', 'hero_screen', 'troop_screen', 'stat_screen']),
})

async function callGoogleVision(imageBase64: string): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) throw new Error('Google Vision API key not configured')

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    }
  )

  const data = await response.json()
  return data.responses?.[0]?.fullTextAnnotation?.text || ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64 } = schema.parse(body)

    // Graceful fallback if no API key
    if (!process.env.GOOGLE_VISION_API_KEY) {
      return NextResponse.json({
        fields: {},
        confidence: {},
        raw: '',
        message: 'OCR unavailable — Google Vision API key not configured. Please enter stats manually.',
        manual_entry_required: true,
      })
    }

    const rawText = await callGoogleVision(imageBase64)
    // parseKingshotStats handles every screen type, so `type` no longer changes
    // parsing — extra fields are simply ignored by callers that don't use them.
    const result = parseKingshotStats(rawText)

    return NextResponse.json({
      ...result,
      message: 'Review and correct the extracted values before saving.',
    })
  } catch (error: any) {
    console.error('OCR error:', error)
    return NextResponse.json({
      fields: {},
      confidence: {},
      raw: '',
      message: 'OCR failed — please enter stats manually.',
      manual_entry_required: true,
    })
  }
}
