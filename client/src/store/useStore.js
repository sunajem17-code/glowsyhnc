import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
        isPremium: user?.subscriptionTier === 'premium',
      }),
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

      // UI State
      scanInProgress: false,
      setScanInProgress: (v) => set({ scanInProgress: v }),

      analysisStep: 0,
      setAnalysisStep: (v) => set({ analysisStep: v }),

      // Pending scan photos (before analysis)
      pendingFacePhoto: null,
      pendingBodyPhoto: null,
      setPendingFacePhoto: (url) => set({ pendingFacePhoto: url }),
      setPendingBodyPhoto: (url) => set({ pendingBodyPhoto: url }),
      clearPendingPhotos: () => set({ pendingFacePhoto: null, pendingBodyPhoto: null }),

      // Gender (affects PSL tier labels + ideal ratios)
      gender: null, // null = not selected yet, 'male' | 'female'
      setGender: (g) => set({ gender: g }),

      // Premium
      isPremium: false,
      setIsPremium: (v) => set({ isPremium: v }),
    }),
    {
      name: 'glowsync-storage',
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
        isPremium: state.isPremium,
        gender: state.gender,
      }),
    }
  )
)

export default useStore
