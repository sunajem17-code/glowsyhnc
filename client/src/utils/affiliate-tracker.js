/**
 * Ascendus Affiliate Tracker
 * Tracks product clicks with UTM attribution and fires to the backend
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app'

// ── Product catalogue ─────────────────────────────────────────────────────────
// Replace URL values with your actual Amazon Associates links
export const AFFILIATE_PRODUCTS = {
  // Skincare
  cerave_moisturiser: {
    name:     'CeraVe Moisturising Cream',
    category: 'skin',
    url:      'https://www.amazon.ca/dp/B00TTD9BRC?tag=ascendusapp05-20',
    reason:   'Your skin score is one of the fastest metrics to move. CeraVe restores your moisture barrier in 2 weeks — clearer, smoother skin directly raises your Ascendus skin pillar score.',
    icon:     '🧴',
  },
  vitamin_c_serum: {
    name:     'TruSkin Vitamin C Serum',
    category: 'skin',
    url:      'https://www.amazon.ca/dp/B01M0LXRGE?tag=ascendusapp05-20',
    reason:   'Uneven skin tone and dullness are two of the biggest skin score killers. Vitamin C serum visibly brightens and evens your complexion in 4–6 weeks — expect a measurable score jump on your next rescan.',
    icon:     '✨',
  },
  sunscreen_spf50: {
    name:     'EltaMD UV Clear SPF 46',
    category: 'skin',
    url:      'https://www.amazon.ca/dp/B002MSN3QQ?tag=ascendusapp05-20',
    reason:   'UV damage is the #1 cause of skin score decline over time. One daily application of SPF 46 stops future damage and lets your current routine actually work — the single highest ROI skincare purchase you can make.',
    icon:     '☀️',
  },
  // Jawline
  mastic_gum: {
    name:     'FALIM Mastic Gum (100 pcs)',
    category: 'jawline',
    url:      'https://www.amazon.ca/dp/B00BTHZNBQ?tag=ascendusapp05-20',
    reason:   'Jaw definition is a direct input into your Angularity pillar score. FALIM is 10x harder than regular gum — 20 minutes daily builds the masseter muscle. Most users see visible jaw definition within 8 weeks.',
    icon:     '🦷',
  },
  jawliner_gum: {
    name:     'Jawliner Chewing Gum',
    category: 'jawline',
    url:      'https://www.amazon.ca/dp/B08NJFNMJM?tag=ascendusapp05-20',
    reason:   'Engineered specifically for jaw training — 3 resistance levels mean you progress as you get stronger. Pairs directly with your 12-week plan to push your Angularity score higher faster than diet or gym work alone.',
    icon:     '💪',
  },
  // Grooming
  minoxidil_beard: {
    name:     'Kirkland 5% Minoxidil (6-month)',
    category: 'grooming',
    url:      'https://www.amazon.ca/dp/B001W6LQMY?tag=ascendusapp05-20',
    reason:   'A full beard dramatically improves your Dimorphism and Grooming scores by adding facial masculinity and framing your jaw. Minoxidil is the only clinically proven method — results appear in 3–4 months. This 6-month supply completes a full growth cycle.',
    icon:     '🧔',
  },
  derma_roller: {
    name:     'Derma Roller 0.5mm',
    category: 'grooming',
    url:      'https://www.amazon.ca/dp/B00QIUQHCY?tag=ascendusapp05-20',
    reason:   'Microneedling triggers collagen production and doubles minoxidil absorption when used together. Used weekly it also visibly tightens skin texture — two direct inputs into your skin and grooming scores simultaneously.',
    icon:     '🔬',
  },
  brow_gel: {
    name:     'Boy Brow Grooming Pomade',
    category: 'grooming',
    url:      'https://www.amazon.ca/dp/B073XZGC3M?tag=ascendusapp05-20',
    reason:   'Brow thickness and definition are among the most heavily weighted grooming metrics in your Ascendus scan. Structured brows frame the orbital area and lift your perceived facial harmony score — highest visual impact per dollar of any grooming product.',
    icon:     '🖤',
  },
}

// ── Track & navigate ──────────────────────────────────────────────────────────
export async function trackAndGo(productId, userId) {
  const product = AFFILIATE_PRODUCTS[productId]
  if (!product) return

  const utmUrl = `${product.url}&utm_source=ascendus&utm_medium=app&utm_campaign=product_rec&utm_content=${productId}`

  // Fire-and-forget — don't block the navigation
  fetch(`${API_URL}/webhooks/track-click`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id:      userId || null,
      product_name: productId,
      product_url:  product.url,
      utm_source:   'ascendus',
      utm_medium:   'app',
      utm_campaign: 'product_rec',
      utm_content:  productId,
    }),
  }).catch(() => {}) // silent fail — never block the user

  window.open(utmUrl, '_blank', 'noopener,noreferrer')
}

// ── Email UTM capture ─────────────────────────────────────────────────────────
const EMAIL_UTM_KEY = 'asc_email_utm'

export function captureEmailUTM() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('utm_source') === 'resend') {
    const data = {
      utm_source:   params.get('utm_source'),
      utm_medium:   params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content:  params.get('utm_content'),
      ref:          params.get('ref'),
      captured_at:  new Date().toISOString(),
    }
    try {
      sessionStorage.setItem(EMAIL_UTM_KEY, JSON.stringify(data))
    } catch (_) {}
  }
}

export function getEmailAttribution() {
  try {
    const raw = sessionStorage.getItem(EMAIL_UTM_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

// ── React Components ──────────────────────────────────────────────────────────
import { createElement } from 'react'

export function AffiliateButton({ productId, userId, className = '' }) {
  const product = AFFILIATE_PRODUCTS[productId]
  if (!product) return null

  return createElement(
    'button',
    {
      className,
      onClick: () => trackAndGo(productId, userId),
      style: { cursor: 'pointer' },
    },
    `${product.icon} ${product.name}`
  )
}

export function ProductRecommendations({ scores = {}, userId }) {
  // Find lowest-scoring category
  const categoryScores = {
    skin:     scores.skin     ?? 10,
    jawline:  scores.jawline  ?? 10,
    grooming: scores.grooming ?? 10,
  }
  const lowestCat = Object.keys(categoryScores).reduce((a, b) =>
    categoryScores[a] < categoryScores[b] ? a : b
  )

  const products = Object.entries(AFFILIATE_PRODUCTS)
    .filter(([, p]) => p.category === lowestCat)
    .slice(0, 3)

  if (!products.length) return null

  return createElement('div', { className: 'affiliate-recs' },
    createElement('p', {
      style: { fontSize: 11, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }
    }, `Top picks to boost your ${lowestCat} score`),

    ...products.map(([id, product]) =>
      createElement('div', {
        key: id,
        style: {
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px', marginBottom: 8,
          background: 'var(--card)', borderRadius: 10,
          border: '1px solid var(--border)',
        }
      },
        createElement('span', { style: { fontSize: 24, fontFamily: "'Apple Color Emoji','Noto Color Emoji',sans-serif" } }, product.icon),
        createElement('div', { style: { flex: 1 } },
          createElement('p', { style: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 } }, product.name),
          createElement('p', { style: { fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 } }, product.reason),
        ),
        createElement('button', {
          onClick: () => trackAndGo(id, userId),
          style: {
            flexShrink: 0, padding: '7px 12px', borderRadius: 8,
            background: 'var(--gold)', color: '#000', fontWeight: 700,
            fontSize: 12, border: 'none', cursor: 'pointer',
          }
        }, 'View >')
      )
    ),

    createElement('p', {
      style: { fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }
    }, 'Affiliate links, we earn a small commission at no cost to you')
  )
}
