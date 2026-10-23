# Adonis scan context

Both existing chat routes remain: `/progress` (main tab) and `/coach`. Their styling, navigation and animations are preserved. They now send the new user message, a conversation identifier and bounded self-reported preferences. They do not submit authoritative scan scores.

## Why scans were missing

The coach used only browser-supplied `scanContext`, did not query saved history, and expected outdated fields such as `jawline` and `overallHarmony` rather than the saved `jawlineDefinition` and `facialHarmony`. Non-Pro users' scan context was completely excluded. The main chat and secondary chat are separate components; both needed wiring. The secondary component also referenced undefined free-usage variables and could fail when rendering replies.

## Scan → coach

`POST /api/ai/score` now creates a processing row in the existing server SQLite `scans` table. Before returning success, including on cache hits, it saves the actual server result in the existing JSON `face_data` field, scores and completion timestamp. Failures are recorded separately. The response includes `scanId`. No schema migration is required.

The existing cloud save route links that owned ID, upserts the existing cloud summary and attaches only an owned private storage path. Its numeric fields come from the server record; client-supplied scores are ignored. Older clients without `scanId` can link a recent server-generated completed result (15-minute window). A save without a server record is rejected, not fabricated. The upload result's existing string path is now handled correctly. Local/client history stores `serverScanId` for deduplication.

`GET /api/coach/context` reports availability only. Every `POST /api/coach/message` freshly retrieves user-scoped local and configured cloud history and profile goals. It merges the same scan ID, selects the latest completed scan plus up to two previous scans, and distinguishes processing, failed/stale processing and no scan. A cloud retrieval failure is an explicit retryable error; it never becomes an invented analysis or another user's data.

Existing cloud rows have summary fields only. The full new analysis record (strengths, recommendations, observations and available measurement evidence) is stored in server SQLite. Cloud summaries remain readable if richer fields do not exist. No nonexistent cloud columns are assumed. Full-detail retention therefore depends on preserving the existing server data directory/SQLite database; this change does not provision or verify a production persistent volume. Cloud-only historical scans cannot recover details never saved there.

## Evidence and images

Adonis distinguishes saved subjective appearance scores, reported landmark evidence, saved model observations, fresh/cached visual review and general recommendations. It is instructed not to call the measurement pipeline scientifically validated, invent exact ratios from photos, diagnose conditions or infer progress from a score change alone.

A relevant visual question can request a qualitative image review only when the user's server-saved `ai_consent` is true. Only `scan/<JWT-user-id>/<filename>` paths in the private `scan-images` bucket are accepted; arbitrary URLs, traversal and another owner's paths are rejected. Storage is asked for a 768×768 transformed image, with a 2 MB cap and MIME validation. Unsupported transforms, missing images and vision failures fall back to structured coaching with an explicit visual-status marker. There is no raw/full-resolution fallback.

Qualitative reviews are cached in memory for 10 minutes using a hash of user, scan ID/timestamp, image path, observations and provider/model. Consent and ownership are rechecked before cache access. No URLs, image bytes or credentials are included in the conversational prompt or returned metadata. The OpenAI adapter uses `store:false`; only usage counts are logged. Anthropic remains selectable through the existing provider adapter.

## Conversation and access

The server retains the latest 12 messages (six exchanges) per user/conversation for 30 minutes, with a bounded 200-session cache. Client-supplied assistant messages are not trusted as server conversation history. Concurrent requests for the same session are rejected until its reply finishes. Each turn gets current scan context, so a newer scan replaces the factual context while earlier advice remains available for follow-up questions.

Both UIs preserve the conversation ID and up to 12 displayed messages in per-user session storage. Late replies after account changes, navigation or reset are discarded. The client sends only the new question, rather than resending all displayed history. Memory is process-local: it expires after inactivity and is not shared across server workers or restarts. After a restart/expiry, Adonis must ask for clarification if a reference to earlier advice cannot be resolved.

JWT identity is the only query owner. Existing custom JWT authentication, subscription resolution and distributed AI limiter are reused. Demo accounts remain blocked; the existing server free-message lifetime allowance and Pro score restrictions remain. The main chat retains its existing entry behavior; the secondary chat retains its premium entry gate. No payment/subscription implementation changes were made.

## Verification

Run:

- `node --test server/src/lib/coachIntelligence.test.js server/src/lib/aiProvider.test.js server/src/lib/scanProvider.integration.test.js server/src/utils/*.test.js`
- `node --test tests/providerResultsUI.test.mjs client/src/utils/coachChat.test.js`
- `node server/src/test-scoring.js`
- `npm --prefix client run build`

Tests use an isolated in-memory SQLite database, fixture AI replies and isolated HTTP servers. They cover scan completion/cache persistence before coach retrieval, saved evidence, previous scans, missing/processing/failed scans, unavailable images, consent/path restrictions, cached vision invalidation, user isolation, follow-up memory, duplicate requests, forged client scores/roles/user IDs, cloud save ownership, retrieval failures, provider failures and existing UI/access rendering.

Separate live OpenAI checks used invented scan fixtures and a bundled sample portrait, not a user's private scan: real summary, follow-up and vision requests succeeded. This does not verify live production Supabase Storage, a physical-device capture or the user's personal end-to-end scan.

The local preview intentionally has production services disabled. Its earlier device-only scan has no server record; one new scan is needed to exercise personal scan-aware coaching. Do not reconstruct it from untrusted browser ratings. These are both server-side and client-side changes. For iPhone installation, rebuild the client, sync iOS and install through Xcode; a build alone is not device verification. No push or deployment has been performed.

## Local Pro preview

The existing client-only Pro preview can be paired with explicit server test access: set `LOCAL_PRO_PREVIEW_USER_IDS` to selected authenticated local user IDs in the development API process. It requires a loopback connection and `NODE_ENV=development`; production, demo tokens, unlisted owners and browser-supplied premium fields cannot activate it. It does not change subscription or payment records. The coach context endpoint identifies this as `access: local_preview`. Normal subscription resolution is unchanged outside this explicit local test mode.
