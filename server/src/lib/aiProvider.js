const OpenAI = require('openai')
const Anthropic = require('@anthropic-ai/sdk')

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini'
const REQUEST_TIMEOUT_MS = 60_000

function configuration(env = process.env) {
  const provider = (env.AI_PROVIDER || 'openai').trim().toLowerCase()
  if (!['openai', 'anthropic'].includes(provider)) throw new Error('AI_PROVIDER must be openai or anthropic')
  const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'
  return { provider, keyName, apiKey: env[keyName]?.trim(), model: (env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() }
}
function getAIKey(env = process.env) { return configuration(env).apiKey }
function cacheNamespace(env = process.env) {
  const config = configuration(env)
  return config.provider === 'openai' ? `openai:${config.model}:responses-v1` : 'anthropic:legacy-v1'
}

function failure(message, status = 502, code = 'invalid_ai_response') {
  return Object.assign(new Error(message), { status, code })
}

function inputContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) throw failure('Unsupported AI message content', 400)
  return content.map(block => {
    if (block.type === 'text') return { type: 'input_text', text: block.text }
    if (block.type === 'image' && block.source?.type === 'base64') return {
      type: 'input_image', image_url: `data:${block.source.media_type};base64,${block.source.data}`, detail: 'high',
    }
    if (block.type === 'image' && block.source?.type === 'url') return { type: 'input_image', image_url: block.source.url, detail: 'high' }
    throw failure('Unsupported AI image or message format', 400)
  })
}

// Existing forced-tool schemas contain an empty enum when no measurements are
// available. Such a field must be an empty array, not an invented measurement ID.
function normalizeSchema(schema) {
  const result = structuredClone(schema)
  function visit(node) {
    if (node.type === 'array' && node.items?.enum?.length === 0) {
      delete node.items.enum
      node.maxItems = 0
    }
    if (node.type === 'object') {
      node.additionalProperties = false
      node.required = Object.keys(node.properties || {})
      Object.values(node.properties || {}).forEach(visit)
    }
    if (node.items) visit(node.items)
  }
  visit(result)
  return result
}

function validate(value, schema, path = 'response') {
  const bad = () => { throw failure(`AI returned invalid data at ${path}`) }
  if (schema.enum && !schema.enum.includes(value)) bad()
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) bad()
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) bad()
    for (const key of Object.keys(value)) {
      if (!schema.properties?.[key]) { if (schema.additionalProperties === false) bad(); continue }
      validate(value[key], schema.properties[key], `${path}.${key}`)
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) bad()
    value.forEach((item, index) => validate(item, schema.items, `${path}[${index}]`))
  } else if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))
      || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) bad()
  } else if (typeof value !== schema.type) bad()
  return value
}

function createAIClient({ env = process.env, openai, anthropic, logger = console } = {}) {
  const config = configuration(env)
  if (!config.apiKey) throw failure(`${config.keyName} is not configured on the server`, 503, 'ai_not_configured')
  const client = config.provider === 'openai'
    ? openai || new OpenAI({ apiKey: config.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 })
    : anthropic || new Anthropic({ apiKey: config.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 })
  return {
    async generate(request) {
      const { responseSchema, responseName = 'ascendus_response', ...legacyRequest } = request
      // Keep the existing Anthropic transport, models, prompts and forced tool
      // behavior available. Switching providers is always explicit, never silent.
      if (config.provider === 'anthropic') return client.messages.create(legacyRequest)
      const forcedTool = request.tool_choice?.type === 'tool'
        ? request.tools?.find(tool => tool.name === request.tool_choice.name) : null
      const schema = responseSchema || forcedTool?.input_schema
      const normalized = schema ? normalizeSchema(schema) : null
      const wrappedArray = normalized?.type === 'array'
      const formatSchema = wrappedArray ? { type: 'object', properties: { items: normalized }, required: ['items'], additionalProperties: false } : normalized
      const response = await client.responses.create({
        model: config.model,
        ...(request.system ? { instructions: typeof request.system === 'string' ? request.system : request.system.map(block => block.text).join('\n') } : {}),
        input: request.messages.map(message => {
          // Anthropic's conversation contract accepts only user/assistant turns.
          // Do not turn a client-supplied role into a new system/developer prompt.
          if (!['user', 'assistant'].includes(message.role)) throw failure('Unsupported AI conversation role', 400)
          return { role: message.role, content: inputContent(message.content) }
        }),
        reasoning: { effort: 'none' },
        ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
        max_output_tokens: Math.max(512, request.max_tokens || 1024),
        store: false,
        ...(formatSchema ? { text: { format: { type: 'json_schema', name: forcedTool?.name || responseName, strict: true, schema: formatSchema } } } : {}),
      })
      if (response.output?.some(item => item.content?.some(block => block.type === 'refusal'))) {
        throw failure('AI could not analyze this request. Please try another photo or request.', 422, 'ai_refusal')
      }
      if (response.status !== 'completed') throw failure('AI analysis did not finish. Please retry.', 502, 'incomplete_ai_response')
      let text = response.output_text || response.output?.flatMap(item => item.content || []).filter(block => block.type === 'output_text').map(block => block.text).join('')
      if (!text?.trim()) throw failure('AI returned an empty response. Please retry.')
      let parsed
      if (normalized) {
        try { parsed = JSON.parse(text) } catch { throw failure('AI returned unreadable JSON. Please retry.') }
        if (wrappedArray) parsed = parsed.items
        validate(parsed, normalized)
        text = JSON.stringify(parsed)
      }
      const inputTokens = response.usage?.input_tokens || 0
      const outputTokens = response.usage?.output_tokens || 0
      const cachedTokens = response.usage?.input_tokens_details?.cached_tokens || 0
      logger.info?.('[ai-provider]', JSON.stringify({ provider: config.provider, model: config.model, inputTokens, outputTokens, cachedTokens }))
      return { content: forcedTool ? [{ type: 'tool_use', name: forcedTool.name, input: parsed }] : [{ type: 'text', text }],
        stop_reason: 'end_turn', usage: { input_tokens: inputTokens, output_tokens: outputTokens } }
    },
  }
}

module.exports = { createAIClient, configuration, getAIKey, cacheNamespace, inputContent, normalizeSchema, validate, DEFAULT_OPENAI_MODEL }
