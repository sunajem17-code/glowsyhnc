import { supabase } from './supabase'

// Fixed calendar schedule (7th/14th/21st/28th of each month, with one-time
// overrides like the Sept 2026 -> 1st exception) -- never a rolling interval.
export async function getNextPayoutDate() {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('payout_dates')
    .select('*')
    .gte('payout_date', today)
    .order('payout_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export function formatPayoutDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
