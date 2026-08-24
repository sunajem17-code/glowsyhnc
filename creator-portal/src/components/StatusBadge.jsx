const STYLES = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  rejected: 'bg-danger/10 text-danger border-danger/30',
  paid: 'bg-gold/10 text-gold border-gold/30',
}

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        STYLES[status] ?? 'border-border text-text-muted'
      }`}
    >
      {status}
    </span>
  )
}
