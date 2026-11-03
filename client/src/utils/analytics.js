import { registerPlugin, Capacitor } from '@capacitor/core'

const NativeAnalytics = registerPlugin('NativeAnalytics')
const nativeIos = Capacitor.getPlatform() === 'ios'

const knownScreens = new Set([
  '/', '/privacy', '/terms', '/payment-success', '/landing', '/auth', '/onboarding',
  '/dev/analysis-inspector', '/dev/reset-onboarding', '/unlock', '/scan', '/scan/capture',
  '/extras', '/plan', '/progress', '/streak', '/profile', '/leaderboard', '/compare',
  '/history', '/timeline', '/coach', '/swipemaxx', '/tindermaxx', '/community',
  '/settings', '/workout-plan', '/face-body-routine', '/scan/ready', '/scan/quality-fail',
])
const reachedScreensStorageKey = 'ascendus.analytics.reachedScreens.v1'
const inMemoryReachedScreens = new Set()

let collectionEnabled = false
let configuration = Promise.resolve()
let activeSession = false
let currentScreen = 'unknown'
let lastLoggedScreen = null

function safeScreenName(pathname) {
  if (pathname.startsWith('/r/')) return '/r/:code'
  const normalized = pathname.replace(/\/$/, '') || '/'
  if (knownScreens.has(normalized)) return normalized

  // Dynamic routes are reported without their user supplied IDs, names, or slugs.
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length > 1 && knownScreens.has(`/${segments[0]}`)) return `/${segments[0]}/:detail`
  return '/other'
}

function sendEvent(name, parameters = {}) {
  if (!nativeIos || !collectionEnabled) return Promise.resolve()
  return NativeAnalytics.logEvent({ name, parameters }).catch(() => {})
}

function getReachedScreens() {
  try {
    const stored = window.localStorage.getItem(reachedScreensStorageKey)
    const parsed = stored ? JSON.parse(stored) : []
    return new Set([
      ...inMemoryReachedScreens,
      ...(Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : []),
    ])
  } catch {
    return new Set(inMemoryReachedScreens)
  }
}

function rememberReachedScreen(screenName) {
  try {
    const reached = getReachedScreens()
    if (reached.has(screenName)) return false
    reached.add(screenName)
    inMemoryReachedScreens.add(screenName)
    window.localStorage.setItem(reachedScreensStorageKey, JSON.stringify([...reached]))
    return true
  } catch {
    // Keep normal screen/session analytics working if local storage is unavailable.
    return true
  }
}

export function setAnalyticsCollectionEnabled(enabled) {
  collectionEnabled = Boolean(enabled)
  if (!collectionEnabled) {
    activeSession = false
    lastLoggedScreen = null
  }

  configuration = nativeIos
    ? NativeAnalytics.setCollectionEnabled({ enabled: collectionEnabled }).catch(() => {})
    : Promise.resolve()
  return configuration
}

export async function trackScreenView(pathname) {
  if (pathname === '/onboarding' || pathname === '/auth' || pathname === '/scan/capture') return
  return trackNamedScreenView(safeScreenName(pathname))
}

export async function trackOnboardingScreen(screenName) {
  const safeNames = new Set([
    'intro', 'gender', 'halo_effect', 'why_appearance', 'primary_goal',
    'notifications', 'testimonials', 'cinematic', 'sign_in',
  ])
  if (!safeNames.has(screenName)) return
  return trackNamedScreenView(`onboarding_${screenName}`)
}

export async function trackScanScreen(screenName) {
  const safeNames = new Set(['front_photo', 'side_photo'])
  if (!safeNames.has(screenName)) return
  return trackNamedScreenView(`scan_${screenName}`)
}

async function trackNamedScreenView(screenName) {
  currentScreen = screenName
  await configuration
  if (!collectionEnabled || lastLoggedScreen === currentScreen) return

  if (!activeSession) {
    activeSession = true
    await sendEvent('app_session_start', { screen_name: currentScreen })
  }
  lastLoggedScreen = currentScreen
  if (rememberReachedScreen(currentScreen)) {
    await sendEvent('screen_reached', { screen_name: currentScreen })
  }
  await sendEvent('screen_view', {
    screen_name: currentScreen,
    screen_class: 'AscendusApp',
  })
}

export async function endAnalyticsSession() {
  await configuration
  if (!collectionEnabled || !activeSession) return
  activeSession = false
  lastLoggedScreen = null
  await sendEvent('app_session_end', { screen_name: currentScreen })
}

export async function resumeAnalyticsSession() {
  await configuration
  if (!collectionEnabled || activeSession) return
  activeSession = true
  lastLoggedScreen = currentScreen
  await sendEvent('app_session_start', { screen_name: currentScreen })
}
