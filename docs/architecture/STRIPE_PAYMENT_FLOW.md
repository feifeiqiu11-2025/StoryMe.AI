# Stripe Payment Flow & Status Handling

## Complete Payment Flow

### 1. User Initiates Subscription
**File**: `src/app/(dashboard)/upgrade/page.tsx`

User clicks "Choose Basic/Premium/Team" button:
```typescript
handleSelectPlan('basic', 'monthly')
```

### 2. Create Checkout Session
**API**: `/api/change-subscription` or `/api/create-checkout-session`

```typescript
// Creates Stripe Checkout Session
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `/upgrade?canceled=true`,
  metadata: { supabase_user_id, tier, cycle }
});

// Redirects user to Stripe Checkout
window.location.href = session.url;
```

### 3. User Completes Payment at Stripe
**Hosted by**: Stripe Checkout page

User enters payment details and confirms.

**Possible Outcomes**:
- ✓ **Success**: Payment completes immediately → redirects to success_url
- ⏳ **Requires Action**: 3D Secure authentication → may redirect to success_url with `incomplete` status
- ✗ **Declined**: Payment fails → user stays on Stripe page to retry
- ✗ **Canceled**: User clicks back → redirects to cancel_url

### 4. Stripe Sends Webhooks (Background)
**API**: `/api/webhooks/stripe`

Stripe fires these events (usually within 1-5 seconds):

1. **`checkout.session.completed`** - Checkout completed
2. **`customer.subscription.created`** - Subscription created
3. **`customer.subscription.updated`** - Subscription status updated
4. **`invoice.payment_succeeded`** - First payment succeeded

**What the webhook does**:
```typescript
// Updates users table
UPDATE users SET
  subscription_tier = 'basic',          // from metadata
  subscription_status = 'active',       // or 'incomplete' if payment pending
  stories_limit = 20,                   // based on tier
  stories_created_this_month = 0,       // RESET count for new subscription
  stripe_subscription_id = sub_xxx,
  stripe_customer_id = cus_xxx,
  billing_cycle_start = now()
WHERE id = user_id;
```

### 5. User Returns to Success URL
**Page**: `/upgrade?success=true&session_id=cs_xxx`

The upgrade page:
1. **Detects success parameter** in URL
2. **Calls verification API** to check payment status
3. **Shows status message** to user
4. **Auto-reloads** after confirmation

```typescript
// Verify payment completed
const response = await fetch(`/api/verify-payment?session_id=${sessionId}`);
const data = await response.json();

if (data.payment.isComplete) {
  // Show success message
  // Reload page after 2 seconds
  setTimeout(() => window.location.href = '/upgrade', 2000);
} else if (data.payment.status === 'incomplete') {
  // Payment pending - show processing message
  // Retry after 3 seconds
  setTimeout(() => window.location.reload(), 3000);
}
```

### 6. Payment Verification Fallback
**API**: `/api/verify-payment?session_id=cs_xxx`

**Why needed?** Webhooks may be delayed or fail. This API:
- Retrieves session from Stripe directly
- Checks payment_status and session.status
- Updates database if webhook hasn't fired yet
- Returns clear status to frontend

```typescript
const session = await stripe.checkout.sessions.retrieve(sessionId);

if (session.payment_status === 'paid' && session.status === 'complete') {
  // Payment successful - update database if not already done
  await supabase.from('users').update({
    subscription_tier: tier,
    subscription_status: 'active',
    stories_created_this_month: 0,
    // ...
  });
}
```

---

## Subscription Status Values

### Stripe Subscription Status
| Status | Meaning | Can Create Stories? |
|--------|---------|---------------------|
| `active` | Payment successful, subscription active | ✓ Yes |
| `trialing` | Free trial period | ✓ Yes |
| `incomplete` | Payment requires action or processing | ✓ Yes (for paid tiers) |
| `incomplete_expired` | Payment failed after 23 hours | ✗ No |
| `past_due` | Payment failed, retrying | ⚠️ Grace period |
| `canceled` | Subscription canceled | ✗ No |
| `unpaid` | Payment failed after retries | ✗ No |

### Why Allow 'incomplete' Status?

