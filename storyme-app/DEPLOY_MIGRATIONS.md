# Migration Deployment Guide

## Overview
This guide will walk you through deploying two critical migrations:
1. **RLS Policy Fix** - Fixes scene/image creation permissions
2. **API Usage Tracking** - Enables rate limiting and analytics

## Prerequisites
- Access to Supabase Dashboard
- Supabase project for StoryMe

## Step 1: Deploy RLS Policy Fix

### What this fixes:
- ❌ **Before**: Users cannot save scenes (INSERT permission denied)
- ✅ **After**: Users can create/update/delete their own scenes and images

### How to deploy:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your StoryMe project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the contents of: `supabase/migrations/20251019_fix_scenes_rls_v2.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)

### Expected output:
```
Success. No rows returned
```

### What it does:
- Drops all existing policies on `scenes` and `generated_images` tables
- Creates comprehensive policies for:
  - SELECT (own + public)
  - INSERT (own projects only)
  - UPDATE (own projects only)
  - DELETE (own projects only)
- Maintains public viewing for community stories

---

## Step 2: Deploy API Usage Tracking

### What this enables:
- ✅ Rate limiting (100 images/day, 50 trial total)
- ✅ Clear user-friendly error messages
- ✅ API usage analytics for growth monitoring
- ✅ Cost tracking

### How to deploy:

1. In Supabase SQL Editor, click **New Query**
2. Copy and paste the contents of: `supabase/migrations/20251020_add_api_usage_tracking.sql`
3. Click **Run** (or press Cmd/Ctrl + Enter)

### Expected output:
```
Success. No rows returned
```

### What it creates:
- `api_usage_logs` table for tracking all API calls
- Helper functions:
  - `get_daily_image_count(user_id)`
  - `get_total_trial_image_count(user_id)`
- Indexes for performance
- RLS policies for data security

---

## Step 3: Verify Migrations

After running both migrations, verify they were applied:

```sql
-- Check if policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('scenes', 'generated_images')
ORDER BY tablename, policyname;
```

Expected policies:
- `scenes`:
  - Users can delete own scenes
  - Users can insert own scenes
  - Users can update own scenes
  - Users can view own scenes
  - Users can view public scenes
- `generated_images`:
  - Users can delete own images
  - Users can insert own images
  - Users can update own images
  - Users can view own images
  - Users can view public images

```sql
-- Check if api_usage_logs table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'api_usage_logs';
```

Expected: 1 row with `api_usage_logs`

---

## Step 4: Testing Checklist

### Test 1: Scene Creation (RLS Fix)
1. Log in to your app
2. Create a new story
3. Try to save a scene
4. **Expected**: Scene saves successfully ✅
5. **Before Fix**: Got "new row violates row-level security policy" ❌

### Test 2: Rate Limiting - Daily Limit
1. Generate images for a story with many scenes
2. Try to generate more than 100 images in a day
3. **Expected**: See clear error message:
   ```
   You've reached your daily limit of 100 images.
   Please try again tomorrow or upgrade for more images!
   ```

### Test 3: Rate Limiting - Trial Limit
1. If on trial account, generate more than 50 total images
2. **Expected**: See clear error message:
   ```
   You've reached your trial limit of 50 images.
   Upgrade to continue creating stories!
   ```

### Test 4: Community Stories (No Breaking Changes)
1. Navigate to Community Stories page
2. **Expected**: Can still view all public stories ✅
3. **Important**: Public viewing should NOT be affected by RLS changes

### Test 5: API Usage Logging
1. Generate some images
2. Run this query in Supabase:
   ```sql
   SELECT
     user_id,
     endpoint,
     method,
     status_code,
     images_generated,
     response_time_ms,
     created_at
   FROM api_usage_logs
   ORDER BY created_at DESC
   LIMIT 10;
   ```
3. **Expected**: See logged API calls with timestamps and image counts

---

## Rollback Instructions (If Needed)

### To rollback RLS policies:
```sql
-- Re-enable the old basic policies
DROP POLICY IF EXISTS "Users can insert own scenes" ON scenes;
DROP POLICY IF EXISTS "Users can update own scenes" ON scenes;
DROP POLICY IF EXISTS "Users can delete own scenes" ON scenes;

-- Add back minimal policy (if you had one before)
CREATE POLICY "Users can modify own scenes"
  ON scenes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  );
```

### To rollback API usage tracking:
```sql
-- This is safe to leave in place (it's just a logging table)
-- But if needed, you can drop it:
DROP TABLE IF EXISTS api_usage_logs CASCADE;
DROP FUNCTION IF EXISTS get_daily_image_count(UUID);
DROP FUNCTION IF EXISTS get_hourly_image_count(UUID);
DROP FUNCTION IF EXISTS get_total_trial_image_count(UUID);
```

---

## What's Next

After successful deployment and testing:

1. **Monitor API Usage**: Check the `api_usage_logs` table regularly
2. **Adjust Rate Limits**: Based on user feedback, you can modify limits in [src/lib/utils/rate-limit.ts](src/lib/utils/rate-limit.ts)
3. **Add Usage Dashboard**: Optionally integrate [UsageLimitBadge](src/components/usage/UsageLimitBadge.tsx) into your dashboard
4. **Analytics Queries**: Run queries from `RATE_LIMITING_IMPLEMENTATION.md` to track growth

---

## Support

If you encounter any issues:

1. Check Supabase logs for error details
2. Verify migrations ran successfully (Step 3)
3. Check that RLS is enabled: `SELECT tablename FROM pg_tables WHERE rowsecurity = true;`
4. Review error messages in browser console and API responses
