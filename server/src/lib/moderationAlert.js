// Alerts the developer when community content is reported or a user is blocked
// (App Store Guideline 1.2 — reports must be reviewed and acted on within 24h).
// Always logs. Also emails via Resend when RESEND_API_KEY and MODERATION_ALERT_EMAIL
// are set in the environment; without them it is log-only.
async function notifyModerators(subject, lines = []) {
  const body = lines.join('\n')
  console.warn(`[community][MODERATION] ${subject}\n${body}`)
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.MODERATION_ALERT_EMAIL
  if (!apiKey || !to) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MODERATION_FROM_EMAIL || 'Ascendus Moderation <onboarding@resend.dev>',
        to: [to],
        subject: `[Ascendus moderation] ${subject}`,
        text: body,
      }),
    })
  } catch (err) {
    console.error('[community][moderation alert email]', err.message)
  }
}

module.exports = { notifyModerators }
