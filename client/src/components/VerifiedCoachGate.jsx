import PremiumRoutineGate from './PremiumRoutineGate'

// The shared store grants access only after account-owned server verification.
// Coach requests independently enforce the same membership on the server.
export default function VerifiedCoachGate({ children }) {
  return <PremiumRoutineGate feature="Adonis AI coaching">{children}</PremiumRoutineGate>
}
