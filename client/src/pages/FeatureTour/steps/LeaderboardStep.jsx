import { Trophy } from 'lucide-react'
import WalkthroughCard from './WalkthroughCard'

export default function LeaderboardStep() {
  return (
    <WalkthroughCard
      icon={Trophy}
      badge="LEADERBOARD"
      title="Most Improved, Every Week"
      description="See how much other people are gaining — anonymously — and where you'd land if you jumped in right now."
      highlights={[
        'Ranked by improvement, not raw score',
        'Usernames are masked, always',
        'Resets weekly — everyone gets a fresh shot',
      ]}
    />
  )
}
