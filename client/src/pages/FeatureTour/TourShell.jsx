import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '../../utils/theme'

const BG = '#080808'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.5)'

// Shared chrome for every Feature Tour screen: gold/black background matching
// the rest of the app, a "Step X of N" progress readout + dots (hidden on the
// welcome/completion bookends), and the Skip Tour / Next controls. Individual
// steps only render their own content in the middle.
export default function TourShell({
  children,
  featureStepNumber = null, // 1-based, null on welcome/completion (no progress shown)
  featureStepTotal = 11,
  onNext,
  onSkip,
  nextLabel = 'Next',
  nextDisabled = false,
  hideSkip = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: BG }}>
      {/* Top bar — progress + skip */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 12 }}
      >
        {featureStepNumber ? (
          <div className="flex items-center gap-2.5">
            <span className="font-heading font-bold text-[11px] tracking-[0.1em]" style={{ color: DIM }}>
              STEP {featureStepNumber} OF {featureStepTotal}
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: featureStepTotal }, (_, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 14,
                    height: 4,
                    transformOrigin: 'left center',
                    transform: `scaleX(${i + 1 === featureStepNumber ? 1 : 4 / 14})`,
                    background: i + 1 <= featureStepNumber ? GOLD : 'rgba(255,255,255,0.15)',
                    transition: 'transform 200ms ease-out, background 200ms ease-out',
                  }}
                />
              ))}
            </div>
          </div>
        ) : <div />}

        {!hideSkip && (
          <button
            onClick={onSkip}
            className="flex items-center gap-1 font-body text-[12px] px-3 py-1.5 rounded-full"
            style={{ color: DIM, background: 'rgba(255,255,255,0.06)' }}
          >
            Skip Tour <X size={12} />
          </button>
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5">{children}</div>

      {/* Bottom CTA */}
      {onNext && (
        <div
          className="px-5 flex-shrink-0"
          style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))', paddingTop: 12 }}
        >
          <motion.button
            whileTap={{ scale: nextDisabled ? 1 : 0.97 }}
            onClick={onNext}
            disabled={nextDisabled}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] disabled:opacity-40"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.3)' }}
          >
            {nextLabel}
          </motion.button>
        </div>
      )}
    </div>
  )
}

export { BG, TEXT, DIM }
