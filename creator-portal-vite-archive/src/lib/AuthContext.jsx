import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [creator, setCreator] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadCreator = useCallback(async (userId) => {
    if (!userId) {
      setCreator(null)
      return
    }
    const { data, error } = await supabase.from('creators').select('*').eq('id', userId).single()
    if (error) {
      console.error('[auth] failed to load creator profile', error)
      setCreator(null)
      return
    }
    setCreator(data)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!active) return
      setSession(initialSession)
      loadCreator(initialSession?.user?.id).finally(() => active && setLoading(false))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      loadCreator(nextSession?.user?.id)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadCreator])

  const signInWithDiscord = useCallback(() => {
    return supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    })
  }, [])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const refreshCreator = useCallback(() => loadCreator(session?.user?.id), [loadCreator, session])

  const value = {
    session,
    creator,
    loading,
    isAdmin: creator?.role === 'admin',
    signInWithDiscord,
    signOut,
    refreshCreator,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
