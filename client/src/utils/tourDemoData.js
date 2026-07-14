// Canned content for the post-onboarding Feature Tour. Every string a user
// sees in a "demo" step lives here, in one place, so it's reviewable without
// digging through component code. Per the API-abuse guardrail decision, none
// of this hits a real backend/AI endpoint — it's all pre-written, optionally
// interpolated client-side with the user's own already-loaded scan data.
import BEFORE_IMG from '../assets/transformations/before.jpg'
import AFTER_IMG from '../assets/transformations/after.jpg'

// ── AI Coach demo ──────────────────────────────────────────────────────────

export const AI_COACH_DEMO_QUESTIONS = [
  { id: 'opportunity', label: "What's my biggest opportunity right now?" },
  { id: 'timeline', label: 'How long until I see results?' },
  { id: 'today', label: 'What should I actually do today?' },
]

export const PILLAR_LABELS = {
  harmony: 'facial harmony',
  angularity: 'jaw & angularity',
  features: 'feature balance',
  dimorphism: 'dimorphism',
}

// questionId -> canned response, interpolated with real local scan data so it
// doesn't read as generic. Falls back to sensible defaults if data is missing.
export function getAICoachDemoAnswer(questionId, { name, score, weakestPillarLabel } = {}) {
  const firstName = name?.split(' ')[0] || 'there'
  const weak = weakestPillarLabel || 'jawline definition'
  const s = typeof score === 'number' ? score.toFixed(1) : '6.5'

  switch (questionId) {
    case 'opportunity':
      return `Hey ${firstName} — based on your scan, ${weak} is where you've got the most room to move. It's usually the fastest-improving area too, so that's genuinely good news. Once you're in, I'll build your whole plan around it.`
    case 'timeline':
      return `Most people see a visible shift in 3-4 weeks if they're consistent — skin and grooming changes show up fastest, structural stuff like jaw and posture takes longer but compounds. You're at ${s}/10 right now; realistic movement over 90 days is +0.8 to +1.4.`
    case 'today':
      return `Smallest thing with the biggest payoff: start your skincare routine tonight, not tomorrow. Cleanser, moisturizer, SPF in the morning. That's it. Everything else in your plan builds on that baseline.`
    default:
      return `Good question — once you're through this tour, ask me anything for real. I'll have your actual scan data, not a canned answer like this one.`
  }
}

// ── Community demo ────────────────────────────────────────────────────────

export const COMMUNITY_DEMO_POST = {
  id: 'demo-post',
  display_name: 'Jordan M.',
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  post_type: 'glow_up',
  score_before: 5.4,
  score_after: 6.9,
  before_photo_url: BEFORE_IMG,
  photo_url: AFTER_IMG,
  caption: '8 weeks of actually following my plan instead of just reading it. Skin cleared up, dropped some weight, way more confident tbh 🙌',
  likes_count: 214,
  comments_count: 2,
  user_liked: false,
  is_mine: false,
  avg_rating: null,
  rating_count: 0,
  user_rating: null,
}

export const COMMUNITY_DEMO_COMMENTS = [
  { id: 'c1', display_name: 'Alex R.', text: 'the skin difference alone is wild, what routine', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'c2', display_name: 'Sam T.', text: 'jawline came in so much more too 🔥', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
]

// ── Photo Ranker demo (SwipeMaxx / TinderMaxx) ────────────────────────────
// No real sample face photos exist in the app's asset bundle, and faking one
// would be dishonest about what the real feature does. Illustrated "shooting
// condition" cards teach the actual lesson (lighting/angle matter more than
// anything else) without pretending to analyze a real face.

export const PHOTO_RANKER_DEMO_CARDS = [
  { id: 1, emoji: '📸', label: 'Harsh flash, indoors', detail: 'Direct flash flattens your features and blows out skin texture.', score: 61 },
  { id: 2, emoji: '🌅', label: 'Golden hour, natural light', detail: 'Soft directional light does more for a photo than any filter ever will.', score: 94 },
  { id: 3, emoji: '🌫️', label: 'Blurry, shot from far away', detail: "Can't rank what we can't see clearly — always the first thing to fix.", score: 48 },
]

export const PHOTO_RANKER_WINNER_ID = 2
