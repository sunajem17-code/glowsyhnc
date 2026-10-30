# Practical appearance feedback — research and implementation

Reviewed 30 October 2026. Scope: results-page feedback and its photo refresh, not the numerical scoring formula or onboarding.

## Research decisions

Community discussions are useful for identifying repeated frustrations, not diagnosing a person or validating a treatment. These threads were reviewed:

- [Dark circles despite good sleep and exercise](https://www.reddit.com/r/SkincareAddiction/comments/1gqkq4b/routine_help_dark_circles_around_eyes_25m/): do not default to “sleep more” or assume a single cause.
- [Persistent circles despite niacinamide and caffeine](https://www.reddit.com/r/SkincareAddicts/comments/1ngn4du/ive_had_dark_circles_under_my_eyes_for_more_than/): no promise that another cream fixes hollows or shadows. Claims about supplements, hormones and allergy treatment were not adopted.
- [Recovery after over-exfoliation](https://www.reddit.com/r/SkincareAddiction/comments/te7es1/misc_how_i_recovered_my_seriously_over_exfoliated/): keep plans manageable; do not stack actives or repeat a commenter’s treatment regimen.
- [Grooming advice discussion](https://www.reddit.com/r/malegrooming/comments/1s7nm65/any_advice_on_how_to_improve_my_appearance/): prefer specific, reversible styling choices over generic “just work out” advice. Community suggestions are aesthetic preferences, not medical facts.

Clinical/professional sources used for the curated in-app guides:

- [DermNet — dark circles](https://dermnetnz.org/topics/dark-circles-under-the-eyes): multiple possible causes; a photo cannot reliably distinguish them. The guide starts with matched lighting and realistic treatment limits.
- [Mayo Clinic — bags under eyes](https://www.mayoclinic.org/diseases-conditions/bags-under-eyes/diagnosis-treatment/drc-20369931): gentle cool-compress self-care, realistic limits, symptom-based escalation.
- [American Academy of Dermatology — acne care](https://www.aad.org/public/diseases/acne/skin-care/tips): gentle care, consistency, avoiding picking, sunscreen, and professional help for persistent problems.
- [American Academy of Dermatology — razor bumps](https://www.aad.org/news/how-to-prevent-razor-bumps): shaving technique and irritation reduction, not diagnosis from a selfie.
- [American Association of Orthodontists — mewing](https://aaoinfo.org/whats-trending/is-mewing-bad-for-you/): no promised jaw-bone changes from exercises or forced pressure.
- [Barber guidance — useful haircut references](https://www.highgate-cuts.co.uk/blog/post/haircut-reference-photos): comparable hair texture, more than one view, and realistic maintenance. This is professional style advice, not clinical evidence.

## Product behavior

The default tab is “Your plan,” with “Strengths” available beside it. Each supported opportunity gives a specific observation and first step. Expandable guides show ordered instructions, frequency, realistic expectations, limits and verified source links. Additional model-generated actions are displayed rather than discarded.

The model chooses from six curated topic IDs only when the observed concern fits. It does not invent source URLs. Guidance distinguishes shadows from puffiness, surface care from anatomy, and reversible styling from treatment. No score gains, guarantees, shame, mandatory purchases or inferred need to lose weight.

Photo quality is assessed before findings. A retake-quality photo returns capture advice without facial criticisms or products. Limited photos only support visible findings. The UI does not mix legacy score bullets into a fresh analysis; older structured notes are explicitly labelled and collapsed.

## Reliability changes

- If a private storage transform fails, retry the same owner-checked original image, retaining MIME/size bounds.
- A valid device copy can recover a missing/unavailable cloud photo. Device-only scans are analyzed without inventing server ownership or writing over another record.
- Device-supplied scores are no longer accepted as evidence in this fallback.
- Failed requests leave saved scans intact; retry controls do not consume half the screen.
- Requests are deduplicated by user and scan. Successful results persist even when the panel unmounts, with account-change protection.
- Structured v13 cache invalidation refreshes older non-actionable feedback.
- Failures log a safe code/status, never photos or tokens. Earlier production responses swallowed the cause, so the precise reason for the screenshot’s original failure cannot be proven from those logs alone.

## Verification

87 targeted tests passed, including the existing onboarding/lifecycle suite, provider contracts, photo recovery and owner boundaries, retry, persisted feedback, curated guides, retake suppression and rendered UI. Existing server test timers require Node’s test-force-exit after tests finish. No production timer behavior was changed.

A local browser fixture using the real React component and mocked network response was checked through failure → retry → success → expanded instructions/source link. This is UI verification, not a claim that the fixture’s observation came from a real personal scan.

The active production domain is glowsyhnc-production-e16b.up.railway.app in the Ascendus service. Its health endpoint returned 200. A separate old Railway service is crashed due to missing PROMO_CODE; it is not the domain bundled into this iOS app and was left unchanged.
