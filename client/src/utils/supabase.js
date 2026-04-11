// ─────────────────────────────────────────────────────────────────────────────
// Supabase browser client — uses ANON key only (safe to expose).
// For server-side writes always go through the Express API (/api/supabase/*),
// which uses the SERVICE key securely.
//
// This file is reserved for future client-side real-time subscriptions or
// direct reads where the RLS policies permit.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Returns null if env vars are not set (no runtime errors in dev without keys)
export const supabase = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null

export default supabase
