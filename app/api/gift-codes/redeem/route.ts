import { NextRequest, NextResponse } from 'next/server'

// Proxies a single gift-code redemption to the Century Games endpoint.
// We never persist the result and never log the full Player ID.

const FALLBACK_MSG =
  'Redemption service unavailable — try redeeming at ks-giftcode.centurygame.com manually'

// Mask the Player ID for logs so it can't be tied back to a person if logs leak.
function maskId(id: string): string {
  if (id.length <= 3) return '***'
  return '***' + id.slice(-3)
}

export async function POST(request: NextRequest) {
  let playerId = ''
  let code = ''
  try {
    const body = await request.json()
    playerId = String(body?.playerId ?? '').trim()
    code = String(body?.code ?? '').trim()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
  }

  if (!playerId || !code) {
    return NextResponse.json(
      { success: false, message: 'Player ID and code are required' },
      { status: 400 },
    )
  }

  // Log the attempt (transient) — masked Player ID, never stored as data.
  console.log('[gift-code] redemption attempt', { code, player: maskId(playerId) })

  try {
    const upstream = await fetch('https://ks-giftcode.centurygame.com/api/cd_key/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ uid: playerId, cdk: code, type: 1 }),
      signal: AbortSignal.timeout(10000),
    })

    let json: any = null
    try {
      json = await upstream.json()
    } catch {
      json = null
    }

    // Non-JSON / empty body — treat as the service being unavailable.
    if (!json) {
      return NextResponse.json({ success: false, message: FALLBACK_MSG })
    }

    const msg = String(json.msg ?? json.message ?? '').toUpperCase()
    const apiCode = json.code ?? json.err_code ?? json.errcode

    // Success
    if (apiCode === 0 || msg.includes('SUCCESS')) {
      return NextResponse.json({ success: true, message: '✓ Redeemed!' })
    }

    // Already redeemed for this player
    if (msg.includes('RECORD EXIST') || msg.includes('ALREADY') || msg.includes('RECEIVED')) {
      return NextResponse.json({ success: false, alreadyRedeemed: true, message: 'Already redeemed' })
    }

    // Invalid or expired code
    if (msg.includes('CDK NOT FOUND') || msg.includes('NOT EXIST') || msg.includes('EXPIRE') || msg.includes('USED')) {
      return NextResponse.json({ success: false, message: 'This code is invalid or has expired' })
    }

    // Player not recognized by the game
    if (msg.includes('USER NOT') || msg.includes('ROLE NOT') || msg.includes('PLAYER NOT') || msg.includes('NOT FOUND')) {
      return NextResponse.json({ success: false, message: 'Player ID not recognized — check your Player ID' })
    }

    // Signature / time / parameter errors mean our request shape is wrong for
    // this endpoint — fail gracefully and point the user at the manual page.
    if (msg.includes('SIGN') || msg.includes('TIME ERROR') || msg.includes('PARAM') || msg.includes('TYPE')) {
      return NextResponse.json({ success: false, message: FALLBACK_MSG })
    }

    // Anything else — surface the upstream message if present, else fallback.
    return NextResponse.json({ success: false, message: json.msg || json.message || FALLBACK_MSG })
  } catch {
    // Network error / timeout
    return NextResponse.json({ success: false, message: FALLBACK_MSG })
  }
}
