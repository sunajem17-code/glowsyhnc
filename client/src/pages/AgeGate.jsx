import { useState } from 'react'
import { motion } from 'framer-motion'
import logo from '../assets/ascendus-icon.png'

const GOLD   = '#C6A85C'
const SURFACE = '#0E0E0E'

export default function AgeGate({ onConfirmed }) {
  const [checked, setChecked] = useState(false)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-6 py-16"
      style={{ background: SURFACE }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-3"
      >
        <img src={logo} alt="Ascendus" style={{ height: 56, mixBlendMode: 'lighten' }} />
        <span
          className="font-heading font-bold text-[18px] tracking-tight"
          style={{ color: '#F0EDE6' }}
        >
          Ascendus
        </span>
      </motion.div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm flex flex-col items-center gap-8"
      >
        {/* Age requirement notice */}
        <div className="text-center">
          <h1
            className="font-heading font-bold text-[28px] leading-[1.15] mb-3"
            style={{ color: '#F0EDE6', letterSpacing: '-0.02em' }}
          >
            Age Requirement
          </h1>
          <p
            className="font-body text-[15px] leading-relaxed"
            style={{ color: 'rgba(240,237,230,0.55)' }}
          >
            You must be <strong style={{ color: '#F0EDE6' }}>13 years of age or older</strong> to
            create an account or use Ascendus.
          </p>
        </div>

        {/* Checkbox */}
        <label
          className="flex items-start gap-3.5 cursor-pointer w-full rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          onClick={() => setChecked(v => !v)}
        >
          {/* Custom checkbox */}
          <div
            className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all"
            style={{
              background: checked ? GOLD : 'transparent',
              border: `2px solid ${checked ? GOLD : 'rgba(255,255,255,0.25)'}`,
            }}
          >
            {checked && (
              <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                <path d="M1 4L4 7L10 1" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className="font-body text-[14px] leading-snug" style={{ color: 'rgba(240,237,230,0.8)' }}>
            I confirm I am <strong style={{ color: '#F0EDE6' }}>13 years of age or older</strong> and
            agree to the{' '}
            <a
              href="/terms"
              className="underline"
              style={{ color: GOLD }}
              onClick={e => e.stopPropagation()}
            >
              Terms of Use
            </a>
            {' '}and{' '}
            <a
              href="/privacy"
              className="underline"
              style={{ color: GOLD }}
              onClick={e => e.stopPropagation()}
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {/* Continue button */}
        <button
          onClick={() => { if (checked) onConfirmed() }}
          disabled={!checked}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[16px] transition-all"
          style={{
            background: checked ? `linear-gradient(135deg, #D4B96A, ${GOLD}, #A8893A)` : 'rgba(255,255,255,0.08)',
            color: checked ? '#0A0A0A' : 'rgba(255,255,255,0.25)',
            cursor: checked ? 'pointer' : 'not-allowed',
          }}
        >
          Continue
        </button>
      </motion.div>

      {/* Footer */}
      <p className="font-body text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
        By continuing you accept our{' '}
        <a
          href="/privacy"
          className="underline"
          style={{ color: 'rgba(198,168,92,0.5)' }}
        >
          Privacy Policy
        </a>
        {' '}and{' '}
        <a
          href="/terms"
          className="underline"
          style={{ color: 'rgba(198,168,92,0.5)' }}
        >
          Terms of Use
        </a>
      </p>
    </div>
  )
}
