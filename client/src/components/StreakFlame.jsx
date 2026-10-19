import { useId } from 'react'

export default function StreakFlame({ size = 144 }) {
  const gradientId = useId().replaceAll(':', '')
  const embers = [
    { x: '24%', drift: '-18px', delay: '-1.1s' },
    { x: '39%', drift: '-8px', delay: '-0.3s' },
    { x: '58%', drift: '10px', delay: '-1.5s' },
    { x: '75%', drift: '20px', delay: '-0.7s' },
    { x: '49%', drift: '2px', delay: '-1.9s' },
  ]

  return (
    <div className="streak-fire" style={{ width: size, height: size * 1.08 }} aria-hidden="true">
      <div className="streak-fire__aura" />
      <div className="streak-fire__orbit" />
      <svg className="streak-fire__shape" viewBox="0 0 120 140" fill="none">
        <defs>
          <linearGradient id={`streak-gold-${gradientId}`} x1="35" y1="12" x2="90" y2="132" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F4D989" />
            <stop offset=".48" stopColor="#D9BC72" />
            <stop offset="1" stopColor="#A8893A" />
          </linearGradient>
          <linearGradient id={`streak-core-${gradientId}`} x1="60" y1="67" x2="60" y2="125" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF0B7" />
            <stop offset="1" stopColor="#D9BC72" />
          </linearGradient>
        </defs>
        <path className="streak-fire__outer" d="M61 8C71 26 67 36 83 48C102 63 109 81 101 104C93 127 76 137 56 133C34 132 17 117 16 95C14 77 22 64 36 51C47 40 54 27 61 8Z" fill={`url(#streak-gold-${gradientId})`} />
        <path className="streak-fire__core" d="M62 70C66 83 83 90 81 105C80 119 70 127 58 126C45 125 37 115 39 104C40 93 52 86 56 78C59 73 59 69 58 63C60 65 61 67 62 70Z" fill={`url(#streak-core-${gradientId})`} />
        <path className="streak-fire__cut" d="M28 91C32 78 44 68 47 56C49 69 45 78 38 87C33 94 32 102 36 111C29 107 26 99 28 91Z" fill="#08090B" fillOpacity=".18" />
      </svg>
      {embers.map((ember, index) => (
        <i
          key={index}
          className="streak-fire__ember"
          style={{ left: ember.x, '--ember-drift': ember.drift, animationDelay: ember.delay }}
        />
      ))}
    </div>
  )
}
