import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GOLD } from '../../../utils/theme'
import { FaceShapeSelector, ManualResultsView } from '../../HairMaxx'

// Reuses HairMaxx's real manual-mode chain — it's already 100% local/zero-API
// (recommendations come from utils/haircuts.js lookup tables), so this is a
// genuine working slice of the feature, not a fake response. Density/hairline
// default to the middle options so one tap (face shape) gets a real result;
// the real HairMaxx page lets you fine-tune both.
export default function HairMaxxDemoStep() {
  const [faceShape, setFaceShape] = useState(null)
  const [savedCuts, setSavedCuts] = useState([])

  function toggleSave(id) {
    setSavedCuts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="h-full flex flex-col justify-center pb-6">
      <div className="text-center mb-4">
        <span className="font-heading font-bold text-[10px] tracking-[0.16em]" style={{ color: GOLD }}>HAIRMAXX</span>
        <h2 className="font-heading font-bold text-[22px] leading-tight mt-1.5" style={{ color: '#F0EDE8', letterSpacing: '-0.01em' }}>
          {faceShape ? 'Real recommendations' : 'Pick your face shape'}
        </h2>
        <p className="font-body text-[13px] mt-1.5 max-w-[280px] mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {faceShape
            ? "These are the same cuts you'd get on the real page — try saving one."
            : 'This is the real feature, not a preview. Tap one to see it work.'}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!faceShape ? (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <FaceShapeSelector selected={faceShape} onSelect={setFaceShape} />
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <ManualResultsView
              faceShape={faceShape}
              density="medium"
              hairline="straight"
              savedCuts={savedCuts}
              onSave={toggleSave}
              isPremium={true}
              onUpgrade={() => {}}
              onReset={() => setFaceShape(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