When a user subscribes, the status may be `incomplete` for valid reasons:
1. **3D Secure Authentication** - User completed checkout but bank requires additional verification
2. **ACH/SEPA Payments** - Bank transfers take 3-5 business days to clear
3. **Payment Processing** - Stripe is processing the payment (usually < 1 minute)

**Our Solution**: Allow story creation for paid tiers with `incomplete` status, but webhook will update to `active` once payment confirms.

---

## How We Prevent the "0/20 but Blocked" Bug

### Problem
User subscribes to Basic (20 stories/month) but sees:
- "Stories This Month: 0 / 20"  ← Correct
- "Story Limit Reached" ← **BUG!**

### Root Causes Fixed

#### 1. ✓ Allow 'incomplete' Status
**File**: `src/lib/subscription/middleware.ts:56-82`

```typescript
// OLD - blocked incomplete
if (subscription_status !== 'active' && subscription_status !== 'trialing') {
  return { canCreate: false };
}

// NEW - allow incomplete for paid tiers
const allowedStatuses = ['active', 'trialing', 'incomplete'];
const isPaidTier = tier === 'basic' || tier === 'premium' || tier === 'team';

if (!allowedStatuses.includes(subscription_status)) {
  return { canCreate: false };
}

if (subscription_status === 'incomplete' && !isPaidTier) {
  return { canCreate: false, reason: 'Payment processing...' };
}
```

#### 2. ✓ Reset Story Count on Subscription Change
**File**: `src/app/api/webhooks/stripe/route.ts:169-189`

```typescript
// Reset count when:
const isNewSubscription = !currentUser?.billing_cycle_start;
const tierChanged = currentUser?.subscription_tier !== tier;
const billingCycleChanged = /* new billing month */;

if (isNewSubscription || billingCycleChanged || tierChanged) {
  userUpdateData.stories_created_this_month = 0; // RESET
}
```

**Why?** Prevents trial usage (5/5) from blocking new Basic subscription (5/20).

#### 3. ✓ Auto-Reset on Billing Cycle
**File**: `src/lib/subscription/middleware.ts:53-76`

```typescript
// Check if billing cycle passed (30+ days)
if (daysSinceBillingStart >= 30 && stories_created_this_month > 0) {
  // Auto-reset count
  await supabase.from('users').update({
    stories_created_this_month: 0,
    billing_cycle_start: now()
  });
}
```

**Why?** Safety net if Stripe webhooks fail to reset monthly count.

#### 4. ✓ Payment Verification API
**File**: `src/app/api/verify-payment/route.ts`

```typescript
// Fallback: Check Stripe directly if webhook delayed
const session = await stripe.checkout.sessions.retrieve(sessionId);

if (session.payment_status === 'paid' && userData.tier !== newTier) {
  // Webhook delayed - update database now
  await supabase.from('users').update({ ... });
}
```

**Why?** Ensures user can create stories immediately, even if webhook takes 30 seconds.

---

## User Experience Flow

### Happy Path (Payment Succeeds)
1. User clicks "Choose Basic" → redirected to Stripe
2. User enters payment → payment succeeds immediately
3. Stripe redirects to `/upgrade?success=true&session_id=cs_xxx`
4. Page shows: "✓ Payment successful! Redirecting..."
5. Webhook updates database: `subscription_status='active'`
6. Page auto-reloads → shows "Basic" plan, "0 / 20" stories
7. User creates story ✓

### 3D Secure Flow (Payment Requires Action)
1. User clicks "Choose Basic" → redirected to Stripe
2. User enters payment → bank requires 3D Secure
3. User completes 3D Secure authentication
4. Stripe redirects to `/upgrade?success=true&session_id=cs_xxx`
5. Page shows: "⏳ Payment is being processed..."
6. Verification API checks Stripe: `status='incomplete'`
7. Page auto-retries after 3 seconds
8. Webhook fires: `subscription_status='active'`
9. Verification succeeds → shows success message
10. Page reloads → user can create stories ✓

### Failed Payment Flow
1. User clicks "Choose Basic" → redirected to Stripe
2. User enters payment → payment declined
3. Stripe shows error, user can retry
4. If user clicks back → redirects to `/upgrade?canceled=true`
5. Page shows: "ℹ️ Payment was canceled. You can try again when ready."
6. Auto-redirects to clean `/upgrade` URL after 5 seconds

