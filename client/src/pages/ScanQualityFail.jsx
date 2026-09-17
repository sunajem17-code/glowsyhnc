import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import MotionPage from '../components/MotionPage'
import { GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const ISSUE_CONTENT = {
  no_face: {
    headline: "We couldn't find a clear face in this photo",
    label:    'No face detected',
    desc:     'No human face was detected in this photo.',
    tips:     ['Show one clear face', 'Face the camera directly', 'Keep your full face in frame'],
  },
  not_a_person: {
    headline: "We couldn't find a clear face in this photo",
    label:    'No face detected',
    desc:     'No human face was detected in this photo.',
    tips:     ['Show one clear face', 'Face the camera directly', 'Keep your full face in frame'],
  },
  multiple_faces: {
    headline: 'Multiple faces detected in this photo',
    label:    'Multiple faces in frame',
    desc:     'More than one person appears in this photo.',
    tips:     ['Show only your face', 'Move away from other people', 'Keep your full face in frame'],
  },
  too_far: {
    headline: 'Your face is too far away',
    label:    'Face too far away',
    desc:     'Your face is too small for an accurate analysis.',
    tips:     ['Move closer to the camera', 'Keep your face centred in frame', 'Fill at least half the frame with your face'],
  },
  too_close: {
    headline: 'Your face is too close to the camera',
    label:    'Face too close',
    desc:     'Parts of your face may be cut off.',
    tips:     ['Step back from the camera', 'Keep your full face in frame', 'Leave space above your head'],
  },
  face_cropped: {
    headline: 'Your face is partially cut off',
    label:    'Face out of frame',
    desc:     'Part of your face is outside the photo.',
    tips:     ['Step back so your full face is visible', 'Centre yourself in frame', 'Leave space above and around your face'],
  },
  too_dark: {
    headline: 'The lighting is too poor for a scan',
    label:    'Poor lighting',
    desc:     "Your face isn't evenly illuminated enough for an accurate scan.",
    tips:     ['Move to a brighter area', 'Face toward a window or light', 'Turn on more lights in the room'],
  },
  too_blurry: {
    headline: 'The photo is too blurry',
    label:    'Out of focus',
    desc:     "The image isn't sharp enough for accurate analysis.",
    tips:     ['Hold your phone steady', 'Tap your face on screen to focus', 'Clean your camera lens and try again'],
  },
  backlight: {
    headline: 'Too much light behind you',
    label:    'Backlit photo',
    desc:     'A bright light source is silhouetting your face.',
    tips:     ['Turn around so the light faces you', 'Avoid standing in front of windows', 'Find a spot with even lighting'],
  },
  validation_error: {
    headline: 'Could not validate your photo',
    label:    'Technical error',
    desc:     'A technical issue prevented us from checking your photo.',
    tips:     ['Check your internet connection', 'Try again in a moment', 'Retake the photo if the issue continues'],
  },
}

const DEFAULT_CONTENT = {
  headline: "We couldn't find a clear face in this photo",
  label:    'No face detected',
  desc:     "We couldn't verify your photo. Please try again.",
  tips:     ['Show one clear face', 'Face the camera directly', 'Keep your full face in frame'],
}

export default function ScanQualityFail() {
  const navigate  = useNavigate()
  const { state } = useLocation()
  const photoUrl  = state?.photoUrl ?? null
  const issues    = state?.issues   ?? []

  const severityOrder = { critical: 0, high: 1, medium: 2 }
  const topIssue = [...issues]
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))[0]

  const content = ISSUE_CONTENT[topIssue?.code] ?? DEFAULT_CONTENT

  return (
    <MotionPage
      className="px-5 flex flex-col"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
        minHeight: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Label + Headline */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex-shrink-0 mb-3"
      >
        <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: '#EF4444' }}>
          PHOTO NEEDS A FIX
        </p>
        <h1 className="font-heading font-bold text-[24px] leading-tight" style={{ letterSpacing: '-0.02em', color: '#FFFFFF' }}>
          {content.headline}
        </h1>
      </motion.div>

      {/* Photo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex-shrink-0 w-full rounded-2xl overflow-hidden relative"
        style={{
          aspectRatio: '4/5',
          boxShadow: '0 0 0 2px #EF4444, 0 0 20px rgba(239,68,68,0.35)',
        }}
      >
        {photoUrl
          ? <img src={photoUrl} alt="Your photo" className="w-full h-full object-cover" />
          : <div className="w-full h-full" style={{ background: 'var(--card)' }} />
        }

        {/* Vignette */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.5) 100%)',
        }} />

        {/* Bottom banner */}
        <div
          className="absolute bottom-0 left-0 right-0 px-4 pt-10 pb-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.3)', border: '1.5px solid #EF4444' }}>
              <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✕</span>
            </div>
            <p className="font-heading font-bold text-[15px]" style={{ color: '#FFFFFF' }}>{content.label}</p>
          </div>
          <p className="font-body text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.5)', paddingLeft: 28 }}>
            {content.desc}
          </p>
        </div>
      </motion.div>

      {/* Fix tips */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.28 }}
        className="flex-shrink-0 mt-5 mb-6"
      >
        <p className="font-heading font-bold text-[15px] tracking-[0.12em] mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          HOW TO FIX IT
        </p>
        <div className="flex flex-col gap-3">
          {content.tips.map((tip, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.18)', border: '1.5px solid rgba(198,168,92,0.55)' }}
              >
                <span style={{ color: '#C6A85C', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
              </div>
              <p className="font-body text-[18px] leading-snug" style={{ color: '#FFFFFF' }}>{tip}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Try Again */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.28 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => { triggerHaptic(); navigate('/scan/capture', { replace: true }) }}
        className="flex-shrink-0 w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
        style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
      >
        Try Again
      </motion.button>
    </MotionPage>
  )
}
