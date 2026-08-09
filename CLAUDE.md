# Ascendus — Security Rules for AI Sessions

These rules apply to every new feature, route, or code change. Treat violations as bugs.

## 1. Server-side authority
Any field that affects score, premium status, subscription, leaderboard rank, or access to paid content must be **computed server-side and never accepted from the client request body**. If a route receives a score or isPremium value from `req.body`, that is a bug. Derive it from Claude's response, the database, or RevenueCat's API — never from what the client tells you.

## 2. No hardcoded secrets — ever
API keys, tokens, promo codes, webhook secrets, and passwords must **only** live in Railway environment variables. Never use a hardcoded fallback like `process.env.FOO || 'mysecret'`. If the env var is missing, throw at boot: `if (!process.env.FOO) throw new Error('[boot] FOO is required')`.

## 3. Auth check is always first
Every route that reads or writes user data must call `authMiddleware` (or equivalent) as the **first** middleware. The `userId` used in any query must come from `req.userId` (set by JWT verification) — never from `req.body.userId` or `req.query.userId`.

## 4. Rate limiting must be distributed
All Claude API routes (`/api/ai/*`, `/api/coach/*`) must use `createLimiter` backed by Upstash Redis. In-memory fallback is only acceptable in local dev. Production startup throws if Redis env vars are missing.

## 5. Webhook signatures are required
Any inbound webhook (RevenueCat, Stripe, Resend, internal) must verify its signature using `crypto.timingSafeEqual` before processing the body. Plain `===` comparison is not acceptable.

## 6. Pre-commit and CI
`secretlint` runs on every commit via `.husky/pre-commit`. GitHub Actions runs `gitleaks` on every push and `npm audit` monthly. Never skip hooks with `--no-verify`.

## 7. New routes checklist
Before merging any new Express route, confirm:
- [ ] Auth middleware is first
- [ ] userId comes from JWT, not request body
- [ ] Rate limiter applied (Redis-backed)
- [ ] No score/status value accepted from client
- [ ] Webhook signature verified (if applicable)
- [ ] Body limit is appropriate (default 2mb)
