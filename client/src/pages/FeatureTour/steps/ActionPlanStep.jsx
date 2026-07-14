import { Map } from 'lucide-react'
import WalkthroughCard from './WalkthroughCard'

export default function ActionPlanStep() {
  return (
    <WalkthroughCard
      icon={Map}
      badge="ACTION PLAN"
      title="Your 12-Week Plan"
      description="Every recommendation from your scan, turned into an actual checklist. Pick a week, check things off, watch it move with you."
      highlights={[
        'Organized by week and category',
        'Free unlocks week 1 — Pro unlocks all 12',
        'Tap any task for the full how-to',
      ]}
    />
  )
}
