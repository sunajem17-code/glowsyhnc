import { TrendingUp } from 'lucide-react'
import WalkthroughCard from './WalkthroughCard'

export default function ProgressStep() {
  return (
    <WalkthroughCard
      icon={TrendingUp}
      badge="PROGRESS"
      title="Watch Your Score Actually Move"
      description="Every scan gets logged. Come back in a few weeks and watch the line go up — with a shareable before/after card when it does."
      highlights={[
        'Score-over-time chart',
        'Full photo timeline of every scan',
        'One-tap shareable glow-up card',
      ]}
    />
  )
}