---

## Testing the Payment Flow

### Test Cards (Stripe Test Mode)
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
Processing delay: 4000 0000 0000 3220
```

### Manual Testing Steps
1. **New Subscription**:
   - Sign up as new user (trial)
   - Go to /upgrade
   - Subscribe to Basic
   - Use test card 4242 4242 4242 4242
   - Verify redirected to success page
   - Check database: `subscription_tier='basic'`, `status='active'`, `stories_created_this_month=0`
   - Create a story → should succeed

2. **3D Secure**:
   - Use card 4000 0025 0000 3155
   - Complete 3D Secure popup
   - Should show "Processing..." then "Success"

3. **Webhook Delay Simulation**:
   - Disable webhook in Stripe dashboard temporarily
   - Subscribe to Basic
   - Verify verification API updates database
   - Re-enable webhook

### Monitoring Webhooks
**Stripe Dashboard** → Developers → Webhooks → View events

Check for:
- ✓ `checkout.session.completed`
- ✓ `customer.subscription.created`
- ✓ `customer.subscription.updated`
- ✓ All showing 200 OK responses

---

## Common Issues & Solutions

### Issue: "Story Limit Reached" with 0/20 stories
**Cause**: `subscription_status='incomplete'`
**Fix**: Already fixed - incomplete status now allowed for paid tiers

### Issue: Webhook not firing
**Causes**:
- Webhook URL not configured in Stripe
- Webhook signature secret mismatch
- Endpoint returning errors

**Check**:
```bash
# View Stripe webhook logs
stripe listen --forward-to localhost:3002/api/webhooks/stripe

# Check webhook endpoint in Stripe dashboard
# Should be: https://your-app.vercel.app/api/webhooks/stripe
```

**Solution**: Verification API serves as fallback

### Issue: Payment succeeds but database not updated
**Cause**: Webhook delay or failure
**Solution**: Verification API updates database immediately

### Issue: Trial count carries over to paid subscription
**Cause**: `stories_created_this_month` not reset
**Fix**: Already fixed - webhook resets count on tier change

---

## Best Practices

### 1. Always Verify Payment Status
Don't rely solely on webhooks - use verification API as fallback.

### 2. Clear User Communication
Show different messages for:
- Payment processing (`incomplete`)
- Payment failed (`past_due`)
- Limit reached (count >= limit)

### 3. Graceful Degradation
If payment pending, allow limited usage rather than blocking completely.

### 4. Detailed Logging
All webhook handlers log with `[WEBHOOK]` prefix for debugging.

### 5. Idempotency
Webhook handlers can be called multiple times - ensure database updates are idempotent.

---

## Security Considerations

### 1. Webhook Signature Verification
**File**: `src/app/api/webhooks/stripe/route.ts:34-46`

```typescript
// ALWAYS verify webhook signature
event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### 2. Session Ownership Verification
**File**: `src/app/api/verify-payment/route.ts:46-51`

```typescript
// ALWAYS verify session belongs to user
if (session.metadata?.supabase_user_id !== user.id) {
  return { error: 'Unauthorized' };
}
```

### 3. Use Metadata for User Linking
Store `supabase_user_id` in:
- Checkout session metadata
- Subscription metadata
- Customer metadata

This ensures webhooks can identify which user to update.

---

## Deployment Checklist

- [ ] Set `STRIPE_WEBHOOK_SECRET` environment variable
- [ ] Configure webhook endpoint in Stripe Dashboard
- [ ] Test with Stripe test mode cards
- [ ] Monitor webhook delivery in Stripe Dashboard
- [ ] Check application logs for `[WEBHOOK]` entries
- [ ] Test success/cancel URLs work correctly
- [ ] Verify payment verification API accessible
- [ ] Test 3D Secure flow
- [ ] Test subscription upgrades/downgrades
- [ ] Test story creation immediately after payment

---

## Support Contact

If users report payment issues:
1. Check Stripe Dashboard → Customers → find by email
2. Check webhook events for that customer
3. Check application logs for `[WEBHOOK]` entries with user ID
4. Verify database state: `users` and `subscriptions` tables
5. Run manual verification: `/api/verify-payment?session_id=xxx`
