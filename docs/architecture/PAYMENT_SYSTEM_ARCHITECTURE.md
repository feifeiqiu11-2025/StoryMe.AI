# Payment System Architecture - Defense-in-Depth

## 🎯 Overview

This document describes the comprehensive, multi-layered approach to handling Stripe payments and subscriptions with zero data corruption and no payment failures.

## 🛡️ Defense-in-Depth Layers

### Layer 1: Database Constraints ✅
**Location:** `supabase/migrations/20251023000002_create_subscriptions_table.sql`

```sql
stripe_subscription_id TEXT UNIQUE
```

**Purpose:** Database-level enforcement - impossible to insert duplicate subscription IDs
**Protection Against:** Application bugs, race conditions
**Impact:** Hard failure if violated - PostgreSQL throws error

---

### Layer 2: Upsert with Conflict Resolution ✅
**Location:** `storyme-app/src/app/api/webhooks/stripe/route.ts:277-280`

```typescript
.upsert(subscriptionData, {
  onConflict: 'stripe_subscription_id',  // Prevent duplicates
  ignoreDuplicates: false  // Update existing record
})
```

**Purpose:** Application-level duplicate prevention
**Protection Against:** Multiple webhooks for same subscription
**Impact:** Updates existing record instead of creating duplicate

---

### Layer 3: Database Trigger Protection ✅
**Location:** `supabase/migrations/20251029000001_fix_subscription_sync_trigger.sql`

```sql
billing_cycle_start = CASE
  WHEN NEW.current_period_start IS NOT NULL THEN NEW.current_period_start
  ELSE billing_cycle_start  -- Keep existing value if new is NULL
END
```

**Purpose:** Prevent good data from being overwritten with NULL
**Protection Against:** Webhooks with incomplete data
**Impact:** Preserves data integrity even if bad webhook fires

---

### Layer 4: Smart Data Quality Check ✅ NEW!
**Location:** `storyme-app/src/app/api/webhooks/stripe/route.ts:219-246`

```typescript
// Check if existing subscription has better data
const hasValidDates = subscription.current_period_start && subscription.current_period_end;
const existingHasValidDates = existingSubscription?.current_period_start;

// Skip update if downgrading data quality
if (existingSubscription && existingHasValidDates && !hasValidDates) {
  console.log('Skipping - existing record has better data');
  return;
}
```

**Purpose:** Only update if new data is equal or better quality
**Protection Against:** Late-arriving webhooks with NULL dates overwriting good data
**Impact:** Prevents data quality degradation

**Example Scenario:**
```
T+0s:  Webhook 1 → status: incomplete, dates: NULL (skipped, no existing record)
T+1s:  Webhook 2 → status: active, dates: VALID (inserted)
T+2s:  Webhook 3 → status: active, dates: NULL (BLOCKED by Layer 4!)
```

---

### Layer 5: Webhook Idempotency ✅ NEW!
**Location:** `storyme-app/src/app/api/webhooks/stripe/route.ts:50-75`

```typescript
// Check if event already processed
const { data: existingEvent } = await supabaseAdmin
  .from('webhook_events')
  .select('id, processed_at')
  .eq('stripe_event_id', event.id)
  .single();

if (existingEvent) {
  return NextResponse.json({ skipped: true });
}

// Record processing
await supabaseAdmin
  .from('webhook_events')
  .insert({ stripe_event_id: event.id, ... });
```

**Purpose:** Prevent processing the same Stripe event twice
**Protection Against:** Stripe retries due to timeout, network issues
**Impact:** Each event processes exactly once

**Stripe's Behavior:**
- If webhook doesn't return 200 within ~30s, Stripe retries
- Retry schedule: immediate, 1h, 3h, 6h, 12h, 24h
- Without idempotency: Could process same payment 7 times!

**Our Solution:**
- Track every event ID in `webhook_events` table
- Check before processing
- Auto-cleanup after 30 days

---

## 📊 Complete Payment Flow

