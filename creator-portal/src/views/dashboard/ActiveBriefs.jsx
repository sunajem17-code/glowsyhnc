'use client'

const STANDARD_MILESTONES = [
  { views: '30K',   payout: '$15' },
  { views: '250K',  payout: '$40' },
  { views: '1M',    payout: '$100' },
  { views: '2.5M',  payout: '$180' },
  { views: '5M',    payout: '$300' },
]

const VIP_MILESTONES = [
  { views: '30K',   payout: '$20' },
  { views: '250K',  payout: '$50' },
  { views: '1M',    payout: '$130' },
  { views: '2.5M',  payout: '$200' },
  { views: '5M',    payout: '$300' },
]

function TierCard({ name, color, milestones, requirement }) {
  return (
    <div className={`rounded-xl border ${color} bg-surface p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-text capitalize">{name} Tier</h2>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${name === 'vip' ? 'bg-gold/20 text-gold' : 'bg-border text-text-muted'}`}>
          {name.toUpperCase()}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{requirement}</p>
      <p className="mt-3 text-xs font-medium text-text-muted uppercase tracking-wider">Payment per video (cumulative)</p>
      <div className="mt-2 space-y-1.5">
        {milestones.map((m) => (
          <div key={m.views} className="flex justify-between text-sm">
            <span className="text-text-muted">{m.views} views</span>
            <span className="text-gold font-semibold">{m.payout}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-muted/60">Max $300 per video. Payouts are cumulative — you earn the difference as you hit each milestone.</p>
    </div>
  )
}

export function ActiveBriefs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">Payment Tiers</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your tier is assigned per video based on your analytics screenshot. Videos with 20%+ US audience qualify for VIP, 10%+ for Standard. Under 10% does not qualify.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TierCard
          name="standard"
          color="border-gold/40"
          milestones={STANDARD_MILESTONES}
          requirement="10%+ US audience required"
        />
        <TierCard
          name="vip"
          color="border-gold/60"
          milestones={VIP_MILESTONES}
          requirement="20%+ US audience required"
        />
      </div>
    </div>
  )
}
