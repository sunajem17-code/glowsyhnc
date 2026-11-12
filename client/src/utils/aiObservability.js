import posthog, { isPostHogConfigured } from '../posthog.js'

// The Privacy Policy classifies submitted photos and scan data as sensitive
// biometric data and limits their processing to appearance analysis. Keep their
// prompt/output content out of the browser analytics stream by default.
export const AI_OBSERVABILITY_PRIVACY_MODE = true

const AI_GENERATIONS = {
  '/ai/validate-scan': 'validate_scan',
  '/ai/score': 'score_face',
  '/ai/score/presentation': 'score_presentation',
  '/ai/score/physique': 'score_physique',
  '/ai/score/extended-metrics': 'score_extended_metrics',
  '/ai/workout-plan': 'generate_workout_plan',
  '/coach/appearance': 'generate_appearance_analysis',
  '/coach/message': 'coach_message',
  '/swipemaxx/rank': 'rank_swipemaxx_photos',
  '/tindermaxx/rank': 'rank_tindermaxx_photos',
}

export function createAiTraceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function safeSessionId(value) {
  if (typeof value !== 'string' || !value) return null
  return `coach-${value.replace(/[^A-Za-z0-9_~.@()!'|:-]/g, '_')}`
}

function getCoachSessionId(requestBody, response) {
  if (response?.conversationId) return safeSessionId(response.conversationId)
  const match = typeof requestBody === 'string' && /"conversationId"\s*:\s*"([^"\\]+)"/.exec(requestBody)
  return safeSessionId(match?.[1])
}

function getTextContent(requestBody, response) {
  if (AI_OBSERVABILITY_PRIVACY_MODE) return {}
  try {
    const request = JSON.parse(requestBody)
    if (!Array.isArray(request.messages) || typeof response?.message !== 'string') return {}
    return {
      $ai_input: request.messages.map(({ role, content }) => ({ role, content })),
      $ai_output_choices: [{ role: 'assistant', content: response.message }],
    }
  } catch {
    return {}
  }
}

export function captureAiGeneration({ path, requestBody, response, traceId, startedAt, httpStatus, failed = false }) {
  const spanName = AI_GENERATIONS[path]
  if (!spanName || !isPostHogConfigured) return

  const properties = {
    $ai_trace_id: traceId || createAiTraceId(),
    $ai_session_id: path === '/coach/message' ? getCoachSessionId(requestBody, response) : null,
    $ai_span_name: spanName,
    $ai_provider: 'anthropic',
    $ai_latency: Math.max(0, ((typeof performance === 'undefined' ? Date.now() : performance.now()) - startedAt) / 1000),
    ...(typeof httpStatus === 'number' ? { $ai_http_status: httpStatus } : {}),
    ...(failed ? { $ai_is_error: true } : {}),
  }
  const model = response?.model ?? response?.metadata?.model ?? response?.usage?.model
  if (typeof model === 'string' && model) properties.$ai_model = model

  try {
    posthog.capture('$ai_generation', {
      ...properties,
      ...getTextContent(requestBody, response),
    })
  } catch {
    // Observability must never affect a user-visible AI request.
  }
}
