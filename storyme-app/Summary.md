# Changes Summary - November 20, 2025

## FREE Tier Story Limit Change (5 → 2)

Reduced the free trial story limit from 5 to 2 stories across all files:

### Files Updated:

1. **`src/lib/subscription/utils.ts`** (line 85)
   - Display text: "Up to 5 stories" → "Up to 2 stories"

2. **`src/components/pricing/PricingCards.tsx`** (lines 30, 32)
   - "5 stories total" → "2 stories total"
   - "5 stories to create" → "2 stories to create"

3. **`src/app/(marketing)/terms/page.tsx`** (line 117)
   - "Limit: Up to 5 stories total" → "Limit: Up to 2 stories total"

4. **`src/app/api/webhooks/stripe/route.ts`** (lines 178, 356)
   - Backend logic: `storiesLimit = 5` → `storiesLimit = 2` (default for free tier)
   - Subscription deleted handler: `stories_limit: 5` → `stories_limit: 2`

5. **`src/app/api/verify-payment/route.ts`** (line 79)
   - Backend logic: `storiesLimit = 5` → `storiesLimit = 2` (default for free tier)

6. **`src/app/(auth)/signup/page.tsx`** (line 275)
   - "Create up to 50 story images (including regenerations)" → "Create up to 2 stories"

## Notes:
- Only affects NEW users signing up
- Existing users retain their current limits
- Both display text and backend logic updated for consistency
