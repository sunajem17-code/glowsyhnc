# Ascendus — High-Conversion Feature Build Prompt

You are building conversion-optimized features for **Ascendus**, an AI looksmaxxing iOS app (React/Vite frontend + Node/Express backend + Supabase). The app sells a Pro subscription ($9.99/mo or $59.99/yr) via RevenueCat (native) and Stripe (web). The codebase lives at the repo root.

Key files to understand before starting:
- `client/src/pages/Premium.jsx` — paywall page
- `client/src/pages/Results.jsx` — post-scan results page
- `client/src/components/ProLock.jsx` — blur-gate component
- `client/src/components/PromoModal.jsx` — promo code modal
- `client/src/utils/iap.js` — RevenueCat integration
- `server/src/routes/payments.js` — Stripe checkout
- `server/src/routes/scan.js` — scan logic

---

## Features to Build (prioritized by conversion impact)

---

### 1. Score-Gate Paywall on Results Page (HIGHEST PRIORITY)

**What:** After a free scan, reveal the overall Glow Score with full animation, then immediately blur/lock the sub-scores (Face, Body, Grooming, Posture) behind a "See Your Full Breakdown" CTA that pushes to `/premium`.

**Why it converts:** Users are emotionally invested right after seeing their score. This is the highest-intent moment in the entire app. Don't waste it.

**Implementation:**
- In `Results.jsx`, check `isPremium` from the store
- Free users: show Glow Score ring fully visible, then render sub-score cards blurred using the existing `<ProLock>` component with `solid={false}` and `blurAmount="10px"`
- Add a sticky bottom CTA bar: `"Unlock Your Full Breakdown → Pro"` in gold, with a subtle pulse animation on mount
- The CTA should navigate to `/premium?from=results` so the paywall can show context-aware copy ("Your Face sub-score is waiting...")
- On `/premium`, read the `from=results` param and add a line at the top: `"Your full breakdown is one tap away."`

---

### 2. Exit-Intent Discount Modal on Paywall Page

**What:** When a user on `/premium` taps the back button or the X to leave without converting, intercept with a modal offering a one-time 30% discount for the next 10 minutes.

**Why it converts:** Exit-intent captures users who were almost there. A time-limited discount closes the hesitation loop.

