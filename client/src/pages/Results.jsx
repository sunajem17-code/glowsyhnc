import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, ArrowRight, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Info } from 'lucide-react'
import useStore from '../store/useStore'
import GlowScoreRing from '../components/GlowScoreRing'
import UMaxScoreBadge from '../components/UMaxScoreBadge'
import ScoreCard from '../components/ScoreCard'
import MotionPage from '../components/MotionPage'
import { postureGrade, scoreColor } from '../utils/analysis'

// ─── PSL Metric Row ───────────────────────────────────────────────────────────

const COLOR_MAP = {
  green: { bar: 'bg-success', text: 'text-success', badge: 'bg-green-50 dark:bg-green-900/20 text-success' },
  amber: { bar: 'bg-[#F5A623]', text: 'text-[#F5A623]', badge: 'bg-amber-50 dark:bg-amber-900/20 text-[#F5A623]' },
  red: { bar: 'bg-warning', text: 'text-warning', badge: 'bg-red-50 dark:bg-red-900/20 text-warning' },
}

function PSLMetricRow({ label, score, detail, subtext, note }) {
  const [open, setOpen] = useState(false)
  const c = COLOR_MAP[scoreColor(score)]
  const pct = ((score - 1) / 9) * 100

  return (
    <div className="border-b border-default last:border-0">
      <button className="w-full flex items-center gap-3 py-3" onClick={() => setOpen(o => !o)}>
        {/* Score pill */}
        <div className={`w-11 text-center py-1 rounded-lg text-xs font-mono font-bold flex-shrink-0 ${c.badge}`}>
          {score.toFixed(1)}
        </div>
        {/* Label + bar */}
        <div className="flex-1 text-left">
          <p className="text-sm font-heading font-semibold text-primary leading-tight">{label}</p>
          {detail && <p className="text-[10px] text-secondary font-body mt-0.5">{detail}</p>}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${c.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            {subtext && <span className={`text-[9px] font-heading font-bold flex-shrink-0 ${c.text}`}>{subtext}</span>}
          </div>
        </div>
        {note && (open ? <ChevronUp size={13} className="text-secondary flex-shrink-0" /> : <ChevronDown size={13} className="text-secondary flex-shrink-0" />)}
      </button>

      <AnimatePresence>
        {open && note && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-secondary font-body leading-relaxed">{note}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, emoji, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card mb-3">
      <button className="w-full flex items-center gap-2 mb-1" onClick={() => setOpen(o => !o)}>
        <span className="text-base">{emoji}</span>
        <h2 className="font-heading font-bold text-sm text-primary flex-1 text-left">{title}</h2>
        {open ? <ChevronUp size={14} className="text-secondary" /> : <ChevronDown size={14} className="text-secondary" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Results Page ────────────────────────────────────────────────────────

export default function Results() {
  const navigate = useNavigate()
  const { currentScan } = useStore()

  if (!currentScan) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <p className="text-5xl mb-4">📸</p>
        <h2 className="font-heading font-bold text-xl text-primary mb-2">No scan yet</h2>
        <p className="text-secondary text-sm font-body mb-6">Take your first scan to see your results here.</p>
        <button onClick={() => navigate('/scan')} className="btn-primary max-w-xs">Start Scan</button>
      </div>
    )
  }

  const {
    glowScore, faceData, bodyData, faceTotalScore, bodyTotalScore,
    presentationScore, insights, umaxScore, tier, weakMetrics, gender,
  } = currentScan

  const psl = faceData?.psl

  function handleShare() {
    const tierLabel = tier?.label ?? 'N/A'
    const text = `My Glow Score: ${glowScore}/100 — ${tierLabel}\nAnalyzed with GlowSync 🌟`
    if (navigator.share) navigator.share({ title: 'My GlowSync Results', text, url: window.location.origin })
    else navigator.clipboard?.writeText(text)
  }

  return (
    <MotionPage className="px-4">
      {/* Header */}
      <div className="pt-10 pb-3 flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary">Your Results</h1>
          <p className="text-xs text-secondary font-body">
            {new Date(currentScan.analyzedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {gender && <span className="ml-1 capitalize">· {gender}</span>}
          </p>
        </div>
        <button onClick={handleShare} className="w-9 h-9 bg-card border border-default rounded-xl flex items-center justify-center">
          <Share2 size={15} className="text-secondary" />
        </button>
      </div>

      {/* ── Glow Score (hero) ────────────────────────────────── */}
      <div className="mb-4">
        <UMaxScoreBadge
          umaxScore={umaxScore ?? 5}
          gender={gender ?? 'male'}
          showScale
        />
      </div>

      {/* ── Glow Score (holistic) ─────────────────────────────── */}
      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <GlowScoreRing score={glowScore} size="large" animated />
          <div className="flex-1">
            <p className="font-heading font-bold text-base text-primary mb-0.5">Glow Score</p>
            <p className="text-xs text-secondary font-body leading-relaxed">
              Holistic score combining face (40%), body (35%), and overall presentation (25%).
            </p>
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              {[
                { label: 'Face', val: faceTotalScore, color: '#1A6B5C' },
                { label: 'Body', val: bodyTotalScore, color: '#F5A623' },
                { label: 'Presence', val: presentationScore, color: '#34C759' },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className="font-mono font-bold text-base" style={{ color }}>{val?.toFixed(1)}</p>
                  <p className="text-[9px] text-secondary font-body">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── What's dragging you down ──────────────────────────── */}
      {weakMetrics?.length > 0 && (
        <div className="card mb-4 border-2 border-warning/30 bg-orange-50/50 dark:bg-orange-900/10">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-warning flex-shrink-0" />
            <h2 className="font-heading font-bold text-sm text-primary">Biggest Opportunities</h2>
            <span className="ml-auto text-[9px] text-secondary font-body">Top 3 metrics to target</span>
          </div>
          <div className="space-y-3">
            {weakMetrics.map((m, i) => (
              <div key={m.key} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-warning">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-heading font-bold text-primary">{m.label}</p>
                    <span className="text-[9px] font-mono font-bold text-warning">{m.score.toFixed(1)}/10</span>
                  </div>
                  <p className="text-[10px] text-secondary font-body mt-0.5 leading-relaxed">{m.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Facial Metrics ───────────────────────────────────── */}
      {psl && (
        <Section title="Facial Analysis" emoji="👁️">
          <PSLMetricRow
            label="Canthal Tilt"
            score={psl.canthalTilt.score}
            detail={`${psl.canthalTilt.label} tilt · ${psl.canthalTilt.angle > 0 ? '+' : ''}${psl.canthalTilt.angle}° from horizontal`}
            subtext={psl.canthalTilt.label}
            note="Positive canthal tilt (outer corner higher than inner) is the #1 hunter-eye indicator. Ideal: +3° to +8°. Canthoplasty is a surgical option for correction."
          />
          <PSLMetricRow
            label="Hunter Eyes"
            score={psl.hunterEyes.score}
            detail={`Eye type: ${psl.hunterEyes.type}`}
            subtext={psl.hunterEyes.type}
            note="Hunter eyes = deep-set, hooded, narrow aperture, strong brow ridge. Prey eyes = wide, round, prominent. Brow grooming, reduced eye puffiness (sleep/hydration), and lighting can optimize appearance."
          />
          <PSLMetricRow
            label="Facial Thirds"
            score={psl.facialThirds.score}
            detail={`Upper ${psl.facialThirds.upper}% · Mid ${psl.facialThirds.mid}% · Lower ${psl.facialThirds.lower}%`}
            subtext="Ideal: 33/33/33"
            note="Ideal facial thirds are roughly equal (1:1:1 ratio — forehead to brow, brow to nose base, nose base to chin). Hairstyle adjusts upper third; beard length adjusts lower third."
          />
          <PSLMetricRow
            label="Jaw Structure & Gonial Angle"
            score={psl.gonialAngle.score}
            detail={`Estimated gonial angle: ~${psl.gonialAngle.degrees}°`}
            subtext={`${psl.gonialAngle.degrees}°`}
            note={`Ideal male gonial angle: 115–122°. Ideal female: 120–128°. Lower angle = sharper, more defined jaw. Body fat reduction is the #1 non-surgical intervention. Mewing protocol for long-term bone remodeling.`}
          />
          <PSLMetricRow
            label="Cheekbone Prominence"
            score={psl.cheekbones.score}
            detail="High, defined cheekbones = elevated Glow Score"
            note="Cheekbones become more visible at lower body fat. Contouring is a cosmetic option. Buccal fat removal surgery reduces cheek fullness."
          />
          <PSLMetricRow
            label="Facial Width-to-Height Ratio"
            score={psl.fwhr.score}
            detail={`fWHR: ${psl.fwhr.value} (${gender === 'female' ? 'ideal 1.7–1.9' : 'ideal 1.9–2.1'})`}
            subtext={`${psl.fwhr.value}`}
            note="fWHR = face width divided by height of upper face. Higher ratios (broader, shorter face) correlate with perceived dominance in men. Hairstyle can subtly influence perceived fWHR."
          />
          <PSLMetricRow
            label="Midface / Maxilla"
            score={psl.maxilla.score}
            detail="Forward maxilla projection is a key structural metric"
            note="Forward maxilla (midface) projection is associated with top-tier scores. Mewing (correct tongue posture on the palate) is the primary accessible intervention — requires years of consistency."
          />
          <PSLMetricRow
            label="Nose Harmony"
            score={psl.noseHarmony.score}
            detail="Proportionality of nose relative to face"
            note="Nose should be ~⅓ of face length and ~⅔ of mouth width. Non-surgical rhinoplasty (filler) can address minor asymmetries. Hairstyle framing reduces visual prominence."
          />
          <PSLMetricRow
            label="Skin Texture"
            score={psl.skinTexture.score}
            detail="Texture clarity, uniformity, and surface quality"
            note="Consistent retinoid use (adapalene/tretinoin) + daily SPF dramatically improves skin texture within 8–12 weeks. BHA/AHA exfoliation 2–3x/week accelerates cell turnover."
          />
        </Section>
      )}

      {/* ── Face Feature Breakdown ────────────────────────────── */}
      <Section title="Face Feature Breakdown" emoji="👤" defaultOpen={false}>
        <div className="space-y-0">
          {[
            { label: 'Facial Symmetry', score: faceData?.symmetry, note: 'Measured by comparing luminance between mirrored halves. Sleeping on your back, correcting dominant chewing side, and fixing posture all improve symmetry over time.' },
            { label: 'Jawline Definition', score: faceData?.jawlineDefinition, note: 'Correlates directly with body fat % around the face. Sub-12% BF for men, sub-20% for women dramatically reveals the jawline. Mewing for long-term structural improvement.' },
            { label: 'Skin Clarity', score: faceData?.skinClarity, note: 'Assessed via pixel uniformity in the facial region. Consistent cleanser → treatment → moisturizer → SPF routine produces visible change in 4–8 weeks.' },
            { label: 'Facial Proportions', score: faceData?.facialProportions, note: 'Ideal face has equal facial thirds and a width-to-height ratio near golden ratio. Structural.' },
            { label: 'Eye Area', score: faceData?.eyeArea, note: 'Accounts for eye shape, perceived depth, and area. Addressed via sleep, hydration, targeted eye cream, and strategic brow grooming.' },
            { label: 'Overall Harmony', score: faceData?.facialHarmony, note: 'How all facial features read together as a cohesive unit. Improves as individual metrics improve.' },
          ].map(m => (
            <PSLMetricRow key={m.label} label={m.label} score={m.score ?? 0} note={m.note} />
          ))}
        </div>
      </Section>

      {/* ── Body Analysis ─────────────────────────────────────── */}
      <Section title="Body Analysis" emoji="💪" defaultOpen={false}>
        <div className="space-y-0">
          {[
            { label: 'Shoulder-Waist Ratio (V-Taper)', score: bodyData?.shoulderWaistRatio, note: gender === 'female' ? 'Ideal female shoulder-to-hip ratio: ~1.4. Shoulder development (lateral raises) + core tightening improves visual ratio.' : 'Ideal male shoulder-to-waist: ~1.6. Lateral delt development + caloric deficit = fastest V-taper improvement.' },
            { label: `Posture · Grade ${bodyData?.postureGradeValue ?? '—'}`, score: bodyData?.posture, note: `Forward head posture reduces perceived jaw definition and height. Daily chin tucks, wall angels, and hip flexor stretches. Grade ${bodyData?.postureGradeValue} can improve 2 grades in 6 weeks.` },
            { label: 'Body Proportions', score: bodyData?.bodyProportions, note: 'Torso-to-leg ratio, limb symmetry, and shoulder width relative to height.' },
            { label: 'Body Composition', score: bodyData?.bodyComposition, note: `Visual category: ${bodyData?.compositionCategory}. Lower body fat directly improves facial definition (the face thins out), V-taper ratio, and muscle visibility.` },
          ].map(m => (
            <PSLMetricRow key={m.label} label={m.label} score={m.score ?? 0} note={m.note} />
          ))}
        </div>

        {/* Forward head angle callout */}
        {bodyData?.forwardHeadAngle > 8 && (
          <div className="mt-2 px-3 py-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
            <p className="text-xs text-orange-600 dark:text-orange-400 font-body">
              ⚠️ Forward head angle ~{bodyData.forwardHeadAngle.toFixed(0)}° (neutral = &lt;5°). This reduces perceived jaw definition. Daily chin tucks + screen height adjustments.
            </p>
          </div>
        )}
      </Section>

      {/* ── Key Insights ──────────────────────────────────────── */}
      {insights?.length > 0 && (
        <Section title="Key Insights" emoji="🎯">
          <div className="space-y-2.5 pt-1">
            {insights.map((ins, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-2.5"
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ins.priority === 'high' ? 'bg-warning' : 'bg-[#F5A623]'}`} />
                <div>
                  <p className="text-xs font-heading font-bold text-primary capitalize">{ins.metric}</p>
                  <p className="text-xs text-secondary font-body mt-0.5 leading-relaxed">{ins.insight}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* ── CTAs ──────────────────────────────────────────────── */}
      <div className="space-y-3 pb-8 pt-1">
        <button onClick={() => navigate('/plan')} className="btn-primary flex items-center justify-center gap-2">
          See My 12-Week Action Plan <ArrowRight size={15} />
        </button>
        <button onClick={() => navigate('/scan')} className="btn-ghost border border-default">
          Take Another Scan
        </button>
      </div>
    </MotionPage>
  )
}
