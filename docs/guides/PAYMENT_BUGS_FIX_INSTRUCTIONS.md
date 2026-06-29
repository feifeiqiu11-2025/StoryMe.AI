# Payment & Subscription Bugs - Fix Instructions

## Summary of Issues Fixed

### Issue #1: Profile Shows Trial Info After Upgrade ✅ FIXED
**Root Cause:** `trial_ends_at` was never cleared when users upgraded to paid tiers

**Files Fixed:**
- `storyme-app/src/app/api/webhooks/stripe/route.ts` (lines 162-167)
- `storyme-app/src/app/api/verify-payment/route.ts` (lines 99-100)

### Issue #2: billing_cycle_start is NULL ✅ FIXED
**Root Cause Chain:**
1. Webhook `upsert()` missing `onConflict` parameter → Created duplicate subscriptions
2. Multiple webhooks fired with NULL dates → Last one overwrote good data
3. Database trigger set `billing_cycle_start = NULL` from bad subscription record

**Files Fixed:**
- `storyme-app/src/app/api/webhooks/stripe/route.ts` (lines 239-244) - Added `onConflict`
- `supabase/migrations/20251029000001_fix_subscription_sync_trigger.sql` - Fixed trigger to not overwrite with NULL
- `supabase/migrations/20251029000002_cleanup_duplicate_subscriptions.sql` - Cleanup data

---

## Code Changes Applied

### 1. Webhook Handler (`storyme-app/src/app/api/webhooks/stripe/route.ts`)

**Change 1.1: Clear trial_ends_at for paid users**
```typescript
// Lines 162-167
// If user has a paid subscription, mark trial as completed and clear trial_ends_at
// Trial is one-time only - once completed, it stays completed even if user cancels and resubscribes
if (tier && tier !== 'free') {
  userUpdateData.trial_status = 'completed';
  userUpdateData.trial_ends_at = null;  // Clear trial end date for paid users
}
```

**Change 1.2: Fix upsert to prevent duplicates**
```typescript
// Lines 239-244
const { error: subError } = await supabaseAdmin
  .from('subscriptions')
  .upsert(subscriptionData, {
    onConflict: 'stripe_subscription_id',  // Prevent duplicate subscriptions
    ignoreDuplicates: false  // Update existing record on conflict
  });
```

**Change 1.3: Clear billing_cycle_start on cancellation**
```typescript
// Lines 271-281
// Revert user to free tier (no new trial - trial is one-time only)
const { error: userError } = await supabaseAdmin
  .from('users')
  .update({
    subscription_tier: 'free',
    subscription_status: 'cancelled',
    stories_limit: 5,
    stripe_subscription_id: null,
    billing_cycle_start: null,  // No longer on a billing cycle
    // Keep trial_ends_at and trial_status as-is (trial was already used)
  })
  .eq('id', userId);
```

### 2. Verify Payment API (`storyme-app/src/app/api/verify-payment/route.ts`)

**Change 2.1: Use actual period start and clear trial**
```typescript
// Lines 82-100
// Get actual period start from subscription object
const subscriptionObj = session.subscription as Stripe.Subscription;
const periodStart = subscriptionObj?.current_period_start
  ? new Date(subscriptionObj.current_period_start * 1000).toISOString()
  : new Date().toISOString(); // Fallback to now if not available

const { error: updateError } = await supabase
  .from('users')
  .update({
    subscription_tier: subscriptionTier,
    subscription_status: subscriptionStatus,
    stories_limit: storiesLimit,
    stripe_subscription_id: subscriptionObj?.id || session.subscription as string,
    stripe_customer_id: session.customer as string,
    billing_cycle_start: periodStart,  // Use actual period start from Stripe
    stories_created_this_month: 0,
    trial_status: 'completed',
    trial_ends_at: null,  // Clear trial end date for paid users
  })
  .eq('id', user.id);
```

---

## Database Migrations to Apply

### Step 1: Apply Trigger Fix

**File:** `supabase/migrations/20251029000001_fix_subscription_sync_trigger.sql`

**Instructions:**
1. Go to Supabase Dashboard: https://app.supabase.com/project/qxeiajnmprinwydlozlq
2. Navigate to SQL Editor
3. Copy and paste the entire contents of `20251029000001_fix_subscription_sync_trigger.sql`
4. Click "Run" to execute

**What this does:**
- Updates the `sync_subscription_to_user()` trigger function
- Prevents `billing_cycle_start` from being overwritten with NULL values
- Protects against webhook race conditions

### Step 2: Clean Up Duplicate Data

**File:** `supabase/migrations/20251029000002_cleanup_duplicate_subscriptions.sql`