```
User clicks "Upgrade to Basic"
│
├─ Frontend: /api/create-checkout-session
│  └─ Creates Stripe Checkout with metadata: {user_id, tier}
│
├─ User pays on Stripe Checkout
│
├─ Stripe fires webhooks (parallel, within 1-4 seconds):
│  ├─ checkout.session.completed
│  ├─ customer.subscription.created
│  ├─ customer.subscription.updated
│  └─ invoice.payment_succeeded
│
├─ Each webhook hits /api/webhooks/stripe
│  │
│  ├─ Layer 5: Check event.id in webhook_events
│  │  └─ If exists: Return 200 OK (skip)
│  │  └─ If new: Record and continue
│  │
│  ├─ Process subscription update
│  │  │
│  │  ├─ Update users table (subscription_tier, status, etc.)
│  │  │
│  │  └─ Update subscriptions table:
│  │     ├─ Layer 4: Check data quality
│  │     │  └─ Skip if downgrade
│  │     │
│  │     ├─ Layer 2: Upsert with onConflict
│  │     │  └─ Update existing or insert new
│  │     │
│  │     ├─ Layer 1: Database UNIQUE constraint
│  │     │  └─ Hard block duplicates
│  │     │
│  │     └─ Layer 3: Trigger protects NULL overwrites
│  │        └─ Syncs to users table safely
│  │
│  └─ Mark event as success in webhook_events
│
├─ User redirected to success page
│
└─ Success page: /api/verify-payment (fallback)
   └─ Checks Stripe directly if webhook delayed
```

---

## 🔬 Testing Each Layer

### Test Layer 1: Database Constraint
```sql
-- Try to insert duplicate (should fail)
INSERT INTO subscriptions (stripe_subscription_id, user_id, tier, status)
VALUES ('sub_TEST123', 'user-id', 'basic', 'active');

INSERT INTO subscriptions (stripe_subscription_id, user_id, tier, status)
VALUES ('sub_TEST123', 'user-id', 'basic', 'active');
-- Error: duplicate key value violates unique constraint
```

### Test Layer 2: Upsert
```typescript
// First upsert - creates record
await supabase.from('subscriptions').upsert({
  stripe_subscription_id: 'sub_TEST',
  tier: 'basic'
}, { onConflict: 'stripe_subscription_id' });

// Second upsert - updates record (no duplicate)
await supabase.from('subscriptions').upsert({
  stripe_subscription_id: 'sub_TEST',
  tier: 'premium'  // Updated!
}, { onConflict: 'stripe_subscription_id' });
```

### Test Layer 3: Trigger Protection
```sql
-- Insert good data
INSERT INTO subscriptions (stripe_subscription_id, current_period_start)
VALUES ('sub_TEST', '2025-10-29');

-- Try to update with NULL (should keep existing value)
UPDATE subscriptions
SET current_period_start = NULL
WHERE stripe_subscription_id = 'sub_TEST';

-- Check: should still be '2025-10-29'
SELECT current_period_start FROM subscriptions
WHERE stripe_subscription_id = 'sub_TEST';
```

### Test Layer 4: Data Quality Check
Simulate webhooks arriving out of order:
```
1. Send webhook with valid dates → Inserted
2. Send webhook with NULL dates → Blocked (logged)
3. Check logs for "Skipping - existing record has better data"
```

### Test Layer 5: Idempotency
```
1. Send same Stripe event twice
2. First processes normally
3. Second returns { skipped: true }
4. Check webhook_events table has 1 record
```

---

## 📈 Monitoring & Debugging

### Key Metrics to Track

**In Supabase:**
```sql
-- Count duplicate prevention (should be 0)
SELECT COUNT(*) - COUNT(DISTINCT stripe_subscription_id) as duplicates
FROM subscriptions;

-- Recent webhook processing
SELECT event_type, success, COUNT(*)
FROM webhook_events
WHERE processed_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, success;

-- Failed webhooks
SELECT * FROM webhook_events
WHERE success = false
ORDER BY processed_at DESC
LIMIT 10;
```

**In Stripe Dashboard:**
- Go to Developers → Webhooks
- Check for failed webhooks (red X)
- Response times should be < 5 seconds

### Debug Checklist

**If payment doesn't go through:**

1. **Check Stripe Dashboard**
   - Did customer pay? Check "Payments" tab
   - Is subscription active? Check "Subscriptions" tab
   - Did webhooks fire? Check "Developers → Events"
   - Did webhooks succeed? Check "Developers → Webhooks"

