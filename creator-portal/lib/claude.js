import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Extract US audience percentage from an analytics screenshot.
 *
 * @param {string} imageUrl - Public or signed URL of the screenshot
 * @returns {{ us_pct: number }} Extracted US audience percentage (0–100)
 */
export async function extractUsAudiencePct(imageUrl) {
  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: imageUrl },
          },
          {
            type: 'text',
            text: `This is a TikTok or Instagram analytics screenshot showing audience geography.
Find the United States row and extract the percentage shown next to it.
Reply with ONLY a JSON object in this exact format, nothing else:
{"us_pct": <number between 0 and 100>}
If you cannot find a US percentage, reply with {"us_pct": 0}.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0]?.text ?? '{}'
  try {
    const parsed = JSON.parse(text)
    const us_pct = Number(parsed.us_pct)
    if (isNaN(us_pct)) return { us_pct: 0 }
    return { us_pct: Math.min(100, Math.max(0, us_pct)) }
  } catch {
    return { us_pct: 0 }
  }
}
