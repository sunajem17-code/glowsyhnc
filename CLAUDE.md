# Ascendus — Rules for AI Sessions

These rules apply automatically at the start of every session without needing to be reminded. Treat violations as bugs.

---

## Standing Rules

### Never claim "done," "fixed," or "verified" without proof
- Any claim that something works requires one of: an actual log line/error output, a curl response, a grep result showing the code exists, or the user confirming they saw it work on their device.
- A clean build with no console errors is NOT proof a feature works. It only proves the code doesn't crash. Say this explicitly if that's all you have.
- If you haven't tested something live, say "this should work based on the code, but I have not verified it live" — do not say "done."

### Server vs client changes are different animals — always state which
- Every time you finish a change, explicitly tell the user: "this is a [server-side / client-side] change."
- **Server-side** (anything under `server/`): auto-deploys via Railway on push.
- **Client-side** (anything under `client/`): requires `npm run build`, `npx cap sync ios`, and a fresh Xcode install on the physical device before it's visible anywhere. Pushing the commit is not enough.
- If a task touches both, say so and give both deployment steps separately.

### Before ending any session, run this checklist and report the results
1. `git status` — anything uncommitted?
2. `git log origin/main..HEAD` — anything committed locally but not pushed?
3. Does `client/package.json` (and any other root `package.json`) still exist and match origin? A missing/modified `package.json` silently breaks builds.
4. If client code changed: has the user been told to rebuild + reinstall on device? Don't assume a previous rebuild covers new changes.

Report this checklist's results as part of your session summary every time, even if nothing needs action.

### Check for duplicate implementations before building
Before implementing a feature, grep for whether a similar/duplicate implementation already exists elsewhere in the codebase (this has happened before: two separate Settings screens, two separate delete-account flows). If you find more than one place doing the same job, flag it and ask whether to consolidate before adding a third.

### No assumptions about what auth/infra actually exists
This app does NOT use Supabase Auth (`auth.users` is never populated — custom `users` table + app-issued JWTs handle everything). Do not call `sb.auth.admin.*` functions assuming standard Supabase Auth exists. If a task seems to require Supabase Auth, stop and confirm the actual auth architecture first by reading `server/src/routes/auth.js` rather than assuming.

### Git discipline
- Never run `git commit` or `git push` without the user typing "confirmed" in response to a diff you've shown them.
- Do not trust a clean `git status` alone as proof code is deployed — cross-check against `origin/main`.
- The user commits and pushes manually from their own terminal after physical device testing, unless they explicitly say "confirmed push it" in that session.

---

## Security Rules

### 1. Server-side authority
Any field that affects score, premium status, subscription, leaderboard rank, or access to paid content must be **computed server-side and never accepted from the client request body**. If a route receives a score or `isPremium` value from `req.body`, that is a bug. Derive it from Claude's response, the database, or RevenueCat's API — never from what the client tells you.

### 2. No hardcoded secrets — ever
API keys, tokens, promo codes, webhook secrets, and passwords must **only** live in Railway environment variables. Never use a hardcoded fallback like `process.env.FOO || 'mysecret'`. If the env var is missing, throw at boot: `if (!process.env.FOO) throw new Error('[boot] FOO is required')`.

### 3. Auth check is always first
Every route that reads or writes user data must call `authMiddleware` (or equivalent) as the **first** middleware. The `userId` used in any query must come from `req.userId` (set by JWT verification) — never from `req.body.userId` or `req.query.userId`.

### 4. Rate limiting must be distributed
All Claude API routes (`/api/ai/*`, `/api/coach/*`) must use `createLimiter` backed by Upstash Redis. In-memory fallback is only acceptable in local dev. Production startup throws if Redis env vars are missing.

### 5. Webhook signatures are required
Any inbound webhook (RevenueCat, Stripe, Resend, internal) must verify its signature using `crypto.timingSafeEqual` before processing the body. Plain `===` comparison is not acceptable.

### 6. Pre-commit and CI
`secretlint` runs on every commit via `.husky/pre-commit`. GitHub Actions runs `gitleaks` on every push and `npm audit` monthly. Never skip hooks with `--no-verify`.

### 7. New routes checklist
Before merging any new Express route, confirm:
- [ ] Auth middleware is first
- [ ] userId comes from JWT, not request body
- [ ] Rate limiter applied (Redis-backed)
- [ ] No score/status value accepted from client
- [ ] Webhook signature verified (if applicable)
- [ ] Body limit is appropriate (default 2mb)
