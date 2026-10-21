const REVEAL_GOLD = '#D1B76D'
const REVEAL_LABEL = '#A3A3A3'

export function getRevealMetricTextStyles() {
  return {
    label: {
      color: REVEAL_LABEL,
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      fontSize: 'clamp(13px, 4vw, 18px)',
      textShadow: 'none',
      textTransform: 'uppercase',
    },
    lock: {
      color: REVEAL_GOLD,
      filter: 'none',
    },
    brand: {
      color: REVEAL_GOLD,
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 400,
      fontSize: 18,
      lineHeight: '20px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    },
    value: {
      color: '#fff',
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 800,
      fontSize: 30,
    },
  }
}

export function getUnlockedResultsHeadingStyle() {
  return {
    fontSize: 'clamp(28px, 8vw, 36px)',
    whiteSpace: 'nowrap',
    lineHeight: '1.1',
    transform: 'translateY(8px)',
  }
}

export function getResultsNavigationDotButtonStyle() {
  return { width: 25, height: 44 }
}

export function getRevealRatingAnimation(value, { unlocked, reduceMotion = false, metricKey = '', revealRun = 0, savedProgressCard = false }) {
  const canRevealScore = unlocked && typeof value === 'number' && Number.isFinite(value)
  const animateReveal = canRevealScore && !reduceMotion && !savedProgressCard
  const animateBar = canRevealScore && !reduceMotion
  const lockDuration = animateReveal ? 0.3 : 0
  const barDelay = animateBar && !savedProgressCard ? 0.34 : 0

  return {
    // Changing this key remounts each metric when access changes, allowing
    // Framer Motion's initial state to run even though the screen stays put.
    key: `${metricKey}-${unlocked ? `unlocked-${revealRun}` : 'locked'}`,
    lock: {
      initial: unlocked && !reduceMotion && !savedProgressCard ? { opacity: 1 } : false,
      animate: { opacity: unlocked ? 0 : 1 },
      transition: { duration: lockDuration, ease: 'easeOut' },
    },
    number: {
      initial: animateReveal ? { filter: 'blur(8px)', opacity: 0.55 } : false,
      animate: { filter: 'blur(0px)', opacity: 1 },
      transition: { delay: 0, duration: reduceMotion ? 0 : lockDuration, ease: 'easeOut' },
    },
    bar: {
      initial: animateBar ? { width: '0%', opacity: 0.65, boxShadow: 'none' } : false,
      animate: {
        width: canRevealScore ? `${value * 10}%` : unlocked ? '0%' : '100%',
        opacity: canRevealScore ? 1 : unlocked ? 0.8 : 1,
        boxShadow: 'none',
      },
      transition: {
        width: { delay: barDelay, duration: reduceMotion ? 0 : 0.72, ease: 'easeOut' },
        opacity: { delay: barDelay, duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' },
      },
    },
  }
}
