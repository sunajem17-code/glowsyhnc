# Temporary ratings unlock

The Reveal Ratings button calls an authenticated, rate-limited server route.
It never accepts a user ID or premium status from the client. Both developer
and paid unlocks use the existing results success flow and existing scan ID.

## Enable for the test account

Deploy the server changes, then set Railway variables:

- `DEV_UNLOCK_ENABLED=true`
- `DEV_UNLOCK_USER_IDS`: comma-separated IDs from the custom users table.

Only list accounts you own for testing. Missing configuration denies access.
No promo code or secret is embedded in the app. Users must be signed in.
The grant sets the same stored premium fields as a verified purchase; it is
not a subscription and does not bill the user. Removing the button or disabling
the route does not revoke an already granted account's premium access. Reset
that test account's premium fields separately, only after checking it has no
actual paid entitlement.

For this temporary phone build, `VITE_DEV_UNLOCK_BUTTON=true` shows the button
before server setup. This flag only controls visibility, never authorization.
Normal builds hide it unless the server authorizes the account. Local Vite
development shows it as well. Unauthorized requests display an error.

## Remove

Set `DEV_UNLOCK_ENABLED=false`, remove the developer route mount, its file and
tests, the two developer API methods, and the developer button/state/handler
from ScanUnlockGate. Remove the build flag. No database schema was added.

## Free trial

The exit offer uses the current RevenueCat offering. Apple must report an
eligible zero-price intro lasting exactly seven days. The offer shows the
localized recurring price and period, and rechecks eligibility before purchase.
It never falls back to the discounted annual product. Without an eligible
product the CTA is disabled; it does not claim a chargeable offer is free.
