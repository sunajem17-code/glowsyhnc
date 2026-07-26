import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'

// icon defaults to ArrowLeft (the "go back one step" affordance used
// everywhere else this header appears); pass icon={X} for screens where
// tapping this button exits the whole flow rather than stepping back —
// same button container/position, just a different icon + onBack target.
export default function PageHeader({ title, subtitle, back, onBack, action, icon: Icon = ArrowLeft }) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-3 px-4 pb-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      {back && (
        <button
          onClick={() => { triggerHaptic(); onBack ? onBack() : navigate(-1) }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Icon size={17} className="text-primary" />
        </button>
      )}
      <div className="flex-1">
        <h1
          className="font-heading font-bold text-[22px] text-primary leading-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12px] text-secondary font-body mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && action}
    </div>
  )
}
