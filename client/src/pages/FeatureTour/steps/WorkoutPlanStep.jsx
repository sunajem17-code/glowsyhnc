import { Dumbbell } from 'lucide-react'
import WalkthroughCard from './WalkthroughCard'

export default function WorkoutPlanStep() {
  return (
    <WalkthroughCard
      icon={Dumbbell}
      badge="WORKOUT PLAN"
      title="Training Built From Your Scan"
      description="We look at your physique score and build a plan around what'll actually move the needle for you — not a generic split off the internet."
      highlights={[
        'Free = smart template based on your score',
        'Pro = fully AI-personalized, week by week',
        "Every exercise comes with the 'why'",
      ]}
    />
  )
}
