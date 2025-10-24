# Quick Start: Test Phase 2A

**Time:** 5 minutes
**Purpose:** Verify subscription system is working

---

## Step 1: Test Your Subscription Status

Open in browser (must be logged in):
```
https://story-me-ai.vercel.app/api/test-subscription
```

**Expected:** JSON showing your tier, story count, and limits.

---

## Step 2: Try Creating a Story

1. Go to story creation page
2. Create a complete story
3. Save it

**Expected:** Story saves successfully, counter increments.

---

## Step 3: Check Your Count

Visit test endpoint again:
```
https://story-me-ai.vercel.app/api/test-subscription
```

**Expected:** `storiesUsed` should be +1.

---

## Step 4: Test Limit (Optional)

**If you're on trial (free tier):**

1. Create 5 stories total
2. Try to create a 6th story

**Expected:** Should get error "You've reached your monthly limit of 5 stories"

---

## Step 5: Test Premium (Optional)

**Set yourself to premium:**

```sql
UPDATE users
SET subscription_tier = 'premium', stories_limit = -1
WHERE email = 'your-email@example.com';
```

**Then:** Create more stories - should have no limit.

---

## Troubleshooting

**Test endpoint returns 401?**
→ Not logged in. Go to login page first.

**Test endpoint returns error?**
→ Migrations may not be applied. Check database.

**Story creation still works at limit?**
→ Check if `stories_limit = -1` (unlimited) or migrations didn't apply.

**Counter not incrementing?**
→ Check database function `increment_story_count` exists.

---

## Quick SQL Checks

**Check your user:**
```sql
SELECT
  email,
  subscription_tier,
  subscription_status,
  stories_created_this_month,
  stories_limit,
  trial_ends_at
FROM users
WHERE email = 'your-email@example.com';
```

**Check all users:**
```sql
SELECT
  subscription_tier,
  COUNT(*) as count,
  AVG(stories_created_this_month) as avg_stories
FROM users
GROUP BY subscription_tier;
```

---

## Everything Working?

✅ Test endpoint returns JSON
✅ Story creation increments counter
✅ Hitting limit returns 403 error
✅ Premium users have unlimited

**Phase 2A is working! Ready for Phase 2B (Stripe).**
