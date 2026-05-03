/**
 * ProLock — reusable blur-gate component.
 *
 * Usage:
 *   <ProLock onUpgrade={() => navigate('/premium')} label="Celebrity Match Details">
 *     {children}  ← always rendered but blurred for free users
 *   </ProLock>
 *
 * For a fully-locked card (no preview at all):
 *   <ProLock onUpgrade={…} solid label="…" description="…" />
 */

import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'

const GOLD = '#C6A85C'

export default function ProLock({
  children,
  onUpgrade,
  label        = 'Pro Feature',
  description  = '',
  solid        = false,   // true = locked card with no blurred preview
  blurAmount   = '6px',
  className    = '',
}) {
  if (solid) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onUpgrade}
        className={`w-full text-left rounded-2xl p-5 relative overflow-hidden ${className}`}
        style={{
          background:    'rgba(198,168,92,0.04)',
          border:        '1px solid rgba(198,168,92,0.14)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* faint grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:    'repeating-linear-gradient(0deg,#C6A85C 0,#C6A85C 1px,transparent 1px,transparent 28px),repeating-linear-gradient(90deg,#C6A85C 0,#C6A85C 1px,transparent 1px,transparent 28px)',
            backgroundSize:     '28px 28px',
          }}
        />
        <div className="flex flex-col items-center justify-center py-4 gap-3 relative">
          {/* lock badge */}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.22)' }}
          >
            <Lock size={20} style={{ color: GOLD }} />
          </div>
          <div className="text-center">
            <p className="font-heading font-bold text-[15px] text-primary mb-1">{label}</p>
            {description && (
              <p className="font-body text-[12px] text-secondary leading-snug">{description}</p>
            )}
          </div>
          <span
            className="text-[11px] font-heading font-bold px-3 py-1.5 rounded-full"
            style={{ background: `linear-gradient(135deg,${GOLD},#A8893A)`, color: '#0A0A0A' }}
          >
            Unlock with PRO
          </span>
        </div>
      </motion.button>
    )
  }

  // Blurred preview mode — render children, overlay the lock
  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden cursor-pointer ${className}`}
      onClick={onUpgrade}
      whileTap={{ scale: 0.99 }}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* blurred content */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: `blur(${blurAmount})`, opacity: 0.55 }}
      >
        {children}
      </div>

      {/* overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2"
        style={{
          background:     'rgba(12,12,12,0.52)',
          backdropFilter: 'blur(2px)',
        }}
      >
        {/* PRO pill */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.18)' }}
          >
            <Lock size={12} style={{ color: GOLD }} />
          </div>
          <span
            className="text-[10px] font-heading font-bold tracking-widest uppercase"
            style={{ color: GOLD }}
          >
            PRO
          </span>
        </div>
        {label && (
          <p className="font-body text-[11px] text-white/70 text-center px-6 leading-snug">
            {label}
          </p>
        )}
      </div>
    </motion.div>
  )
}
