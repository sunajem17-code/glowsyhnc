'use strict'
/**
 * Ascendus Mailer — Resend-powered email automation
 * Handles: Day-3 upgrade nudge, weekly Pro recap, affiliate click tracking
 */

const { Resend }      = require('resend')
const { createClient } = require('@supabase/supabase-js')
const fs              = require('fs')
const path            = require('path')
const crypto          = require('crypto')

// Lazy init — avoids crash at startup if env vars not yet loaded
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const supabase = supabaseKey
  ? createClient(process.env.SUPABASE_URL, supabaseKey)
  : null

const FROM = 'Ascendus <noreply@ascendus.store>'
const TEMPLATES = {
  nudge:  path.join(__dirname, 'emails', 'upgrade-nudge.html'),
  weekly: path.join(__dirname, 'emails', 'weekly-recap.html'),
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadTemplate(name) {
  return fs.readFileSync(TEMPLATES[name], 'utf8')
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function deltaArrow(val) {
  if (val > 0)  return '↑'
  if (val < 0)  return '↓'
  return '→'
}

function deltaClass(val) {
  if (val > 0)  return 'delta-up'
  if (val < 0)  return 'delta-down'
  return 'delta-flat'
}

function fmtDelta(val) {
  if (!val) return '0.0'
  return `${Math.abs(val).toFixed(1)}`
}

const WEEKLY_TIPS = {
  skin:     'Your skin score is your lowest metric. Try adding SPF 50 sunscreen every morning — it\'s the single highest-impact skin move. Dermatologists rank it above any serum.',
  jawline:  'To improve your jawline score, focus on two things: drop body fat to below 15% (the jaw definition follows) and try mastic gum for 20 min/day to build masseter muscle.',
  eye:      'Eye area scores improve with sleep quality first (7–9 hrs), then caffeine eye cream for puffiness. Hunter eye appearance is heavily influenced by forward orbital growth via correct mewing posture.',
  grooming: 'Your grooming score has room to grow. A clean fade every 2–3 weeks and a consistent skincare routine (cleanser + moisturiser + SPF) moves this metric faster than anything else.',
  default:  'Consistency beats intensity. Small daily wins compound. Keep scanning weekly to track your progress — users who scan every week see 0.3–0.5 point gains per month on average.',
}

// ── Day-3 Upgrade Nudge ───────────────────────────────────────────────────────

async function sendUpgradeNudge(userId) {
  // 1. Fetch user profile
  const { data: profile, error: pe } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan, email_unsubscribed, created_at')
    .eq('id', userId)
    .single()

  if (pe || !profile) throw new Error(`Profile not found: ${userId}`)
  if (profile.email_unsubscribed) return { skipped: 'unsubscribed' }
  if (profile.plan !== 'free')    return { skipped: 'not_free' }

  // 2. Check already sent
  const { data: existing } = await supabase
    .from('email_sends')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', 'day3_nudge')
    .limit(1)

  if (existing?.length) return { skipped: 'already_sent' }

  // 3. Get latest scan
  const { data: scan } = await supabase
    .from('user_scores')
    .select('overall_score, psl_tier, jawline_score, celebrity_match')
    .eq('user_id', userId)
    .order('scan_date', { ascending: false })
    .limit(1)
    .single()

  const firstName = (profile.full_name || profile.email.split('@')[0]).split(' ')[0]
  const overallScore  = scan?.overall_score  ?? '?'
  const pslTier       = scan?.psl_tier       ?? 'Pending'
  const jawlineScore  = scan?.jawline_score  ?? '?'
  const celebMatch    = scan?.celebrity_match ?? 'Pending'

  // 4. Build email
  const html = fill(loadTemplate('nudge'), {
    first_name:      firstName,
    overall_score:   overallScore,
    psl_tier:        pslTier,
    jawline_score:   jawlineScore,
    celebrity_match: celebMatch,
    user_id:         userId,
  })

  // 5. Send
  const { data: sent, error: se } = await getResend().emails.send({
    from:    FROM,
    to:      profile.email,
    subject: `${firstName}, your Ascendus report is still locked 🔒`,
    html,
  })

  if (se) throw new Error(`Resend error: ${se.message}`)

  // 6. Log
  await supabase.rpc('log_email_send', {
    p_user_id:  userId,
    p_type:     'day3_nudge',
    p_resend_id: sent.id,
  })

  console.log(`📧 Nudge sent → ${profile.email} (${sent.id})`)
  return { success: true, resend_id: sent.id, email: profile.email }
}

// ── Weekly Pro Recap ──────────────────────────────────────────────────────────

async function sendWeeklyRecap(userId) {
  // 1. Fetch from view
  const { data: recap, error: re } = await supabase
    .from('pro_users_weekly_recap')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (re || !recap) throw new Error(`Recap data not found for: ${userId}`)

  // 2. Fetch profile for email + unsubscribe check
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, email_unsubscribed')
    .eq('id', userId)
    .single()

  if (!profile) throw new Error(`Profile not found: ${userId}`)
  if (profile.email_unsubscribed) return { skipped: 'unsubscribed' }

  // 3. Fetch last 6 weeks for timeline
  const { data: history } = await supabase
    .from('user_scores')
    .select('week_number, overall_score')
    .eq('user_id', userId)
    .order('week_number', { ascending: false })
    .limit(6)

  // 4. Build timeline HTML
  const maxScore = Math.max(...(history || []).map(h => h.overall_score || 0), 1)
  const historyHtml = (history || []).reverse().map(h => {
    const pct = Math.round(((h.overall_score || 0) / 10) * 100)
    return `<div class="timeline-row">
      <span class="t-week">Wk ${h.week_number}</span>
      <div class="t-bar-wrap"><div class="t-bar" style="width:${pct}%"></div></div>
      <span class="t-score">${Number(h.overall_score || 0).toFixed(1)}</span>
    </div>`
  }).join('\n')

  // 5. Calculate deltas
  const curr = recap
  const prev = {
    overall:  recap.prev_overall_score,
    jawline:  recap.prev_jawline_score,
    skin:     recap.prev_skin_score,
    eye:      recap.prev_eye_score,
    grooming: recap.prev_grooming_score,
  }

  const overall_delta  = curr.current_score  - (prev.overall  || curr.current_score)
  const jaw_delta      = curr.jawline_score  - (prev.jawline  || curr.jawline_score)
  const skin_delta_val = curr.skin_score     - (prev.skin     || curr.skin_score)
  const eye_delta_val  = curr.eye_score      - (prev.eye      || curr.eye_score)
  const grm_delta_val  = curr.grooming_score - (prev.grooming || curr.grooming_score)

  // 6. Pick lowest metric for tip
  const metrics = { skin: curr.skin_score, jawline: curr.jawline_score, eye: curr.eye_score, grooming: curr.grooming_score }
  const lowestKey = Object.keys(metrics).reduce((a, b) => (metrics[a] < metrics[b] ? a : b))
  const weeklyTip = WEEKLY_TIPS[lowestKey] || WEEKLY_TIPS.default

  const firstName = (profile.full_name || profile.email.split('@')[0]).split(' ')[0]

  // 7. Build email
  const html = fill(loadTemplate('weekly'), {
    user_id:          userId,
    week_number:      curr.week_number,
    current_score:    Number(curr.current_score).toFixed(1),
    score_delta:      fmtDelta(overall_delta),
    delta_arrow:      deltaArrow(overall_delta),
    delta_class:      deltaClass(overall_delta),
    streak_weeks:     recap.streak_weeks || 1,

    jawline_score:       Number(curr.jawline_score  || 0).toFixed(1),
    jawline_pct:         Math.round((curr.jawline_score  || 0) * 10),
    jawline_delta:       fmtDelta(jaw_delta),
    jawline_delta_arrow: deltaArrow(jaw_delta),
    jawline_delta_class: deltaClass(jaw_delta),

    skin_score:       Number(curr.skin_score     || 0).toFixed(1),
    skin_pct:         Math.round((curr.skin_score     || 0) * 10),
    skin_delta:       fmtDelta(skin_delta_val),
    skin_delta_arrow: deltaArrow(skin_delta_val),
    skin_delta_class: deltaClass(skin_delta_val),

    eye_score:       Number(curr.eye_score      || 0).toFixed(1),
    eye_pct:         Math.round((curr.eye_score      || 0) * 10),
    eye_delta:       fmtDelta(eye_delta_val),
    eye_delta_arrow: deltaArrow(eye_delta_val),
    eye_delta_class: deltaClass(eye_delta_val),

    grooming_score:       Number(curr.grooming_score || 0).toFixed(1),
    grooming_pct:         Math.round((curr.grooming_score || 0) * 10),
    grooming_delta:       fmtDelta(grm_delta_val),
    grooming_delta_arrow: deltaArrow(grm_delta_val),
    grooming_delta_class: deltaClass(grm_delta_val),

    weekly_history: historyHtml,
    weekly_tip:     weeklyTip,
  })

  // 8. Send
  const { data: sent, error: se } = await getResend().emails.send({
    from:    FROM,
    to:      profile.email,
    subject: `Week ${curr.week_number} recap: you scored ${Number(curr.current_score).toFixed(1)}/10`,
    html,
  })

  if (se) throw new Error(`Resend error: ${se.message}`)

  // 9. Log
  await supabase.rpc('log_email_send', {
    p_user_id:   userId,
    p_type:      'weekly_recap',
    p_resend_id: sent.id,
  })

  console.log(`📧 Weekly recap sent → ${profile.email} (${sent.id})`)
  return { success: true, resend_id: sent.id, email: profile.email }
}

// ── Affiliate Click Tracker ───────────────────────────────────────────────────

async function trackAffiliateClick(data) {
  const {
    user_id, utm_source, utm_medium, utm_campaign,
    utm_content, product_name, product_url, ip,
  } = data

  const ip_hash = ip
    ? crypto.createHmac('sha256', process.env.IP_SALT || 'default-salt').update(ip).digest('hex')
    : null

  const { error } = await supabase.from('affiliate_clicks').insert({
    user_id:      user_id || null,
    utm_source:   utm_source   || null,
    utm_medium:   utm_medium   || null,
    utm_campaign: utm_campaign || null,
    utm_content:  utm_content  || null,
    product_name: product_name || null,
    product_url:  product_url  || null,
    ip_hash,
  })

  if (error) console.error('Affiliate click log error:', error.message)
  return { logged: !error }
}

module.exports = { sendUpgradeNudge, sendWeeklyRecap, trackAffiliateClick }
