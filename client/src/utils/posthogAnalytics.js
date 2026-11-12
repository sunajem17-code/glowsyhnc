import posthog from 'posthog-js'
import { Capacitor } from '@capacitor/core'

const events = new Set(['screen_view', 'screen_reached', 'app_session_start', 'app_session_end'])
const allowedProperties = new Set([
  'distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version',
  '$process_person_profile', '$is_identified', 'screen_name', 'screen_class', 'platform',
])

// Never forward URLs, query strings, photos, results, or arbitrary user content.
export function sanitizePostHogEvent(event) {
  if (!event || !events.has(event.event)) return null
  return { ...event, properties: Object.fromEntries(
    Object.entries(event.properties || {}).filter(([key]) => allowedProperties.has(key)),
  ) }
}

export function createPostHogAnalytics(sdk, { token, host, platform }) {
  let initialized = false
  let enabled = false
  return {
    setEnabled(value) {
      enabled = Boolean(value) && Boolean(token && host)
      try {
        if (!enabled) {
          if (initialized) sdk.opt_out_capturing()
          return
        }
        if (!initialized) {
          sdk.init(token, {
            api_host: host,
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            capture_performance: false,
            capture_exceptions: false,
            disable_session_recording: true,
            disable_surveys: true,
            advanced_disable_flags: true,
            person_profiles: 'never',
            persistence: 'localStorage',
            opt_out_capturing_by_default: true,
            before_send: sanitizePostHogEvent,
          })
          initialized = true
        }
        sdk.opt_in_capturing({ captureEventName: false })
      } catch {
        enabled = false // Analytics must never block the app.
      }
    },
    capture(name, parameters = {}) {
      if (!initialized || !enabled || !events.has(name)) return
      try {
        sdk.capture(name, {
          screen_name: parameters.screen_name,
          ...(parameters.screen_class ? { screen_class: parameters.screen_class } : {}),
          platform,
        })
      } catch { /* Keep analytics failures out of user flows. */ }
    },
  }
}

export const posthogAnalytics = createPostHogAnalytics(posthog, {
  token: import.meta.env?.VITE_POSTHOG_PROJECT_TOKEN,
  host: import.meta.env?.VITE_POSTHOG_HOST,
  platform: Capacitor.getPlatform(),
})
