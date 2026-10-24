# AI provider configuration

This migration is based on commit `2262e32c`. It changes server-side AI transport
only. Client files, auth/subscription middleware, scoring formulas, and database
code match that baseline. The official `openai` SDK already present in the locked
dependencies supplies `client.responses.create`; no dependency upgrade is needed.

Configure these variables on the **server**, in a local `server/.env` for local
testing or through your host's environment settings when you approve deployment:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
```

`openai` is the default when `AI_PROVIDER` is unset. The selected model supports
images, Responses, and strict Structured Outputs. Requests use `reasoning.effort:
none` for lower latency and `store:false`. Existing deterministic temperature
settings are preserved. Override `OPENAI_MODEL` only with a model supporting the
same parameters and modalities.

For the retained Anthropic implementation:

```dotenv
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_server_side_key
```

Restart the server after changing environment variables. Fallback is explicit:
an OpenAI error never silently sends a user's photos to another provider.
Neither key belongs in a client/Vite variable. Missing provider configuration
fails explicitly; it does not create scores.

## Integrations

| Route module | Migrated requests |
|---|---|
| `aiScore.js` | Core face/profile scores, extended metrics, physique, workout plan, photo validation |
| `coach.js` | Existing Adonis conversation, plain text |
| `hair.js` | Existing forced-tool hairstyle schema |
| `products.js` | Existing five-product array and descriptions |
| `swipemaxx.js`, `tindermaxx.js` | Existing image rankings and tips |
| `potential.js` | Potential feedback and image-editing prompt text |

The pre-existing OpenAI Images API call in `potential.js` remains an image
generation call; it is not an analysis request and is billed separately. No
prompts, weights, scoring categories, skincare recommendations, or response
field names were rewritten. A different model can still produce different
subjective ratings. This change does not establish scoring equivalence.

The adapter converts existing text/base64 image blocks to Responses inputs,
supplies strict JSON schemas, and normalizes results for current consumers.
Top-level product arrays are wrapped for Structured Outputs and unwrapped
before returning to existing code. Hair's forced tool input is returned in the
existing tool-result shape. Refusals, incomplete output, missing fields and
invalid score ranges fail before the scoring code can substitute defaults.

Cache hashes include the provider/model namespace, so changing providers cannot
return an old cached assessment from a different model. This requires no database
schema change. Existing caching and storage paths are otherwise unchanged.

## Pricing estimate

Published standard GPT-5.4 mini rates: **$0.75 per million input tokens** and
**$4.50 per million output tokens** (USD); cached input is **$0.075/M**.
Image input contributes to the input-token count.

For an uncached face+profile scan, an assumed 8,000–20,000 combined input tokens
and 1,000–2,000 output tokens across validation and core scoring is approximately
**$0.0105–$0.024 per scan**. Budget **$0.01–$0.03** as an estimate, not a measured
charge. Retries, extended metrics, physique, products/coaching, and generated
glow-up images are additional. Cache hits may avoid a model call.

The adapter logs only provider/model and token counts (including cached tokens).
Use actual `usage` for measured costs: `(input-cached)*0.75/1e6 +
cached*0.075/1e6 + output*4.50/1e6`. It does not log API keys or photos.

Sources checked October 21, 2026:

- [Model capabilities and pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)

## Verification

```sh
node --test server/src/lib/aiProvider.test.js server/src/utils/*.test.js
node --test server/src/lib/scanProvider.integration.test.js
node server/src/test-scoring.js
npm --prefix client run build
```

The integration suite runs real HTTP endpoints with fixture model responses and
isolated in-memory persistence, including image payloads, validation, scoring,
cache separation, auth failures, and invalid model responses. Fixtures do not
replace real analysis in the application. Live OpenAI tests require a configured
key and eligible account; device camera behavior still needs physical testing.

No deployment, production environment update, remote push, or database migration
is part of this implementation.
