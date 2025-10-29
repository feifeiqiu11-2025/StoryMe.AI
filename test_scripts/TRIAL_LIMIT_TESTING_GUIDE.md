# Trial Limit Testing Guide

This guide helps you test all trial limit scenarios for the `/limit-reached` transition page.

## Test User: markfaye2025@gmail.com

---

## Scenario 1: Story Limit Reached (5/5 stories used)

### Setup SQL:
```sql
-- Set user to have used all 5 free stories
UPDATE users
SET
  stories_created_this_month = 5,
  stories_limit = 5,
  subscription_tier = 'trial',
  trial_status = 'active',
  trial_ends_at = NOW() + INTERVAL '3 days'  -- Trial still active
WHERE email = 'markfaye2025@gmail.com';
```

### Expected Behavior:
1. **Dashboard**: User sees "Stories Created: 5 / 5" in ProfileMenu
2. **Click "Create Story"**: Redirects to `/limit-reached`
3. **Limit Reached Page Shows**:
   - Icon: 📚
   - Title: "Story Limit Reached"
   - Message: "You've created **5 out of 5** free trial stories. Upgrade to get more stories every month or go unlimited with Premium!"
   - Shows Basic vs Premium comparison
4. **Click "Upgrade Now"**: Goes to `/upgrade` page
5. **Click "Back to Dashboard"**: Returns to dashboard

### Verify SQL:
```sql
SELECT
  email,
  stories_created_this_month,
  stories_limit,
  trial_status,
  trial_ends_at,
  CASE
    WHEN stories_created_this_month >= stories_limit THEN '❌ LIMIT REACHED'
    ELSE '✅ Can create'
  END as status
FROM users
WHERE email = 'markfaye2025@gmail.com';
```

---

## Scenario 2: Trial Expired (7 days ended)

### Setup SQL:
```sql
-- Set trial to have expired yesterday
UPDATE users
SET
  stories_created_this_month = 2,
  stories_limit = 5,
  subscription_tier = 'trial',
  trial_status = 'active',
  trial_ends_at = NOW() - INTERVAL '1 day'  -- Expired yesterday
WHERE email = 'markfaye2025@gmail.com';
```

### Expected Behavior:
1. **Dashboard**: User sees trial countdown expired
2. **Click "Create Story"**: Redirects to `/limit-reached`
3. **Limit Reached Page Shows**:
   - Icon: ⏰
   - Title: "Your Trial Has Ended"
   - Message: "Looks like your **7-day free trial** has ended. Upgrade to Basic or Premium to continue creating amazing personalized stories!"
   - Shows Basic vs Premium comparison
4. **Click "Upgrade Now"**: Goes to `/upgrade` page
5. **Click "Back to Dashboard"**: Returns to dashboard

### Verify SQL:
```sql
SELECT
  email,
  stories_created_this_month,
  stories_limit,
  trial_status,
  trial_ends_at,
  NOW() as current_time,
  CASE
    WHEN trial_ends_at < NOW() THEN '❌ TRIAL EXPIRED'
    ELSE '✅ Trial active'
  END as status
FROM users
WHERE email = 'markfaye2025@gmail.com';
```

---

## Scenario 3: Normal Trial User (Can Create Stories)

### Setup SQL:
```sql
-- Reset to normal trial with room to create stories
UPDATE users
SET
  stories_created_this_month = 2,
  stories_limit = 5,
  subscription_tier = 'trial',
  trial_status = 'active',
  trial_ends_at = NOW() + INTERVAL '5 days'  -- 5 days left
WHERE email = 'markfaye2025@gmail.com';
```

### Expected Behavior:
1. **Dashboard**: User sees "Stories Created: 2 / 5" in ProfileMenu
2. **Click "Create Story"**: Successfully navigates to `/create` page
3. **Can build and save stories**: No restrictions
4. **NO redirect to `/limit-reached`**: User has remaining stories

### Verify SQL:
```sql
SELECT
  email,
  stories_created_this_month,
  stories_limit,
  trial_status,
  trial_ends_at,
  CASE
    WHEN stories_created_this_month >= stories_limit THEN '❌ LIMIT REACHED'
    WHEN trial_ends_at < NOW() THEN '❌ TRIAL EXPIRED'
    ELSE '✅ Can create stories'
  END as status
FROM users
WHERE email = 'markfaye2025@gmail.com';
```

---

## Scenario 4: Basic Tier User (20 stories/month)

### Setup SQL:
```sql
-- Upgrade to Basic tier
UPDATE users
SET
  stories_created_this_month = 15,
  stories_limit = 20,
  subscription_tier = 'basic',
  subscription_status = 'active',
  trial_status = 'completed',
  billing_cycle_start = NOW() - INTERVAL '15 days'
WHERE email = 'markfaye2025@gmail.com';
```

### Expected Behavior:
1. **Dashboard**: User sees "Stories Created: 15 / 20" and "⭐ Basic Member"
2. **Click "Create Story"**: Successfully navigates to `/create` page
3. **Can create stories**: Has 5 remaining this month
4. **NO redirect to `/limit-reached`**: User is paid tier with remaining stories

---

## Scenario 5: Basic Tier User Hits Monthly Limit

### Setup SQL:
```sql
-- Basic user who hit their 20 story limit
UPDATE users
SET
  stories_created_this_month = 20,
  stories_limit = 20,
  subscription_tier = 'basic',
  subscription_status = 'active',
  trial_status = 'completed',
  billing_cycle_start = NOW() - INTERVAL '15 days'
WHERE email = 'markfaye2025@gmail.com';
```

