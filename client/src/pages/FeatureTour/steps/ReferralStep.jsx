import { Gift } from 'lucide-react'
import WalkthroughCard from './WalkthroughCard'

export default function ReferralStep() {
  return (
    <WalkthroughCard
      icon={Gift}
      badge="REFERRAL"
      title="Get Pro Free — For Real"
      description="Invite a few friends who actually sign up, and you unlock Pro at no cost. No trial tricks, no card required."
      highlights={[
        '5 signups = 7 days Pro free',
        'Track your progress right on the screen',
        'Share your link however’s easiest',
      ]}
    />
  )
}
