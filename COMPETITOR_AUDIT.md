# Ascendus — Competitor Scan & Codebase Audit

---

## Competitor Landscape

### 1. Umax — Market Leader (~3.5M downloads)
**What they do well:**
- PSL scale displayed prominently (0-8) alongside a 0-10 scale — users toggle between them
- Voice & Confidence Coach: rates pitch, resonance, masculinity, detects vocal fry, gives training drills
- Animal Face archetypes (Fox, Deer, Puppy) — viral, shareable, high engagement
- Gymmaxing: physique photo upload + muscle symmetry + diet/workout suggestions
- "What you'd look like as a 10/10" AI image transformation — massive conversion driver
- Jawline analysis with mewing exercises built-in

**Why they're winning:** The voice coach and AI transformation are features nobody else has. The PSL scale gives the community what it wants in its own language.

---

### 2. RateByFresh — Best UI Competitor
**What they do well:**
- 7 scoring categories: Face, Hair, Body, Skin, Color, Sexual Dimorphism, Fragrance
- **Color/Season analysis** — tells you what colors actually suit your complexion (spring/summer/autumn/winter palette)
- Fragrance category with personalized recommendations
- Skin routine with specific ingredient guidance (e.g., "You need niacinamide for these pores")
- Physique analysis from front + side photos
- Glow-up preview (realistic transformation image)
- "FRESH Method" planning (their branded framework)

**Why it matters:** RateByFresh is eating the female market with color analysis and skin ingredient guidance. Ascendus has zero female-specific differentiation right now.

---

### 3. Umog/Mogged — Community Favorite
**What they do well:**
- **Rizz Coach / Social skills** module — conversation coaching, text response suggestions
- **Tindermaxxing** — AI-optimizes your dating app photos for more matches
- PSL (0-8) AND Objective (0-10) scale toggle in the same app
- AI transformation: shows you as a "mogger" (higher-tier version)
- Social skills improvement alongside looks improvement

**Why it matters:** The dating profile optimizer is low-effort to build and absurdly high value for users. Zero other app has it this clean.

---

