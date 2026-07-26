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

      // Capped at 100 to bound localStorage growth over time — history beyond
      // that lives server-side (scan_history / Supabase) if it's ever needed.
      addScan: (scan) => set(state => ({ scans: [scan, ...state.scans].slice(0, 100) })),
      setCurrentScan: (scan) => set({ currentScan: scan }),
      setScans: (scans) => set({ scans }),

      // Extended metrics (30-metric breakdown) now arrive via a separate,
      // slower follow-up call after the core score — this patches them into
      // both currentScan and the matching scans[] entry once that call
      // resolves, so CategoryCard's teasers hot-update without a re-scan.
      patchScanExtendedMetrics: (scanId, extendedMetrics, status) => set(state => ({
        currentScan: state.currentScan?.id === scanId
          ? { ...state.currentScan, extendedMetrics, extendedMetricsStatus: status }
          : state.currentScan,
        scans: state.scans.map(s => s.id === scanId ? { ...s, extendedMetrics, extendedMetricsStatus: status } : s),
      })),

      // Live Face Scan photo + 2D landmark positions, for the "tap a stat, see
      // it pointed out on your face" UI. Deliberately session-only — NOT in
      // partialize below, so this never gets written to localStorage. It's a
      // full-size base64 JPEG, persisting it is exactly what blew up local
      // storage before (see partialize comment on `scans`). Lasts for the
      // current app session, cleared on a fresh scan or app relaunch.
      lastFaceScanImage: null,
      lastFaceScanLandmarks2D: null,
      setLastFaceScanCapture: (image, landmarks2D) => set({
        lastFaceScanImage: image,
        lastFaceScanLandmarks2D: landmarks2D,
      }),

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

      // 17+ age confirmation — stored once per install
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
          // 0. On iOS check RevenueCat entitlements first (source of truth for IAP).
          // isPro is a clean boolean once this resolves successfully — set it
          // either way, not just when true. Previously this only ever
          // promoted (if (isPro) set({isPremium:true})) and silently did
          // nothing when isPro was false, meaning any isPremium:true that got
          // set incorrectly elsewhere (a bug, a stale value, anything) could
          // never self-correct even when RevenueCat clearly says otherwise.
          // A thrown/rejected check (network failure, RC not synced yet) is
          // NOT the same as an explicit false — that's genuinely unknown, so
          // the catch below still does nothing, on purpose.
          try {
            if (isNative()) {
              const { user: u } = get()
              const isPro = await checkProStatus(u?.id ?? null)
              set({ isPremium: isPro })
            }
          } catch (rcErr) { console.warn('[refreshProStatus] RevenueCat check failed, falling through to server:', rcErr?.message) }

          const API = (import.meta?.env?.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app')
          const base = `https://${API.replace(/^https?:\/\//, '')}/api`
          const headers = { Authorization: `Bearer ${token}` }

          // Run both fetches in parallel — cuts startup time in half
          const [statusRes, profileRes] = await Promise.all([
            fetch(`${base}/payments/status`, { headers }),
            fetch(`${base}/user/profile`,    { headers }),
          ])

          // Same reasoning as the RevenueCat check above — /payments/status is
          // a dedicated, authoritative status endpoint that always returns a
          // real boolean when the request succeeds, so an explicit false is
          // just as trustworthy as an explicit true and should actually apply.
          if (statusRes.ok) {
            const { isPremium } = await statusRes.json()
            set({ isPremium })
          }

          // /user/profile is different — it's a general profile hydration
          // endpoint, not a status oracle, and its subscription fields may
          // simply be absent rather than a deliberate "not premium" signal.
          // So this one stays additive-only (falls back to the current
          // state.isPremium, which the two authoritative checks above may
          // have already corrected to false) rather than treating missing
          // fields as proof of anything.
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
        } catch (err) {
          console.warn('[refreshProStatus] status/profile fetch failed:', err?.message)
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
        // IMPORTANT: strip full base64 photo data URLs before persisting scan
        // history to localStorage. Each scan's facePhotoUrl/sidePhotoUrl can be
        // a few hundred KB as base64, and localStorage in a WKWebView typically
        // caps out around 5-10MB total. Repeated scans during testing (or just
        // normal use over time) will otherwise blow that quota, throwing a
        // QuotaExceededError on the next setItem — which was previously getting
        // misclassified as a Claude/Anthropic rate limit because its message
        // contains the word "exceeded". The photos aren't needed in long-term
        // local history (scoring data is what matters there); the current
        // session's in-memory currentScan still has them for the Results screen.
        scans: state.scans.map(({ facePhotoUrl, sidePhotoUrl, ...rest }) => rest),
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
        // Defensive strip, same reasoning as `scans` above: even though the
        // capture flow is written to keep capturedImage/landmarks2D out of
        // faceMetrics before it ever reaches here, this is cheap insurance
        // against a future code path reintroducing large photo data into
        // persisted state and blowing the localStorage quota again.
        currentScan: state.currentScan ? {
          ...state.currentScan,
          faceMetrics: state.currentScan.faceMetrics
            ? (({ capturedImage, landmarks2D, ...rest }) => rest)(state.currentScan.faceMetrics)
            : state.currentScan.faceMetrics,
        } : state.currentScan,
        achievements: state.achievements,
        freeCoachMessages: state.freeCoachMessages,
      }),
    }
  )
)

export default useStore
