import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { checkProStatus, isNative } from '../utils/iap'

const useStore = create(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
        // Hydrate from the user object immediately so paying users aren't briefly downgraded
        // while the async RevenueCat / server check completes.
        isPremium:
          user?.subscriptionTier === 'premium' ||
          user?.subscription_tier === 'premium' ||
          user?.is_pro === true ||
          false,
      }),
      setPremium: (val) => set({ isPremium: val }),
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        scans: [],
        currentPlan: null,
        currentScan: null,
        checkins: [],
        todayCheckin: null,
        streak: { current: 0, longest: 0, lastDate: null },
        isPremium: false,
        pendingFacePhoto: null,
        pendingBodyPhoto: null,
        hasOnboarded: false,
        gender: null,
        userProfile: null,
        legalConsented: false,
        // age gate is device-level, intentionally NOT reset on logout
      }),
      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),

      // Scans
      scans: [],
      currentScan: null,

      addScan: (scan) => set(state => ({ scans: [scan, ...state.scans] })),
      setCurrentScan: (scan) => set({ currentScan: scan }),
      setScans: (scans) => set({ scans }),

      // Action Plan
      currentPlan: null,
      setCurrentPlan: (plan) => set({ currentPlan: plan }),

      toggleTask: (taskId) => set(state => {
        if (!state.currentPlan) return state
        const updatedTasks = state.currentPlan.tasks.map(t =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        )
        return { currentPlan: { ...state.currentPlan, tasks: updatedTasks } }
      }),

      // Daily Check-in
      checkins: [],
      todayCheckin: null,
      addCheckin: (checkin) => set(state => ({
        checkins: [checkin, ...state.checkins],
        todayCheckin: checkin,
      })),
      setTodayCheckin: (checkin) => set({ todayCheckin: checkin }),

      // Streaks
      streak: { current: 0, longest: 0, lastDate: null },
      updateStreak: (streak) => set({ streak }),

      // Settings
      theme: 'dark',
      toggleTheme: () => set(state => ({
        theme: state.theme === 'light' ? 'dark' : 'light',
      })),

      // Onboarding
      hasOnboarded: false,
      setHasOnboarded: () => set({ hasOnboarded: true }),
      resetOnboarding: () => set({ hasOnboarded: false }),

      // Legal consent (age gate + AI/biometric consent)
      legalConsented: false,
      setLegalConsented: () => set({ legalConsented: true }),

      // 13+ age gate — shown once per install
      ageConfirmed: false,
      ageConfirmedAt: null,
      setAgeConfirmed: () => set({ ageConfirmed: true, ageConfirmedAt: new Date().toISOString() }),

      // Units preference
      units: 'metric', // 'metric' | 'imperial'
      setUnits: (u) => set({ units: u }),

      // Scan limiting (free tier: 1 scan/month)
      lastScanDate: null,
      setLastScanDate: (d) => set({ lastScanDate: d }),

      // Referral
      referralCode: null,
      referralCount: 0,
      proTrialActive: false,
      proTrialExpiresAt: null,
      setReferralCode: (c) => set({ referralCode: c }),
      setReferralCount: (n) => set({ referralCount: n }),
      startProTrial: () => {
        const expires = new Date()
        expires.setDate(expires.getDate() + 7)
        set({ proTrialActive: true, proTrialExpiresAt: expires.toISOString(), isPremium: true })
      },
      checkProTrial: () => {
        const { proTrialActive, proTrialExpiresAt } = get()
        if (proTrialActive && proTrialExpiresAt && new Date() > new Date(proTrialExpiresAt)) {
          set({ proTrialActive: false, isPremium: false })
        }
      },

      // UI State
      scanInProgress: false,
      setScanInProgress: (v) => set({ scanInProgress: v }),

      analysisStep: 0,
      setAnalysisStep: (v) => set({ analysisStep: v }),

      // Pending scan photos (before analysis)
      pendingFacePhoto: null,
      setPendingFacePhoto: (url) => set({ pendingFacePhoto: url }),
      clearPendingPhotos: () => set({ pendingFacePhoto: null, pendingBodyPhoto: null }),

      // Gender (affects PSL tier labels + ideal ratios)
      gender: null, // null = not selected yet, 'male' | 'female'
      setGender: (g) => set({ gender: g }),

      // Hair type (detected by AI or selected manually by user)
      hairType: null, // null = not set, 'straight'|'wavy'|'curly'|'coily'|'locs'|'bald'
      setHairType: (t) => set({ hairType: t }),

      // Premium
      isPremium: false,
      setIsPremium: (v) => set({ isPremium: v }),

      // Refresh Pro status from server — call after payment, trial activation, or app foreground
      // Throttled: won't re-run if called within 60s of the last successful refresh.
      _lastProRefresh: 0,
      refreshProStatus: async () => {
        const { token, isAuthenticated, _lastProRefresh } = get()
        if (!isAuthenticated || !token || token === 'demo-token') return
        // Throttle: skip if we refreshed within the last 60 seconds
        if (Date.now() - _lastProRefresh < 60_000) return
        set({ _lastProRefresh: Date.now() })
        try {
          // 0. On iOS check RevenueCat entitlements first (source of truth for IAP)
          try {
            if (isNative()) {
              const { user: u } = get()
              const isPro = await checkProStatus(u?.id ?? null)
              if (isPro) set({ isPremium: true })
            }
          } catch { /* RevenueCat unavailable — fall through to server check */ }

          const API = (import.meta?.env?.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app')
          const base = `https://${API.replace(/^https?:\/\//, '')}/api`
          const headers = { Authorization: `Bearer ${token}` }

          // Run both fetches in parallel — cuts startup time in half
          const [statusRes, profileRes] = await Promise.all([
            fetch(`${base}/payments/status`, { headers }),
            fetch(`${base}/user/profile`,    { headers }),
          ])

          if (statusRes.ok) {
            const { isPremium } = await statusRes.json()
            if (isPremium) set({ isPremium: true })
          }

          if (profileRes.ok) {
            const profile = await profileRes.json()
            const fresh = profile.user || profile
            const serverStreak = profile.streak
            set(state => ({
              user: { ...state.user, ...fresh },
              isPremium:
                fresh?.subscriptionTier === 'premium' ||
                fresh?.subscription_tier === 'premium' ||
                fresh?.is_pro === true ||
                state.isPremium,
              streak: serverStreak ? {
                current: serverStreak.current_streak ?? state.streak.current,
                longest: serverStreak.longest_streak ?? state.streak.longest,
                lastDate: serverStreak.last_checkin_date
                  ? new Date(serverStreak.last_checkin_date + 'T12:00:00').toDateString()
                  : state.streak.lastDate,
              } : state.streak,
            }))
          }
        } catch {
          // Fail silently — stale data is better than a crash
        }
      },

      // Phase
      assignedPhase: null,
      setAssignedPhase: (phase) => set({ assignedPhase: phase }),

      // Scan count (for paywall)
      scanCount: 0,
      incrementScanCount: () => set(state => ({ scanCount: state.scanCount + 1 })),

      // Onboarding profile (collected during setup flow)
      userProfile: null,
      setUserProfile: (profile) => set({ userProfile: profile }),

      // AI Coach free usage (3 lifetime messages for non-pro users)
      freeCoachMessages: 0,
      incrementFreeCoachMessages: () => set(state => ({ freeCoachMessages: state.freeCoachMessages + 1 })),

      // Achievements
      achievements: [], // array of achievement keys that have been unlocked
      pendingAchievement: null, // key of achievement to celebrate (shown once then cleared)
      unlockAchievement: (key) => set(state => {
        if (state.achievements.includes(key)) return state
        return { achievements: [...state.achievements, key], pendingAchievement: key }
      }),
      clearPendingAchievement: () => set({ pendingAchievement: null }),

      // Privacy Settings
      privacySettings: {
        savePhotos: true,
        analytics: true,
        faceDataRetention: true,
        personalizedTips: true,
      },
      setPrivacySetting: (key, value) => set(state => ({
        privacySettings: { ...state.privacySettings, [key]: value },
      })),
      clearAllScanData: () => set({
        scans: [],
        currentScan: null,
        currentPlan: null,
        checkins: [],
        todayCheckin: null,
        streak: { current: 0, longest: 0, lastDate: null },
        pendingFacePhoto: null,
        pendingBodyPhoto: null,
      }),
    }),
    {
      name: 'ascendus-storage',
      // Normalize any glowScore stored in the old 0-100 scale back to 0-10
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const fix = (s) => s && s.glowScore > 10 ? { ...s, glowScore: Math.round(s.glowScore) / 10 } : s
        if (state.scans) state.scans = state.scans.map(fix)
        if (state.currentScan) state.currentScan = fix(state.currentScan)
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        scans: state.scans,
        currentPlan: state.currentPlan,
        checkins: state.checkins,
        todayCheckin: state.todayCheckin,
        streak: state.streak,
        theme: state.theme,
        hasOnboarded: state.hasOnboarded,
        legalConsented: state.legalConsented,
        ageConfirmed: state.ageConfirmed,
        ageConfirmedAt: state.ageConfirmedAt,
        units: state.units,
        lastScanDate: state.lastScanDate,
        referralCode: state.referralCode,
        referralCount: state.referralCount,
        proTrialActive: state.proTrialActive,
        proTrialExpiresAt: state.proTrialExpiresAt,
        isPremium: state.isPremium,
        gender: state.gender,
        hairType: state.hairType,
        userProfile: state.userProfile,
        privacySettings: state.privacySettings,
        assignedPhase: state.assignedPhase,
        scanCount: state.scanCount,
        currentScan: state.currentScan,
        achievements: state.achievements,
        freeCoachMessages: state.freeCoachMessages,
      }),
    }
  )
)

export default useStore