2. **Check webhook_events table**
   ```sql
   SELECT * FROM webhook_events
   WHERE stripe_subscription_id = 'sub_XXX'
   ORDER BY processed_at DESC;
   ```
   - Are events recorded?
   - Did any fail (success = false)?
   - Check error_message

3. **Check subscriptions table**
   ```sql
   SELECT * FROM subscriptions
   WHERE stripe_subscription_id = 'sub_XXX';
   ```
   - How many records? (should be 1)
   - Does it have valid dates?
   - Is status correct?

4. **Check users table**
   ```sql
   SELECT subscription_tier, subscription_status, billing_cycle_start
   FROM users
   WHERE stripe_subscription_id = 'sub_XXX';
   ```
   - Does tier match Stripe?
   - Is billing_cycle_start set?

---

## 🚨 Edge Cases Handled

### ✅ Webhooks arrive out of order
- **Layer 4** ensures we don't downgrade data quality
- **Layer 3** ensures trigger doesn't overwrite with NULL

### ✅ Webhook fires twice (Stripe retry)
- **Layer 5** idempotency check prevents duplicate processing

### ✅ Multiple subscriptions for same user (normal)
- Each subscription has unique ID
- All layers work per subscription_id

### ✅ User upgrades/downgrades
- New subscription ID created by Stripe
- Old subscription marked cancelled
- Both stored separately

### ✅ Payment fails then succeeds
- First webhook: status = 'incomplete'
- Second webhook: status = 'active'
- Layer 4 allows upgrade from incomplete to active

### ✅ Subscription cancelled then renewed
- Old subscription: cancelled_at set
- New subscription: new ID, fresh start
- Both maintained in history

---

## 📋 Migration Checklist

When deploying this system:

- [x] Run Migration 1: Fix trigger to not overwrite with NULL
- [x] Run Migration 2: Clean up existing duplicates
- [ ] Run Migration 3: Create webhook_events table
- [ ] Deploy code changes
- [ ] Monitor webhook_events table for first week
- [ ] Set up alerting for failed webhooks

---

## 🎓 Key Learnings

### Why Multiple Layers?

**Single point of failure is risky:**
- If only database constraint: Application might retry infinitely
- If only upsert: Might still create duplicates under race conditions
- If only idempotency: Doesn't prevent data quality issues

**Defense-in-depth means:**
- Each layer catches different failure modes
- Layers complement each other
- System degrades gracefully
- Easy to debug (clear logs at each layer)

### Why Layer 4 (Data Quality) is Critical

Without it:
```
T+1s: Webhook → {status: 'active', dates: '2025-10-29'} ✓ GOOD
T+2s: Webhook → {status: 'active', dates: NULL} ✗ OVERWRITES!
```

With it:
```
T+1s: Webhook → {status: 'active', dates: '2025-10-29'} ✓ GOOD
T+2s: Webhook → {status: 'active', dates: NULL} → BLOCKED ✓
```

### Why Layer 5 (Idempotency) is Critical

Stripe retries aggressively if no 200 response:
- Network timeout → Retry
- Server restart during processing → Retry
- Load balancer issue → Retry

Without idempotency:
- User charged once
- Webhook processes 3 times
- Stories_created_this_month reset 3 times
- User confused

With idempotency:
- User charged once
- Webhook processes once
- Subsequent retries return 200 (skipped)
- Perfect user experience

---

## 🔮 Future Enhancements

### Optional Improvements

1. **Rate limiting** on webhook endpoint
2. **Webhook signature caching** (reduce Stripe API calls)
3. **Dead letter queue** for permanently failed webhooks
4. **Real-time alerting** for payment failures
5. **Automatic reconciliation** job (compare Stripe vs DB daily)

### Monitoring Dashboard

Build internal dashboard showing:
- Payment success rate (last 24h, 7d, 30d)
- Average webhook processing time
- Failed webhooks by type
- Duplicate prevention hits (Layer 4 blocks)
- Idempotency hits (Layer 5 blocks)

---

## 📞 Support

If you encounter payment issues:

1. Check this document first
2. Run debug queries from "Monitoring & Debugging" section
3. Check Stripe Dashboard events
4. Review webhook_events table for errors

**This system is designed to be self-healing and transparent.**