## What Ascendus Has That Competitors DON'T
(Protect these — they're your moat)

- **HairMaxx AI simulator** — unique, no direct competitor matches it
- **Detailed PSL metrics under the hood** (canthalTilt, hunterEyes, jawDefinition, cheekbones, maxilla, facialThirds) — this data exists in `analysis.js` but is barely surfaced in the UI
- **Score projection / PotentialViewer** — showing where you'll be in 12 weeks is a genuinely compelling feature
- **Gold dark aesthetic** — best-looking app in the space, hands down
- **Referral system** — no competitor has this wired up properly
- **Leaderboard** — community competition, keeps users coming back

---

## Bugs Found in Ascendus Codebase

### BUG 1 — Fake chart data shown to new users (Dashboard.jsx:44)
```js
// When no scans exist, dashboard shows this hardcoded fake data:
chartData.push(...[62, 65, 67, 70, 68, 72, 74, 78].map(...))
```
**Impact:** New users see a fake upward score trend on their dashboard. This is misleading and if a user notices it destroys trust. Fix: show an empty state ("Complete your first scan to track progress") instead of fake data.

---

### BUG 2 — Score normalization inconsistency (Dashboard.jsx:34)
```js
const glowScore = rawGlowScore > 10 ? Math.round(rawGlowScore) / 10 : rawGlowScore
```
Some scans store scores as 0–100, others as 0–10. The normalization only applies to the dashboard display, not to the score delta calculation on line 166:
```js
{glowScore - (scans[1]?.glowScore ?? glowScore)} pts since last scan
```
If `scans[1].glowScore` is stored as a raw 0–100 value and `glowScore` was normalized to 0–10, the delta is completely wrong (e.g., shows "-67 pts since last scan"). **Fix:** normalize all scores in `addScan()` in the store, not in the display layer.

---

### BUG 3 — Client-side scoring is unverified (server/routes/scan.js:55–70)
```js
// Comment in the code literally says:
// "Server-side scoring simulation (client does the real analysis; this stores results)"
const { faceData, bodyData, glowScore, ... } = req.body
db.prepare(`UPDATE scans SET glow_score = ? ...`).run(..., glowScore, ...)
```
The server just writes whatever score the client sends. Anyone can POST `{ glowScore: 9.9, faceData: {...} }` and get a fake 9.9 stored. This breaks leaderboard integrity. **Fix:** move scoring to server-side using the Claude API or at minimum add a sanity range check (0.0–10.0) and hash verification.

---

### BUG 4 — No rate limit on `/api/scan/analyze`
Auth rate limiting exists on `/auth/*` but the `/scan/analyze` endpoint has no rate limit. A user could automate hundreds of scan submits per hour, flooding the DB and potentially gaming the leaderboard. **Fix:** add `createLimiter('scan', 5, '1h', 3600000)` to the analyze route.

---

### BUG 5 — Progress page missing Body + Posture tabs (Progress.jsx)
```js
const METRIC_TABS = [
  { key: 'glowScore',     label: 'Overall' },
  { key: 'faceScore',     label: 'Face' },
  { key: 'groomingScore', label: 'Grooming' },
]
```
The 4 pillars you sell are Face, Body, Grooming, Posture — but the Progress chart only tracks 3 of them. Body and Posture progress can't be visualized over time. Users have no way to see if their body score is improving. **Fix:** add `bodyScore` and `postureScore` tabs to METRIC_TABS.

---

### BUG 6 — isPremium always resets to false on login (useStore.js:18)
```js
setAuth: (user, token) => set({
  isPremium: false, // ← always false, even for paying users
})
```
Premium status is then recovered asynchronously via RevenueCat or API. If RevenueCat fails silently (offline, flaky connection) a paying user gets a free experience. **Fix:** store the premium status on the user object from the server and hydrate it in `setAuth` from `user.subscription_tier === 'premium'`.

---

## Missing Features (Ranked by Revenue Impact)

### 1. AI Transformation / "Potential Unlock" — HIGH PRIORITY
Umax and Umog both show users what they'd look like at a higher tier. This is the single most viral and highest-converting feature in the space. You have `PotentialViewer.jsx` built but it seems to only show a score projection, not an actual image transformation. **Add:** Claude/DALL-E powered "see your potential" image where the AI subtly enhances jawline, skin, posture in the photo. Gate it behind Pro. This single feature could move conversion 15–25%.

### 2. PSL Scale Toggle — MEDIUM PRIORITY
You have ALL the PSL data in `analysis.js` (canthalTilt, hunterEyes, jawDefinition, maxilla, etc.) but users only see the 0–10 Glow Score. The core looksmaxxing community speaks PSL. Add a toggle on Results: "Glow Score (0–10) | PSL Rating (0–8)" that maps the existing data. Zero new AI calls needed — just a UI change and a conversion formula.

### 3. Dating Photo Optimizer ("TinderMaxx") — HIGH PRIORITY
Umog's Tindermaxxing feature is a major differentiator. "Upload 3 photos from your camera roll → AI picks the best one and explains why." For your user (guys trying to look better), this is directly actionable. Gate it behind Pro. Build it as a new page: `client/src/pages/TinderMaxx.jsx`.

### 4. Color Season Analysis — MEDIUM PRIORITY
RateByFresh has this and it's beloved by female users (and increasingly male). "You're an Autumn — wear earth tones, deep greens, burnt oranges. Avoid pastels." This is a one-time Claude API call based on skin tone and hair color extracted from the scan. Add it as a new pillar card on Results. Gate advanced breakdown behind Pro.

### 5. Fragrance Recommendation Module — LOW PRIORITY
RateByFresh includes it and it drives affiliate revenue. Based on your style pillar and personality profile, recommend 3 fragrances with affiliate links. Low dev effort, passive revenue.

### 6. Body Subscore Breakdown — MEDIUM PRIORITY  
Right now body analysis exists but it's thin. RateByFresh and Umax both do front + side physique photos with muscle symmetry analysis. Your scan flow already accepts a body photo (`bodyPhoto` field in scan.js) but the analysis seems minimal. Expand this: body fat estimate, shoulder-to-waist ratio, posture grade from side photo.

### 7. Voice Confidence Score — LOW-MEDIUM PRIORITY
Umax's voice coach is genuinely unique. A "Record 30 seconds of yourself speaking → get a score for pitch, pace, filler words, and confidence" feature would add a new dimension nobody else covers well. Uses the Web Speech API + Claude analysis. Gate behind Pro.

---

## What to Build First (Priority Order)

1. **Fix the 5 bugs above** — especially Bug 2 (wrong delta) and Bug 3 (fake scores). These hurt credibility.
2. **PSL Scale Toggle** — 1–2 days of work, high community appeal, zero new AI costs.
3. **Unhide the PSL metric breakdown** — You're already calculating canthalTilt, jawDefinition, hunterEyes, etc. Surface these on the Results page as expandable cards. This alone makes Ascendus the most detailed analysis app in the space.
4. **AI Transformation image** — This is your biggest conversion lever. Build it.
5. **Dating Photo Optimizer** — High value, unique enough, drives Pro upgrades.
6. **Color Season Analysis** — Opens the female market.

---

## Ascendus Strengths to Double Down On

- **HairMaxx is genuinely unique** — make sure it's prominently discoverable in the UI, not buried
- **The PSL metric suite in analysis.js is your secret weapon** — surface it properly and you leapfrog every competitor on depth
- **The score reveal animation** is the best in the space — keep it, maybe add haptics on iOS
- **Gold dark aesthetic** is a strong brand moat — don't dilute it with "modern" redesigns

---

*Generated: June 2026 | Sources: App Store listings, competitor review sites, direct codebase audit*
