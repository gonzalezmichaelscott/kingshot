// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  imageBase64: z.string(),
  type: z.enum(['battle_report', 'hero_screen', 'troop_screen', 'stat_screen']),
})

interface OcrResult {
  fields: Record<string, string | number>
  confidence: Record<string, number>
  raw: string
}

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

function parseBattleReport(text: string): OcrResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const fields: Record<string, number> = {}
  const confidence: Record<string, number> = {}

  const patterns: Array<{ key: string; regex: RegExp }> = [
    { key: 'infantry_attack', regex: /infantry.{0,20}attack.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'infantry_defense', regex: /infantry.{0,20}def(?:ense|ence)?.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'infantry_health', regex: /infantry.{0,20}health.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'infantry_lethality', regex: /infantry.{0,20}lethality.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'cavalry_attack', regex: /cavalry.{0,20}attack.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'cavalry_defense', regex: /cavalry.{0,20}def(?:ense|ence)?.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'cavalry_health', regex: /cavalry.{0,20}health.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'cavalry_lethality', regex: /cavalry.{0,20}lethality.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'archer_attack', regex: /archer.{0,20}attack.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'archer_defense', regex: /archer.{0,20}def(?:ense|ence)?.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'archer_health', regex: /archer.{0,20}health.{0,10}(\d+(?:\.\d+)?%?)/i },
    { key: 'archer_lethality', regex: /archer.{0,20}lethality.{0,10}(\d+(?:\.\d+)?%?)/i },
  ]

  for (const { key, regex } of patterns) {
    const match = text.match(regex)
    if (match) {
      const val = parseFloat(match[1].replace('%', ''))
      fields[key] = val
      confidence[key] = 0.85
    }
  }

  return { fields, confidence, raw: text }
}

function parseStatScreen(text: string): OcrResult {
  const fields: Record<string, number> = {}
  const confidence: Record<string, number> = {}

  const powerMatch = text.match(/power[:\s]+(\d[\d,]+)/i)
  if (powerMatch) {
    fields.power = parseInt(powerMatch[1].replace(/,/g, ''))
    confidence.power = 0.9
  }

  const marchMatch = text.match(/march\s+size[:\s]+(\d[\d,]+)/i)
  if (marchMatch) {
    fields.march_size = parseInt(marchMatch[1].replace(/,/g, ''))
    confidence.march_size = 0.85
  }

  const rallyMatch = text.match(/rally\s+(?:capacity|cap)[:\s]+(\d[\d,]+)/i)
  if (rallyMatch) {
    fields.rally_capacity = parseInt(rallyMatch[1].replace(/,/g, ''))
    confidence.rally_capacity = 0.85
  }

  return { fields, confidence, raw: text }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, type } = schema.parse(body)

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

    let result: OcrResult
    if (type === 'battle_report') result = parseBattleReport(rawText)
    else if (type === 'stat_screen') result = parseStatScreen(rawText)
    else result = { fields: {}, confidence: {}, raw: rawText }

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
