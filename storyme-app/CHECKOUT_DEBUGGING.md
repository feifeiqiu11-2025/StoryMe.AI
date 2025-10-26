# Checkout Session Error - Debugging Guide

## ✅ FIXED (2025-10-26) - v2 Improved UX

**Root Cause:** Users could click pricing plans without being logged in, causing the checkout API to return 401 Unauthorized.

**Solution Implemented:**
1. Added authentication check to pricing page before initiating checkout
2. Show friendly confirmation dialog asking users to sign in OR create account
3. Updated login AND signup pages to support redirect back to pricing with plan selection
4. Preserve user's plan selection (tier + billing cycle) throughout the auth flow
5. Better error handling with specific messages for 401 errors

**User Flow:**
1. User (not logged in) clicks pricing plan
2. Browser shows: "🔒 Please sign in to continue - Click OK to sign in, Cancel to create account"
3. User redirected to login or signup with `?redirect=/pricing&plan=basic&cycle=monthly`
4. After auth, user returns to pricing page
5. Checkout proceeds successfully

**Files Modified:**
- `/app/(marketing)/pricing/page.tsx` - Added auth check with friendly dialog, better error handling
- `/app/(auth)/login/page.tsx` - Added support for `?redirect=` query parameter
- `/app/(auth)/signup/page.tsx` - Added support for `?redirect=` query parameter

---

## Problem (Original)
User clicks pricing plan → Gets "Failed to create checkout session" error

## Diagnosis Steps

### 1. Check if user is authenticated

The `/api/create-checkout-session` route requires authentication (lines 14-23).

**Test:**
Open browser console and run:
```javascript
fetch('/api/auth/user').then(r => r.json()).then(console.log)
```

**Expected:** Should return user object with `id` and `email`
**If null/error:** User is not logged in → They need to sign in first!

---

### 2. Check Stripe API Key

The route uses `stripe` object (line 87) which requires `STRIPE_SECRET_KEY`

**Test in terminal:**
```bash
cd /home/gulbrand/Feifei/StoryMe/storyme-app
grep STRIPE_SECRET_KEY .env.local
```

**Expected:** Should show `STRIPE_SECRET_KEY=sk_test_...`
**If missing:** Add your Stripe secret key to `.env.local`

---

### 3. Check Stripe Price IDs

The route calls `getPriceId(tier, cycle)` which looks up price IDs (line 81)

**Test in terminal:**
```bash
cd /home/gulbrand/Feifei/StoryMe/storyme-app
grep STRIPE_PRICE_ .env.local
```

**Expected:** Should show 6 price IDs (basic/premium/team × monthly/annual)
**Status:** ✅ All 6 price IDs are configured

---

### 4. Check Server Logs

**View real-time logs:**
```bash
cd /home/gulbrand/Feifei/StoryMe/storyme-app
npm run dev
```

Then click a pricing plan and watch the console for errors.

**Look for:**
- "Error creating checkout session:" (line 121)
- Error details from Stripe API
- Auth errors

---

### 5. Check Network Tab

In browser:
1. Open DevTools → Network tab
2. Click a pricing plan
3. Find `/api/create-checkout-session` request
4. Check:
   - **Status code**: Should be 200, not 401/500
   - **Response**: Should have `{ sessionId, url }` or `{ error, details }`

---

## Most Likely Issues

### Issue 1: User Not Logged In ⭐ MOST LIKELY

**Symptom:** 401 Unauthorized response
**Cause:** User must be authenticated to create checkout session
**Fix:** Redirect to `/login` first, then to `/pricing`

**Update pricing page to check auth:**

```typescript
// In page.tsx, add useEffect:
useEffect(() => {
  fetch('/api/auth/user')
    .then(r => r.json())
    .then(user => {
      if (!user || !user.id) {
        // Not logged in, redirect to login
        router.push('/login?redirect=/pricing');
      }
    });
}, []);
```

---

### Issue 2: Stripe API Error

**Symptom:** 500 error with Stripe-specific message
**Possible causes:**
- Invalid price ID
- Stripe account not activated
- Price doesn't exist in Stripe dashboard
- Price is archived

**Fix:**
1. Log into Stripe Dashboard: https://dashboard.stripe.com/test/products
2. Verify each price ID exists and is active
3. Check price IDs match in `.env.local`

---

### Issue 3: Database Error

**Symptom:** Error querying `users` table (line 51-55)
**Cause:** Database connection issue or table doesn't exist

**Fix:**
```bash
# Check database connection
cd /home/gulbrand/Feifei/StoryMe/storyme-app
# Run a test query to verify database works
```

---

## Quick Fix (Most Common)

The most common issue is **user not logged in**. The pricing page doesn't check authentication before allowing checkout.

### Recommended Fix

Update `/app/(marketing)/pricing/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check if user is logged in
  useEffect(() => {
    fetch('/api/auth/user')
      .then(r => r.json())
      .then(user => {
        setIsAuthenticated(!!user?.id);
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  const handleSelectPlan = async (tierId: string) => {
    // If not logged in, redirect to signup/login
    if (isAuthenticated === false) {
      router.push(`/login?redirect=/pricing&plan=${tierId}`);
      return;
    }

    if (tierId === 'trial') {
      router.push('/signup');
      return;
    }

    // ... rest of checkout code
  };

  return (
    // ... rest of component
  );
}
```

---

## Testing Checklist

- [ ] User can access pricing page when NOT logged in
- [ ] Clicking a plan redirects to `/login` if not authenticated
- [ ] After login, user is redirected back to pricing
- [ ] Clicking a plan when logged in creates Stripe checkout session
- [ ] Stripe checkout page loads with correct plan
- [ ] Success redirect works after payment

---

## Error Messages Reference

| Error | Line | Meaning | Fix |
|-------|------|---------|-----|
| "Unauthorized" | 20-22 | User not logged in | Redirect to /login |
| "Missing tier or cycle" | 31-34 | Bad request body | Check POST body |
| "Invalid tier" | 37-41 | Tier not basic/premium/team | Fix tier ID |
| "Invalid billing cycle" | 44-47 | Cycle not monthly/annual | Fix billing cycle |
| "Price ID not found..." | 55 in config.ts | Missing env variable | Add STRIPE_PRICE_* to .env.local |
| "Failed to create checkout session" | 124-126 | Generic Stripe error | Check Stripe logs for details |

---

## Next Steps

1. **First**, check if you're logged in (see Issue 1 above)
2. If not logged in, implement the auth check fix
3. If logged in, check server logs for the actual Stripe error
4. Share the error details for more specific help

---

## Quick Test Command

Run this in browser console on the pricing page:

```javascript
// Test if authenticated
fetch('/api/auth/user')
  .then(r => r.json())
  .then(user => {
    if (!user || !user.id) {
      console.error('❌ NOT LOGGED IN - This is the issue!');
    } else {
      console.log('✅ Logged in as:', user.email);
      // Now test checkout
      return fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'basic', cycle: 'monthly' })
      });
    }
  })
  .then(r => r ? r.json() : null)
  .then(data => {
    if (data?.error) {
      console.error('❌ Checkout error:', data.error, data.details);
    } else if (data?.url) {
      console.log('✅ Checkout session created!', data.url);
    }
  });
```

---

## Contact for Help

If the issue persists after trying these steps, provide:
1. Browser console error messages
2. Network tab response for `/api/create-checkout-session`
3. Server logs when clicking the plan
4. Screenshot of the error