### Expected Behavior:
1. **Dashboard**: User sees "Stories Created: 20 / 20" and "⭐ Basic Member"
2. **Click "Create Story"**: Redirects to `/limit-reached`
3. **Limit Reached Page Shows**:
   - Message about reaching monthly limit
   - Suggests upgrading to Premium for unlimited
4. **Basic users should also see this page when they hit limits**

---

## Scenario 6: Premium User (Unlimited)

### Setup SQL:
```sql
-- Upgrade to Premium tier
UPDATE users
SET
  stories_created_this_month = 50,
  stories_limit = -1,  -- -1 means unlimited
  subscription_tier = 'premium',
  subscription_status = 'active',
  trial_status = 'completed',
  billing_cycle_start = NOW() - INTERVAL '15 days'
WHERE email = 'markfaye2025@gmail.com';
```

### Expected Behavior:
1. **Dashboard**: User sees "Stories Created: 50" and "✨ Premium Member" (no limit shown)
2. **Click "Create Story"**: Successfully navigates to `/create` page
3. **Can always create stories**: Unlimited
4. **NEVER see `/limit-reached`**: Premium has no limits

---

## Testing Checklist

### For Each Scenario:
- [ ] Run setup SQL in Supabase SQL Editor
- [ ] Run verify SQL to confirm state
- [ ] Log in as markfaye2025@gmail.com
- [ ] Check ProfileMenu shows correct status
- [ ] Click "Create Story" button
- [ ] Verify expected redirect behavior
- [ ] Check `/limit-reached` page displays correct message
- [ ] Test "Upgrade Now" button
- [ ] Test "Back to Dashboard" button

### Edge Cases to Test:
- [ ] Direct navigation to `/create` URL when limit reached
- [ ] Direct navigation to `/limit-reached` when user CAN create (should redirect to /create)
- [ ] API error handling (what if `/api/usage/limits` fails?)
- [ ] Unauthenticated user accessing `/limit-reached` (should redirect to /login)

---

## Quick Reference SQL

### Check Current User Status:
```sql
SELECT
  email,
  subscription_tier,
  trial_status,
  stories_created_this_month,
  stories_limit,
  trial_ends_at,
  EXTRACT(DAY FROM (trial_ends_at - NOW())) as days_left,
  CASE
    WHEN stories_created_this_month >= stories_limit THEN '❌ LIMIT REACHED'
    WHEN trial_ends_at < NOW() THEN '❌ TRIAL EXPIRED'
    ELSE '✅ Can create'
  END as can_create
FROM users
WHERE email = 'markfaye2025@gmail.com';
```

### Reset to Fresh Trial:
```sql
UPDATE users
SET
  stories_created_this_month = 0,
  stories_limit = 5,
  subscription_tier = 'trial',
  trial_status = 'active',
  trial_ends_at = NOW() + INTERVAL '7 days',
  subscription_status = 'trialing'
WHERE email = 'markfaye2025@gmail.com';
```

---

## API Testing

### Test `/api/usage/limits` Endpoint:

```bash
# Get auth token from browser (Application > Cookies > sb-access-token)
curl -X GET https://www.kindlewoodstudio.ai/api/usage/limits \
  -H "Cookie: sb-access-token=YOUR_TOKEN_HERE"
```

Expected responses:

**Can Create:**
```json
{
  "canCreate": true,
  "storiesUsed": 2,
  "storiesLimit": 5,
  "tier": "trial",
  "status": "active",
  "trialEndsAt": "2025-11-05T12:00:00Z"
}
```

**Limit Reached:**
```json
{
  "canCreate": false,
  "reason": "You've reached your monthly limit of 5 stories...",
  "storiesUsed": 5,
  "storiesLimit": 5,
  "tier": "trial",
  "status": "active",
  "trialEndsAt": "2025-11-05T12:00:00Z"
}
```

**Trial Expired:**
```json
{
  "canCreate": false,
  "reason": "Your free trial has expired. Upgrade to Basic or Premium...",
  "storiesUsed": 2,
  "storiesLimit": 5,
  "tier": "trial",
  "status": "expired",
  "trialEndsAt": "2025-10-28T12:00:00Z"
}
```

---

## Troubleshooting

### Issue: User can still create stories when they shouldn't
**Check:**
1. Verify SQL was applied: Run verify query
2. Check browser cache: Hard refresh (Ctrl+Shift+R)
3. Check API response: Open DevTools Network tab, look for `/api/usage/limits` call
4. Check middleware: Ensure `/limit-reached` is not protected by limit checks

### Issue: Page redirects in a loop
**Check:**
1. `/limit-reached` page should check limits and redirect to `/create` if user CAN create
2. Make sure there's no redirect loop between pages
3. Check browser console for errors

### Issue: Wrong message displayed on /limit-reached
**Check:**
1. API returning correct `reason` field
2. Reason detection logic in `/limit-reached/page.tsx` line 45-48
3. Verify `trial_ends_at` vs `stories_created_this_month` in database

---

## Notes

- **Trial users**: Start with 5 stories, 7-day trial
- **Basic users**: 20 stories/month
- **Premium users**: Unlimited (stories_limit = -1)
- **Billing cycle resets**: Every 30 days from `billing_cycle_start`
- **Trial expiration**: Based on `trial_ends_at` timestamp
