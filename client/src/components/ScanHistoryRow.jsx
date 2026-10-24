import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, ChevronRight } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'
import { BACKEND_ORIGIN } from '../utils/backend'
import { getHistoryScoreColor } from '../utils/scanHistory'
import { loadScanMedia } from '../utils/scanPhotoDb'
import { getScanHistoryRowPresentation } from '../utils/scanHistoryPresentation'
import { getTier } from '../utils/analysis'
import useStore from '../store/useStore'
import { isCurrentAssessment, assessmentPresentation } from '../utils/assessment'

function thumbnail(url) {
  if (!url) return null
  if (/^(https?:|data:|blob:)/.test(url)) return url
  return `${BACKEND_ORIGIN}${url}`
}

function fmt(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Single scan row ───────────────────────────────────────────────────────────
export default function ScanHistoryRow({ scan, onTap, index, showChevron = true, canAccessProUi = true }) {
  const assessment = isCurrentAssessment(scan) ? scan.aiScore.assessment : null
  const scorePresentation = assessment ? assessmentPresentation(assessment) : null
  const profileGender = useStore(state => state.gender || state.userProfile?.gender || state.user?.gender)
  const [storedPhoto, setStoredPhoto] = useState(null)
  const directPhoto = scan.facePhotoUrl || scan.face_photo_url || scan.face_image_url || scan.bodyPhotoUrl || scan.body_photo_url || scan.body_image_url
  useEffect(() => {
    let active = true
    if (!directPhoto && scan.id) {
      loadScanMedia(scan.id).then(media => { if (active) setStoredPhoto(media?.photo ?? null) })
    }
    return () => { active = false }
  }, [scan.id, directPhoto])
  const thumb = thumbnail(directPhoto || storedPhoto)
  const date = fmt(scan.analyzedAt || scan.scan_date)
  const score = scan.glowScore != null
    ? (typeof scan.glowScore === 'number' ? scan.glowScore : parseFloat(scan.glowScore))
    : null
  const ratingPresentation = getScanHistoryRowPresentation(canAccessProUi)
  const tierGender = scan.gender || profileGender
  const tier = scan.tier || (!assessment && score != null && ['male', 'female'].includes(tierGender)
    ? getTier(score, tierGender)?.label ?? null
    : scorePresentation?.tierLabel ?? null)

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { triggerHaptic(); onTap(scan) }}
      className="w-full text-left flex items-center gap-4"
      style={{
        background: '#141414', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18, padding: '14px 14px 14px 14px',
        marginBottom: 10,
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 58, height: 58, borderRadius: 14, overflow: 'hidden',
        background: '#222', flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {thumb ? (
          <img src={thumb} alt="Scan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-[15px] text-primary leading-tight">{date}</p>
        {tier && (
          <span className="mt-0.5 inline-flex h-[13px] items-center" aria-label={ratingPresentation.blurRating ? 'Rating hidden' : undefined}>
            {ratingPresentation.blurRating
              ? <span aria-hidden="true" style={{ width: 102, height: 9, borderRadius: 99, background: '#fff', filter: 'blur(5px)', opacity: 0.9 }} />
              : <span className="font-heading font-bold text-[10px] tracking-wide inline-block" style={{ color: getHistoryScoreColor(score) }}>{tier.toUpperCase()}</span>}
          </span>
        )}
      </div>

      {/* Score */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {score != null && (ratingPresentation.blurRating
          ? <span aria-label="Score hidden" style={{ width: 42, height: 23, borderRadius: 99, background: '#fff', filter: 'blur(6px)', opacity: 0.9 }} />
          : (
          <p
            className="font-heading font-bold text-[22px]"
            style={{ color: getHistoryScoreColor(score), letterSpacing: '-0.02em' }}
          >
            {score.toFixed(1)}
          </p>
          ))}
        {showChevron && <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />}
      </div>
    </motion.button>
  )
}