**Implementation:**
- In `Premium.jsx`, use `useEffect` + `window.history.pushState` trick or the back-navigation listener to detect exit intent
- Trigger a `DiscountModal` component showing:
  - "Wait — Get 30% Off Today Only"
  - Countdown timer (10 minutes, persisted to `sessionStorage` so refresh doesn't reset it)
  - New price displayed prominently (e.g. "$6.99/mo" struck through to "$4.99/mo")
  - CTA: "Claim My Discount" — applies a server-generated promo code via `POST /api/promo/generate-exit` (create this endpoint), then calls `handleSubscribe()` with the code auto-applied
- If the countdown expires, collapse to a softer CTA: "Start Free Trial Instead"
- Only show once per session (gate with `sessionStorage.getItem('exitShown')`)

---

### 3. Score Projection Teaser (Pro Carrot)

**What:** On the Results page and Dashboard, show a "Projected Score in 12 Weeks" number (e.g. "+3.4 pts → 8.1") blurred behind a ProLock. Free users see a ghosted number, Pro users see the full projection with a breakdown of which pillar will move most.

**Why it converts:** Shows users the tangible upside of upgrading. Turns abstract "get Pro" into "get to 8.1."

**Implementation:**
- The projection logic already exists at `server/src/routes/potential.js` and `client/src/components/PotentialViewer.jsx` — wire it to the Results page
- Free users: render `<PotentialViewer>` wrapped in `<ProLock solid label="Your 12-Week Projection" description="See exactly how far you can go" />`
- On the Dashboard, add a small teaser card: "You could reach [X] in 12 weeks — tap to see how" that links to `/premium?from=projection`

---

### 4. Social Proof Toast Notifications

**What:** Show real-time-style toast popups in the corner of the screen while on `/premium` (and optionally the home screen): "Marcus from Dallas just hit 7.8 🔥" or "14 users upgraded in the last hour."

**Why it converts:** Social proof at the decision moment reduces friction. FOMO works.

**Implementation:**
- Create `client/src/components/SocialProofToast.jsx`
- Data source: a small static array of anonymized real user milestones (pull from leaderboard data or hardcode 10–15 realistic entries). Rotate through them every 8–12 seconds with a slide-in/slide-out animation (Framer Motion)
- Show on `/premium` only, starting 3 seconds after mount
- Keep it subtle: bottom-left corner, small pill shape, auto-dismisses after 4 seconds
- Do NOT show if user is actively interacting with the plan selector (focus state check)

---

### 5. Referral Reward Loop

**What:** Enhance the existing referral system (`client/src/pages/Referral.jsx`, `server/src/routes/referral.js`) to offer the referrer 7 days of free Pro for each successful referral (friend completes first scan + creates account).

**Why it converts:** Existing users become your growth engine. Each converted referral also has high LTV because they came from a trusted source.

**Implementation:**
- In `server/src/routes/referral.js`, add a webhook/trigger: when a referred user completes their first scan, extend the referrer's `pro_expires_at` by 7 days in Supabase
- Add a `GET /api/referral/status` endpoint returning: `{ referrals_sent, referrals_converted, days_earned }`
- On `Referral.jsx`, replace the static copy with a live counter: "You've earned X free days. Refer 1 more friend → unlock 7 more days."
- Add a persistent banner on Dashboard for non-Pro users: "📣 Refer a friend → get 7 days free" that links to `/referral`

---

### 6. Streak-Based Upgrade Nudge

**What:** When a user hits a 3-day or 7-day check-in streak, show a celebration modal that acknowledges the streak AND pitches the Pro upgrade as "the next level."

**Why it converts:** Streak milestones are high-emotion moments. Users are engaged and proud — perfect time to pitch.

**Implementation:**
- In `client/src/pages/DailyCheckin.jsx`, after a successful check-in that hits a milestone (3, 7, 14, 30 days), trigger a `StreakMilestoneModal`
- The modal has two parts:
  1. Celebrate the streak with an animation (existing `AchievementToast` pattern)
  2. Below that: "Pro members get streak freeze tokens + bonus scans when they hit streaks. Ready to level up?" with a CTA to `/premium?from=streak`
- Only show the upgrade pitch if `!isPremium`. Pure celebration if already Pro.

---

### 7. Onboarding Paywall (Soft Gate)

**What:** After the user completes their first scan and sees their score, before they can access the Action Plan, show a full-screen "Your Plan Is Ready" interstitial that teases the 12-week plan and gates it behind Pro.

**Why it converts:** The Action Plan is high perceived value. Users expect to pay for a personalized plan. Show it to them right when they're most curious.

**Implementation:**
- In `client/src/pages/ActionPlan.jsx`, if `!isPremium && isFirstScan`, redirect to a new `PlanGateScreen` before rendering the plan
- `PlanGateScreen` shows:
  - "Your 12-Week Plan is Ready" headline
  - 3 teaser items from the plan (first week blurred)
  - CTA: "Unlock Full Plan — Start Free Trial"
  - Small secondary link: "Not now, just show me basics"
- Track the "Not now" click as a conversion event for analytics

---

### 8. In-App Purchase Price Anchor

**What:** On the Premium page, display the annual plan as the default-selected option and show the monthly equivalent price prominently: "Only $5/mo — billed $59.99/yr" with a "BEST VALUE" badge. Monthly should be visually secondary.

**Why it converts:** Anchoring to the annual plan increases LTV dramatically. Most apps default to monthly and leave money on the table.

**Implementation:**
- In `Premium.jsx`, change `const [plan, setPlan] = useState('monthly')` to `useState('annual')`
- Redesign the plan toggle: annual pill is gold/filled by default, monthly is outline
- Add "SAVE 50%" badge on the annual option
- Show per-month breakdown under the annual price: "$59.99/yr = $5/mo"
- On the subscribe button, dynamically show: "Start 3-Day Free Trial → then $5/mo" (annual) vs "Start 3-Day Free Trial → then $9.99/mo" (monthly)

---

## Tech Notes

- All new server endpoints go in `server/src/routes/` and register in `server/src/index.js`
- Use existing `supabase` client from `server/src/supabase.js` for DB operations
- Frontend uses the `api` utility from `client/src/utils/api.js` — add any new endpoint wrappers there
- Global state (isPremium, user) lives in `client/src/store/useStore.js` (Zustand)
- Existing gold token: `#C6A85C` — use it for all Pro-related UI
- RevenueCat is already initialized in `Premium.jsx` via `initRevenueCat()` — don't re-init elsewhere

## Success Metrics to Track

For each feature, log a conversion event to your analytics with these event names:
- `paywall_shown` (source: results | projection | streak | plan_gate | exit_intent)
- `paywall_converted` (source: same)
- `referral_sent`
- `referral_converted`
- `streak_milestone_shown`
- `exit_intent_triggered`
- `exit_intent_converted`

Start with Feature 1 (Score-Gate on Results) and Feature 8 (Price Anchor) — these two alone can move conversion rate 20–40% with minimal code.
