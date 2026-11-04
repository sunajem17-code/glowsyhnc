import { API_BASE } from '../utils/backend'
import { FINAL_ONBOARDING_STEP, hasCompletedOnboarding, isCompletedScan, normalizeOnboardingCompletion, onboardingOwner, startingPointCompletionKey } from '../utils/onboardingStartup.js'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { checkProStatus, isNative } from '../utils/iap'
import { canApplyNegativePremiumRefresh } from '../utils/premiumStatus'

// Monotonic revision prevents an entitlement refresh started before a purchase
// from applying an outdated "free" result after the purchase succeeds.
let premiumStateRevision = 0

const useStore = create(
  persist(
    (set, get) => ({
      upgradeWelcomePending: false,
      setUpgradeWelcomePending: (value) => set({ upgradeWelcomePending: value }),
      // Auth
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,
      isLocalProPreview: false,
      isLocalProPreviewConfigured: false,
      _premiumBeforeLocalPreview: false,
      setAuth: (user, token) => {
        premiumStateRevision += 1
        set(state => {
          const previousOwner = onboardingOwner(state.user)
          const nextOwner = onboardingOwner(user)
          const onboardingCompletedByUser = { ...state.onboardingCompletedByUser }
          const startingPointCompletedByUser = { ...state.startingPointCompletedByUser }
          const completedScanByUser = { ...state.completedScanByUser }
          // A guest can finish onboarding before creating or linking an account.
          // Carry that device session's completion to the upgraded account so a
          // relaunch doesn't route the now-registered user back through setup.
          if (state.isGuest && previousOwner !== nextOwner) {
            if (completedScanByUser[previousOwner] === true) completedScanByUser[nextOwner] = true
            if (onboardingCompletedByUser[previousOwner] === true) onboardingCompletedByUser[nextOwner] = true
            if (startingPointCompletedByUser[previousOwner] === true) startingPointCompletedByUser[nextOwner] = true
          }
          return {
            user,
            onboardingCompletedByUser,
            startingPointCompletedByUser,
            completedScanByUser,
            hasOnboarded: hasCompletedOnboarding({ ...state, user, onboardingCompletedByUser, completedScanByUser }),
            token,
            upgradeWelcomePending: false,
            isAuthenticated: true,
            isGuest: false,
            subscriptionStatus: 'loading',
            // Hydrate from the user object immediately so paying users aren't briefly downgraded
            // while the async RevenueCat / server check completes.
            isPremium: user?.subscriptionTier === 'premium' ||
              user?.subscription_tier === 'premium' ||
              user?.is_pro === true ||
              false,
          }
        })
      },
      setGuestSession: (userId, token) => {
        premiumStateRevision += 1
        set(state => {
          const user = { id: userId }
          const previousOwner = onboardingOwner(state.user)
          const nextOwner = onboardingOwner(user)
          const onboardingCompletedByUser = { ...state.onboardingCompletedByUser }
          const startingPointCompletedByUser = { ...state.startingPointCompletedByUser }
          const completedScanByUser = { ...state.completedScanByUser }
          // Guest sessions may be refreshed or re-created after their JWT
          // expires. Carry this device's local setup and scan completion to
          // the replacement guest identity so scan recovery stays in-app.
          if (previousOwner !== nextOwner) {
            if (onboardingCompletedByUser[previousOwner] === true) onboardingCompletedByUser[nextOwner] = true
            if (startingPointCompletedByUser[previousOwner] === true) startingPointCompletedByUser[nextOwner] = true
            if (completedScanByUser[previousOwner] === true || isCompletedScan(state.currentScan) || state.scans.some(isCompletedScan)) {
              completedScanByUser[nextOwner] = true
            }
          }
          return {
            user,
            onboardingCompletedByUser,
            startingPointCompletedByUser,
            completedScanByUser,
            hasOnboarded: state.hasOnboarded === true || hasCompletedOnboarding({
              ...state, user, onboardingCompletedByUser, startingPointCompletedByUser, completedScanByUser,
            }),
            token,
            upgradeWelcomePending: false,
            isAuthenticated: true,
            isGuest: true,
            isPremium: false, subscriptionStatus: 'inactive',
          }
        })
      },
      setPremium: (val) => {
        premiumStateRevision += 1
        set(state => ({ isPremium: val, subscriptionStatus: val ? 'active' : 'inactive' }))
      },
      expireSession: () => {
        premiumStateRevision += 1
        // Keep the owner and completed setup so reauthentication opens sign-in.
        set({ token: null, isAuthenticated: false, isPremium: false, subscriptionStatus: 'inactive', isLocalProPreview: false })
      },
      logout: () => {
        premiumStateRevision += 1
        // Clear session keys so a subsequent login on the same device doesn't
        // inherit stale onboarding state.
        try { sessionStorage.removeItem('ascendus_onboarding_draft') } catch { /* ignore */ }
        try { sessionStorage.removeItem('asc_reveal_shown') } catch { /* ignore */ }
        set({
          user: null,
          token: null,
          upgradeWelcomePending: false,
          isAuthenticated: false,
          isGuest: false,
          scans: [],
          currentPlan: null,
          currentScan: null,
          checkins: [],
          streak: { current: 0, longest: 0, lastDate: null, face: { current: 0, longest: 0, lastDate: null }, physique: { current: 0, longest: 0, lastDate: null } },
          isPremium: false, subscriptionStatus: 'inactive',
          isLocalProPreview: false,
          isLocalProPreviewConfigured: false,
          _premiumBeforeLocalPreview: false,
          pendingFacePhoto: null,
          pendingBodyPhoto: null,
          hasOnboarded: false,
          gender: null,
          userProfile: null,
          legalConsented: false,
          // age gate is device-level, intentionally NOT reset on logout
        })
      },
      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),

      // Scans
      scans: [],
      currentScan: null,

      // Capped at 100 to bound localStorage growth over time — history beyond
      // that lives server-side (the `scans` table in Supabase) if it's ever needed.
      addScan: (scan) => set(state => ({
        scans: [scan, ...state.scans].slice(0, 100),
        ...(state.user?.id != null && isCompletedScan(scan) ? {
          completedScanByUser: { ...state.completedScanByUser, [onboardingOwner(state.user)]: true },
          hasOnboarded: true,
        } : {}),
      })),
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
      patchScanPresentation: (scanId, feedback) => set(state => {
        const apply = scan => scan?.id === scanId ? {
          ...scan,
          aiScore: {
            ...scan.aiScore,
            suggestions: feedback.suggestions ?? [],
            assessment: {
              ...scan.aiScore?.assessment,
              feedbackVersion: 'presentation-v2',
              presentationStatus: feedback.presentation?.unavailable ? 'unavailable' : 'ready',
              suggestions: feedback.suggestions ?? [],
              presentation: feedback.presentation,
              ...(feedback.unavailableDetail ? { unassessableDetails: [
                ...(scan.aiScore?.assessment?.unassessableDetails ?? []), feedback.unavailableDetail,
              ] } : {}),
            },
          },
        } : scan
        return { currentScan: apply(state.currentScan), scans: state.scans.map(apply) }
      }),

      // Live Face Scan photo + 2D landmark positions, for the "tap a stat, see
      // it pointed out on your face" UI. Deliberately session-only — NOT in
      // partialize below, so this never gets written to localStorage. It's a
      // full-size base64 JPEG, persisting it is exactly what blew up local
      // storage before (see partialize comment on `scans`). Lasts for the
      // current app session, cleared on a fresh scan or app relaunch.
      lastFaceScanImage: null,
      lastFaceScanLandmarks2D: null,
      lastFaceScanFaceMetrics: null,
      setLastFaceScanCapture: (image, landmarks2D, faceMetrics) => set({
        lastFaceScanImage: image,
        lastFaceScanLandmarks2D: landmarks2D,
        lastFaceScanFaceMetrics: faceMetrics ?? null,
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

      // Legacy activity dates are retained for the streak calendar.
      checkins: [],

      // Streaks
      streak: { current: 0, longest: 0, lastDate: null, face: { current: 0, longest: 0, lastDate: null }, physique: { current: 0, longest: 0, lastDate: null } },
      updateStreak: (streak) => set({ streak }),

      // Settings
      theme: 'dark',

      // Onboarding
      hasOnboarded: false,
      onboardingWasReset: false,
      onboardingHydrated: false,
      onboardingCompletedByUser: {},
      completedScanByUser: {},
      startingPointCompletedByUser: {},
      completeStartingPoint: () => set(state => ({
        startingPointCompletedByUser: {
          ...state.startingPointCompletedByUser,
          [startingPointCompletionKey(state.user)]: true,
        },
      })),
      resetOnboardingForDeletedAccount: () => set(state => {
        const owner = onboardingOwner(state.user)
        const onboardingCompletedByUser = { ...state.onboardingCompletedByUser }
        const startingPointCompletedByUser = { ...state.startingPointCompletedByUser }
        const completedScanByUser = { ...state.completedScanByUser }
        delete onboardingCompletedByUser[owner]
        delete startingPointCompletedByUser[owner]
        delete completedScanByUser[owner]
        return { hasOnboarded: false, onboardingWasReset: true, onboardingCompletedByUser, startingPointCompletedByUser, completedScanByUser }
      }),
      setHasOnboarded: (completedStep) => {
        // The onboarding flow passes its final step. PaymentSuccess can also
        // finish that same flow after a hard redirect, where no step survives.
        if (completedStep != null && completedStep !== FINAL_ONBOARDING_STEP) return false
        set(state => ({
          hasOnboarded: true,
          onboardingWasReset: false,
          onboardingCompletedByUser: {
            ...state.onboardingCompletedByUser,
            [onboardingOwner(state.user)]: true,
          },
        }))
        return true
      },
      resetOnboarding: () => {
        try { localStorage.removeItem('ascendus_onboarding_draft'); sessionStorage.removeItem('ascendus_onboarding_draft') } catch { /* ignore */ }
        try { sessionStorage.removeItem('asc_post_onboard_dest') } catch { /* ignore */ }
        set(state => {
          const records = { ...state.onboardingCompletedByUser }
          delete records[onboardingOwner(state.user)]
          const completedScanByUser = { ...state.completedScanByUser }
          delete completedScanByUser[onboardingOwner(state.user)]
          return { hasOnboarded: false, onboardingWasReset: true, onboardingCompletedByUser: records, completedScanByUser }
        })
      },

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

      // Pro Scan daily cap: 3 scans per 24h window starting from first scan of the day
      proScanCount: 0,
      proScanDate: null,       // kept for backward compat (unused now)
      proScanFirstAt: null,    // ISO timestamp of the first scan in the current window
      recordProScan: () => set(state => {
        const now = Date.now()
        const windowStart = state.proScanFirstAt ? new Date(state.proScanFirstAt).getTime() : null
        const inWindow = windowStart && (now - windowStart) < 24 * 60 * 60 * 1000
        return {
          proScanCount: inWindow ? state.proScanCount + 1 : 1,
          proScanFirstAt: inWindow ? state.proScanFirstAt : new Date().toISOString(),
        }
      }),

      // Referral
      referralCode: null,
      referralCount: 0,
      setReferralCode: (c) => set({ referralCode: c }),
      setReferralCount: (n) => set({ referralCount: n }),

      // UI State
      scanInProgress: false,
      setScanInProgress: (v) => set({ scanInProgress: v }),

      analysisStep: 0,
      setAnalysisStep: (v) => set({ analysisStep: v }),

      // Pending scan photos (before analysis)
      // Global scan-launch overlay (persists across route transitions)
      scanLaunching: false,
      setScanLaunching: (v) => set({ scanLaunching: v }),

      pendingFacePhoto: null,
      setPendingFacePhoto: (url) => set({ pendingFacePhoto: url }),
      clearPendingPhotos: () => set({ pendingFacePhoto: null, pendingBodyPhoto: null }),

      // Gender (affects PSL tier labels + ideal ratios)
      gender: null, // null = not selected yet, 'male' | 'female'
      setGender: (g) => set({ gender: g }),

      // Primary goal selected during onboarding
      primaryGoal: null, // 'dating' | 'jawline' | 'skin' | 'glow'
      setPrimaryGoal: (g) => set({ primaryGoal: g }),

      // Hair type (detected by AI or selected manually by user)
      hairType: null, // null = not set, 'straight'|'wavy'|'curly'|'coily'|'locs'|'bald'
      setHairType: (t) => set({ hairType: t }),

      // Premium
      isPremium: false, subscriptionStatus: 'inactive',
      setIsPremium: (v) => {
        premiumStateRevision += 1
        set(state => ({ isPremium: v, subscriptionStatus: v ? 'active' : 'inactive' }))
      },

      // Unlock reveal slideshow — set true in handleUnlockSuccess, cleared by the slideshow itself
      showUnlockSlideshow: false,
      setShowUnlockSlideshow: (v) => set({ showUnlockSlideshow: v }),

      setSubscriptionStatus: status => set({ subscriptionStatus: status }),

      // Refresh Pro status from server — call after payment, trial activation, or app foreground
      // Throttled: won't re-run if called within 60s of the last successful refresh.
      _lastProRefresh: 0,
      refreshProStatus: async ({ force = false } = {}) => {
        const { token, isAuthenticated, _lastProRefresh } = get()
        if (!isAuthenticated || !token || token === 'demo-token') return
        // Throttle: skip if we refreshed within the last 60 seconds
        if (!force && Date.now() - _lastProRefresh < 60_000) return
        set({ _lastProRefresh: Date.now(), subscriptionStatus: 'loading' })
        const revisionAtStart = premiumStateRevision
        let nativePremiumStatus = null
        try {
          // 0. On iOS check RevenueCat entitlements first (source of truth for IAP).
          // A positive RevenueCat result promotes immediately. A negative
          // result waits for the server response so an active server-verified
          // entitlement (for example a web subscription) can still grant.
          try {
            if (isNative()) {
              const { user: u } = get()
              const isPro = await checkProStatus(u?.id ?? null)
              nativePremiumStatus = false
              if (isPro) {
                // A freshly reconciled native entitlement unlocks purchased UI.
                // Server APIs independently verify access while their record syncs.
                if (get().token !== token || get().user?.id !== u.id) return
                nativePremiumStatus = true
                premiumStateRevision += 1
                set({ isPremium: true, subscriptionStatus: 'active' })
                const sync = await fetch(`${API_BASE}/payments/sync-rc`, {
                  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rcUserId: u.id }),
                  signal: AbortSignal.timeout(12000),
                })
                if (get().token !== token || get().user?.id !== u.id) return
                if (!sync.ok) {
                  console.warn('[refreshProStatus] Native subscription active; server sync pending:', sync.status)
                }
              }
            }
          } catch (rcErr) { console.warn('[refreshProStatus] RevenueCat check failed, falling through to server:', rcErr?.message) }

          const headers = { Authorization: `Bearer ${token}` }

          // Run both fetches in parallel — cuts startup time in half
          const [statusRes, profileRes] = await Promise.all([
            fetch(`${API_BASE}/payments/status`, { headers }),
            fetch(`${API_BASE}/user/profile`,    { headers }),
          ])

          // The server status is also authoritative. A true response grants
          // access; a false response only applies if no newer entitlement
          // change happened while this refresh was in flight. This protects a
          // newly completed purchase from an older refresh response.
          if (get().token !== token) return
          if (statusRes.ok) {
            const { isPremium } = await statusRes.json()
            if (revisionAtStart === premiumStateRevision || isPremium || nativePremiumStatus === true) set({ subscriptionStatus: isPremium || nativePremiumStatus === true ? 'active' : 'inactive' })
            if (isPremium === true) {
              premiumStateRevision += 1
              set({ isPremium: true, subscriptionStatus: 'active' })
            } else if (isPremium === false && canApplyNegativePremiumRefresh({
              revisionAtStart,
              currentRevision: premiumStateRevision,
              nativePremiumStatus,
              serverStatus: isPremium,
            })) {
              premiumStateRevision += 1
              set(state => ({ isPremium: false, subscriptionStatus: 'inactive' }))
            }

          }

          if (!statusRes.ok && nativePremiumStatus !== true) set({ subscriptionStatus: 'unavailable' })

          // Profile fields hydrate personal data only. Subscription status
          // comes from the entitlement checks above, never stale profile flags.
          if (profileRes.ok) {
            const profile = await profileRes.json()
            const fresh = profile.user || profile
            const serverStreak = profile.streak
            set(state => ({
              user: { ...state.user, ...fresh },
              streak: serverStreak ? {
                current: serverStreak.current_streak ?? state.streak.current,
                longest: serverStreak.longest_streak ?? state.streak.longest,
                lastDate: serverStreak.last_checkin_date
                  ? new Date(serverStreak.last_checkin_date + 'T12:00:00').toDateString()
                  : state.streak.lastDate,
                face: serverStreak.face_current_streak != null ? {
                  current: serverStreak.face_current_streak,
                  longest: serverStreak.face_longest_streak ?? 0,
                  lastDate: serverStreak.face_last_scan_date || null,
                } : state.streak.face,
                physique: serverStreak.physique_current_streak != null ? {
                  current: serverStreak.physique_current_streak,
                  longest: serverStreak.physique_longest_streak ?? 0,
                  lastDate: serverStreak.physique_last_scan_date || null,
                } : state.streak.physique,
              } : state.streak,
            }))
          }
        } catch (err) {
          if (get().token === token) set({ subscriptionStatus: nativePremiumStatus === true ? 'active' : 'unavailable' })
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
        streak: { current: 0, longest: 0, lastDate: null, face: { current: 0, longest: 0, lastDate: null }, physique: { current: 0, longest: 0, lastDate: null } },
        pendingFacePhoto: null,
        pendingBodyPhoto: null,
      }),
    }),
    {
      name: 'ascendus-storage',
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...persistedState,
          ...normalizeOnboardingCompletion(persistedState || {}),
          onboardingHydrated: false,
        }
        // Dark appearance is the only supported theme; migrate devices that
        // previously persisted light mode back to the fixed app appearance.
        merged.theme = 'dark'
        // Retire the old local Pro override. Never retain a premium value
        // that came from the preview; the purchase/server refresh restores
        // genuine memberships after hydration.
        if (merged.isLocalProPreview) merged.isPremium = false
        merged.isLocalProPreview = false
        merged.isLocalProPreviewConfigured = false
        merged._premiumBeforeLocalPreview = false
        // Discard retired achievement data from existing installations.
        delete merged.achievements
        delete merged.pendingAchievement
        delete merged.achievementQueue
        delete merged.developerPreviewUnlocked
        return merged
      },
      // Normalize any glowScore stored in the old 0-100 scale back to 0-10
      onRehydrateStorage: () => (state, error) => {
        if (!state || error) {
          // Never leave the app behind the startup gate if persisted storage is
          // unavailable or corrupt. In that case, start onboarding cleanly.
          queueMicrotask(() => useStore.setState({
            onboardingHydrated: true,
            hasOnboarded: false,
            onboardingCompletedByUser: {},
          }))
          return
        }
        const fix = (s) => s && s.glowScore > 10 ? { ...s, glowScore: Math.round(s.glowScore) / 10 } : s
        if (state.scans) state.scans = state.scans.map(fix)
        if (state.currentScan) state.currentScan = fix(state.currentScan)
        // Use a store update so React subscribers leave the startup screen.
        useStore.setState({ onboardingHydrated: true })
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
        streak: state.streak,
        hasOnboarded: state.hasOnboarded === true || hasCompletedOnboarding(state),
        onboardingWasReset: state.onboardingWasReset === true,
        onboardingCompletedByUser: state.onboardingCompletedByUser,
        completedScanByUser: state.completedScanByUser,
        startingPointCompletedByUser: state.startingPointCompletedByUser,
        legalConsented: state.legalConsented,
        ageConfirmed: state.ageConfirmed,
        ageConfirmedAt: state.ageConfirmedAt,
        units: state.units,
        lastScanDate: state.lastScanDate,
        referralCode: state.referralCode,
        referralCount: state.referralCount,
        isPremium: state.isPremium,
        isLocalProPreview: false,
        isLocalProPreviewConfigured: false,
        _premiumBeforeLocalPreview: false,
        upgradeWelcomePending: state.upgradeWelcomePending,
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
        freeCoachMessages: state.freeCoachMessages,
      }),
    }
  )
)

export default useStore