**Instructions:**
1. In Supabase SQL Editor
2. Copy and paste the entire contents of `20251029000002_cleanup_duplicate_subscriptions.sql`
3. Click "Run" to execute

**What this does:**
- Deletes 2 duplicate subscription records for kindlewoodsai@gmail.com
- Fixes the user's `trial_ends_at` (sets to NULL)
- Fixes the user's `billing_cycle_start` (sets to correct date)
- Verifies no other duplicates exist

---

## Verification Steps

After applying all fixes, verify the changes:

### 1. Check User Data
```sql
SELECT
  id,
  email,
  subscription_tier,
  subscription_status,
  trial_ends_at,  -- Should be NULL for paid users
  trial_status,   -- Should be 'completed'
  billing_cycle_start,  -- Should have a valid date
  stories_limit,  -- Should be 20 for basic tier
  stripe_subscription_id
FROM users
WHERE email = 'kindlewoodsai@gmail.com';
```

**Expected Results:**
- `trial_ends_at`: NULL (was: 2025-11-05 17:25:55.544)
- `billing_cycle_start`: 2025-10-29 17:42:56 (was: NULL)
- All other fields should remain the same

### 2. Check Subscription Records
```sql
SELECT
  id,
  stripe_subscription_id,
  status,
  current_period_start,
  current_period_end
FROM subscriptions
WHERE stripe_subscription_id = 'sub_1SNdOeAg7OQqrjiWAtFXxvPs';
```

**Expected Results:**
- Only 1 record should exist (id: d1d96e56-1062-49d9-84ef-67cbcadb1784)
- `status`: 'active'
- `current_period_start` and `current_period_end` should have valid dates

### 3. Test User Profile UI
1. Log in as kindlewoodsai@gmail.com
2. Click on profile menu in top right
3. **Expected:** Should show "Premium Member" or "Basic Member" (NOT "Free Trial")
4. Should NOT show trial countdown timer

---

## Deployment Steps

### 1. Apply Database Migrations (Do This First!)
- Apply `20251029000001_fix_subscription_sync_trigger.sql` in Supabase SQL Editor
- Apply `20251029000002_cleanup_duplicate_subscriptions.sql` in Supabase SQL Editor

### 2. Deploy Code Changes
```bash
# Commit and push changes
git add .
git commit -m "Fix payment bugs: clear trial_ends_at and prevent duplicate subscriptions"
git push
```

Vercel will automatically deploy the changes to production.

### 3. Monitor Webhooks
After deployment, monitor Stripe webhook logs to ensure:
- No duplicate subscription records are created
- `billing_cycle_start` is always set correctly
- `trial_ends_at` is cleared for paid users

---

## Business Logic Clarified

### Subscription Lifecycle
1. **New user** → Gets 7-day free trial (subscription_tier = 'free')
2. **User upgrades** → Becomes paid subscriber, trial ends permanently
   - `trial_ends_at` → NULL
   - `trial_status` → 'completed'
   - `billing_cycle_start` → Set to subscription period start
3. **User cancels** → Reverts to free tier, NO new trial
   - `subscription_tier` → 'free'
   - `billing_cycle_start` → NULL
   - `trial_ends_at` and `trial_status` → Remain as-is (trial was already used)
4. **User re-subscribes** → Goes directly to paid tier (no new trial)

**Key Point:** Trial is one-time only per user, forever.

---

## Edge Cases Handled

✅ Multiple webhooks firing simultaneously → `onConflict` prevents duplicates
✅ Webhook sends NULL dates → Trigger keeps existing values
✅ User cancels and resubscribes → No new trial, goes directly to paid
✅ Payment processing (incomplete status) → Still clears trial
✅ Race condition between webhook and verify-payment → Both set same values (idempotent)

---

## Files Changed

### Code Files
1. `storyme-app/src/app/api/webhooks/stripe/route.ts`
2. `storyme-app/src/app/api/verify-payment/route.ts`

### Database Migrations
1. `supabase/migrations/20251029000001_fix_subscription_sync_trigger.sql`
2. `supabase/migrations/20251029000002_cleanup_duplicate_subscriptions.sql`
3. `supabase/migrations/20251029000003_create_webhook_events_table.sql`
4. `supabase/migrations/20251029000004_add_missing_subscription_markfaye.sql`

### Documentation
1. `PAYMENT_BUGS_FIX_INSTRUCTIONS.md` (this file)
2. `PAYMENT_SYSTEM_ARCHITECTURE.md` (comprehensive architecture document)

---

## Questions or Issues?

If you encounter any issues after applying these fixes:
1. Check Supabase logs for any migration errors
2. Check Stripe webhook logs for any failed webhooks
3. Verify user data with the SQL queries above
4. Check browser console for any frontend errors

All fixes have been systematically reviewed for edge cases and regressions.
