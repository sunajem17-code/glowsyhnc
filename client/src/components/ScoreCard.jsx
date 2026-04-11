import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { scoreColor, scoreLabel } from '../utils/analysis'

const COLOR_MAP = {
  green: { hex: '#C6A85C', barBg: 'rgba(198,168,92,0.1)' },
  amber: { hex: '#E8A000', barBg: 'rgba(232,160,0,0.1)' },
  red:   { hex: '#EF4444', barBg: 'rgba(239,68,68,0.1)' },
}

export default function ScoreCard({ title, score, insight, tip, expandable = true }) {
  const [open, setOpen] = useState(false)
  const color = scoreColor(score)
  const { hex, barBg } = COLOR_MAP[color]
  const pct = ((score - 1) / 9) * 100

  return (
    <div
      className="mb-2.5 rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: 'var(--card)',
        border: `1px solid ${open ? hex + '30' : 'var(--border)'}`,
        boxShadow: open ? `0 4px 20px ${hex}15` : 'var(--shadow-card)',
      }}
    >
      <button
        className="w-full flex items-center gap-3 p-4"
        onClick={() => expandable && setOpen(o => !o)}
      >
        {/* Score badge */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: barBg }}
        >
          <span
            className="font-mono font-bold text-base"
            style={{ color: hex, letterSpacing: '-0.03em' }}
          >
            {score.toFixed(1)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 text-left">
          <p
            className="font-heading font-semibold text-[13px] text-primary mb-1.5"
          >
            {title}
          </p>
          <div className="flex items-center gap-2.5">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--border)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: hex }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span
              className="text-[11px] font-body font-medium flex-shrink-0"
              style={{ color: hex }}
            >
              {scoreLabel(score)}
            </span>
          </div>
        </div>

        {expandable && (
          <div className="flex-shrink-0 ml-1">
            {open
              ? <ChevronUp size={15} style={{ color: 'var(--text-secondary)' }} />
              : <ChevronDown size={15} style={{ color: 'var(--text-secondary)' }} />
            }
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && (insight || tip) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="mx-4 mb-4 p-3.5 rounded-xl"
              style={{ background: 'var(--bg)', borderTop: `1px solid var(--border)` }}
            >
              {insight && (
                <p className="text-[13px] text-secondary leading-relaxed font-body">{insight}</p>
              )}
              {tip && (
                <div
                  className="mt-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: barBg }}
                >
                  <p className="text-[12px] font-body font-medium" style={{ color: hex }}>
                    {tip}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
