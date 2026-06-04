// @ts-nocheck
// Best-effort transactional email via Resend. No-ops (and never throws) when
// RESEND_API_KEY is not configured, so callers can `await sendEmail(...)` safely.

export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'KS Command <noreply@kscommand.app>'
  if (!apiKey) {
    console.log('[email] RESEND_API_KEY not set — skipping email to', opts.to, '·', opts.subject)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
    })
    if (!res.ok) {
      console.error('[email] send failed', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.error('[email] send error', e)
    return false
  }
}
