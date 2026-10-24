// Public affiliate identifier already used by this application's Amazon.ca
// catalogue. Never let the model invent affiliate tags, ASINs or checkout URLs.
const DEFAULT_TAG = 'ascendusapp05-20'

function amazonUrl(query, env = process.env) {
  const tag = (env.AMAZON_ASSOCIATE_TAG || DEFAULT_TAG).trim()
  if (!/^[A-Za-z0-9_-]+$/.test(tag)) throw new Error('Invalid Amazon affiliate tag configuration')
  const text = typeof query === 'string' ? query.replace(/[\r\n\t]/g, ' ').trim().slice(0, 160) : ''
  if (!text) throw new Error('A product search query is required')
  const url = new URL('https://www.amazon.ca/s')
  url.searchParams.set('k', text)
  url.searchParams.set('tag', tag)
  return url.toString()
}

function productWithLink(product) {
  if (!isAllowedCosmeticProduct(product)) throw new Error('Unsupported cosmetic product recommendation')
  return { ...product, amazonUrl: amazonUrl(product.searchQuery || product.name) }
}

// Rewrites legacy/model Amazon links to the app's one allowed marketplace/tag.
// Only the independently generated search/detail destination is kept.
function normalizeAmazonLinks(text) {
  return text.replace(/https?:\/\/(?:www\.)?(?:amazon\.[a-z.]+|amzn\.to)\/[^\s<>)]*/gi, raw => {
    try {
      const parsed = new URL(raw)
      if (parsed.hostname === 'amzn.to') return '(Use the Amazon product search below.)'
      const query = parsed.searchParams.get('k')
      const asin = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]
      return query || asin ? amazonUrl(query || asin) : '(Use the Amazon product search below.)'
    } catch { return '(Use the Amazon product search below.)' }
  })
}

const UNSUITABLE_COSMETIC_PRODUCT = /jaw[ -]?train|jawliner|mastic[ -]?gum|minoxidil|bimatoprost|latisse|prostaglandin|derma[ -]?(?:roll|stamp)|microneedl|inject(?:ion|able)|peptide|ghk[ -]?cu|canthal[ -]?tape|eyelid[ -]?tape|eye[ -]?pull|growth[ -]?hormone|testosterone|anabolic/i

const COACH_REPLY_SCHEMA = { type: 'object', properties: {
  message: { type: 'string' },
  products: { type: 'array', maxItems: 2, items: { type: 'object', properties: {
    name: { type: 'string' }, searchQuery: { type: 'string' }, reason: { type: 'string' },
  } } },
} }
const PRODUCT_GUIDANCE = `PRODUCT RECOMMENDATIONS:
Respond ONLY with JSON {"message":"your conversational answer", "products":[{"name":"real brand and product", "searchQuery":"exact brand and product", "reason":"realistic purpose and limitation"}]}.
Keep the conversational answer in message. Put all commercial product names you recommend in products, not just in message. Use zero products unless a product is relevant; at most two, prioritizing the user's actual concern and a simple routine. A structural concern may require no product. Mention free actions first when helpful. Never invent ASINs, availability, prices, discounts or URLs; the server adds Amazon affiliate searches. Do not claim a search link is a verified listing. Select on suitability, not commission. Never link prescription drugs, minoxidil/prostaglandin lash products, periocular needling/injection kits, eye-pulling devices or hormone/peptide supplements as cosmetic fixes. Do not make body/eye shape or guaranteed score improvement claims. Use products labelled for their intended area and do not force an eye cream for normal eyelids or structural hollows. If images are unavailable, rely on actual saved evidence or the user's stated concern; label generic options as optional.`

function isAllowedCosmeticProduct(product) {
  return !UNSUITABLE_COSMETIC_PRODUCT.test(`${product.name} ${product.searchQuery}`)
}

function allowsProductRecommendations(question) {
  return !/canthoplast|canthopex|blepharoplast|filler|surgery|surgical|implant|needl|orbital decompression|minoxidil|bimatoprost|latisse|prostaglandin|micro[ -]?needl|derma[ -]?stamp|inject|peptide|hormone|glp[ -]?1|testosterone|jaw[ -]?train|(?:change|alter|fix).{0,40}(?:canthal|orbital|eye shape|bone)|(?:canthal|orbital|eye shape|bone).{0,40}(?:chang|fix|reshape)/i.test(question)
}

function formatCoachReply(raw, { allowProducts = true } = {}) {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const reply = JSON.parse(text)
  if (typeof reply.message !== 'string' || !reply.message.trim() || !Array.isArray(reply.products) || reply.products.length > 2) throw new Error('Invalid coach reply')
  const links = (allowProducts ? reply.products : []).filter(product => !UNSUITABLE_COSMETIC_PRODUCT.test(`${product.name} ${product.searchQuery}`)).map(product => {
    if (typeof product.name !== 'string' || !product.name.trim() || typeof product.reason !== 'string' || typeof product.searchQuery !== 'string') throw new Error('Invalid product recommendation')
    return `${product.name.trim()} — ${product.reason.trim()}\n${amazonUrl(product.searchQuery)}`
  })
  return normalizeAmazonLinks(reply.message.trim() + (links.length ? `\n\n${links.join('\n\n')}\n\nAffiliate links: Ascendus may earn a commission.` : ''))
}

module.exports = { amazonUrl, productWithLink, isAllowedCosmeticProduct, normalizeAmazonLinks, COACH_REPLY_SCHEMA, PRODUCT_GUIDANCE, formatCoachReply, allowsProductRecommendations }
