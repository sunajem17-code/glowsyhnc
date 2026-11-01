import useStore from '../store/useStore'

// Use only for client-side presentation gates. Server requests and billing
// flows must continue to use the authoritative isPremium value.
export default function usePremiumUiAccess() {
  return useStore(state => Boolean(state.isPremium))
}
