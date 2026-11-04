import { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import { getEligibleScanTrial, isNative } from '../utils/iap'
export function useMonthlyTrialOffer() {
  const token = useStore(s => s.token)
  const [offer, setOffer] = useState(null)
  useEffect(() => {
    let active = true
    if (!isNative()) { setOffer({ token, trial: null }); return }
    getEligibleScanTrial().then(trial => { if (active) setOffer({ token, trial }) })
      .catch(() => { if (active) setOffer({ token, trial: null }) })
    return () => { active = false }
  }, [token])
  return offer?.token === token ? offer.trial : null
}
