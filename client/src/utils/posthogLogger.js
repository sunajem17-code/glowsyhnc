import posthog, { isPostHogConfigured } from '../posthog.js'

// This dedicated logger is the only path this integration uses to export logs.
// Keep attributes limited to safe, structured operational metadata.
export function logPostHog(level, message, attributes = {}) {
  if (!isPostHogConfigured) return
  const logger = posthog.logger
  if (typeof logger?.[level] !== 'function') return
  logger[level](message, attributes)
}
