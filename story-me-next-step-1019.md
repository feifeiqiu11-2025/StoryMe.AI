# StoryMe Project - Session Summary (October 19, 2025)

## Session Overview
This session focused on fixing critical bugs related to authentication, permissions, and UX improvements for the StoryMe application. Multiple RLS (Row Level Security) issues were identified and resolved, along with OAuth user synchronization problems, UI refinements, and implementation of comprehensive rate limiting and API usage tracking.

---

## ✅ Completed Tasks

### 1. Community Stories Navigation & Authentication Flow
**Problem**: Users were losing their session when clicking "Community Stories" from the dashboard. The page showed a public version with "Sign In/Sign Up" buttons instead of maintaining the dashboard layout with proper header.

**Solution**:
- Created `/app/(dashboard)/community-stories/page.tsx` - Dashboard version for authenticated users
- Deleted `/app/community-stories/page.tsx` - Removed public standalone version (guest mode removal)
- Updated all landing page links to point to `/signup` instead of `/community-stories`
- Files modified:
  - `components/landing/HeroStoryShowcase.tsx` (lines 71, 130)
  - `app/story/[id]/page.tsx` (removed Community Stories link, changed to signup)

**Result**: Users now stay signed in when viewing community stories. No more session loss.

---

### 2. Sign Out Button 405 Error Fix
**Problem**: Sign out button was throwing HTTP 405 "Method Not Allowed" errors.

**Root Cause**: The `/app/api/auth/signout/route.ts` only had a POST handler, but some requests were using GET.

**Solution**:
- Refactored sign out logic into shared `handleSignOut()` function
- Added both POST and GET handlers to support all request methods
- File modified: `/app/api/auth/signout/route.ts`

```typescript
async function handleSignOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const origin = request.headers.get('origin') || /* ... */;
  return NextResponse.redirect(new URL('/', origin));
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}
```

**Result**: Sign out now works reliably via both POST and GET requests.

---

### 3. Public Stories Viewing Permissions (RLS Fix #1)
**Problem**: Authenticated users couldn't view public stories from other users in the Community Stories tab. Permission denied errors.

**Root Cause**: RLS policies only allowed users to view their own projects, not public projects from others.

**Solution**:
- Created migration: `20251019_fix_public_stories_rls.sql`
- Added RLS policies for viewing public content:
  - `"Users can view public stories"` on `projects` table
  - `"Users can view public scenes"` on `scenes` table
  - `"Users can view public images"` on `generated_images` table
- Policies check: `visibility = 'public' AND status = 'completed'`

**Result**: All authenticated users can now view completed public stories from any user.

---

### 4. OAuth User Synchronization Fix
**Problem**: Users authenticating via Google OAuth (e.g., yanpingfan2024@gmail.com) were created in `auth.users` table but NOT in the custom `users` table. This caused:
- Missing user records
- No trial tracking
- Permission issues
- Features not working properly

**Root Cause**: OAuth callback only exchanged code for session, didn't create user record in custom `users` table.

**Solution**:

#### A. Updated OAuth Callback Handler
File: `/app/api/auth/callback/route.ts`

Added automatic user record creation:
```typescript
if (!error && data.user) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (!existingUser) {
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    await supabase.from('users').insert([{
      id: userId,
      email: email,
      name: name,
      subscription_tier: 'free',
      trial_started_at: trialStartDate.toISOString(),
      trial_ends_at: trialEndDate.toISOString(),
      images_generated_count: 0,
      images_limit: 50,
      trial_status: 'active'
    }]);
  }
}
```

#### B. Created Migration to Sync Existing OAuth Users
File: `20251019_sync_oauth_users.sql`

Syncs all existing OAuth users from `auth.users` to `users` table:
```sql
INSERT INTO users (id, email, name, subscription_tier, trial_started_at, trial_ends_at, ...)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', SPLIT_PART(au.email, '@', 1)) as name,
  'free' as subscription_tier,
  au.created_at as trial_started_at,
  au.created_at + INTERVAL '7 days' as trial_ends_at,
  50 as images_limit,
  0 as images_generated_count,
  'active' as trial_status
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL;
```

**Result**:
- Future OAuth users automatically get user records with trial data
- Existing OAuth users (like yanpingfan2024@gmail.com) synced via migration
- All OAuth users now have proper trial tracking and permissions

---

### 5. Scene Preview UI/UX Improvements
**Problem**: Enhance scene preview page had oversized UI elements wasting screen space:
- Title font too large
- Scene number bullet points too big
- Story caption text box showing 3 rows by default (should be 1 line)

**Solution**:
File: `/components/story/ScenePreviewApproval.tsx`

Changes made:
1. **Title size reduced**: `text-3xl` → `text-2xl` (line 49)
2. **Scene bullets reduced**: `w-12 h-12 text-lg` → `w-8 h-8 text-sm` (line 122)
3. **Caption textarea with auto-expand**:
   - Changed from `rows={3}` to `rows={1}`
   - Added auto-resize on input
   - Added initial resize on focus
   - Set minimum height to `2.5rem`

```typescript
<textarea
  value={scene.caption}
  onChange={(e) => {
    onCaptionEdit(scene.sceneNumber, e.target.value);
    // Auto-resize textarea based on content
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }}
  onFocus={(e) => {
    // Set initial height on focus
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }}
  rows={1}
  style={{ minHeight: '2.5rem' }}
  className="... overflow-hidden"
/>
```

**Result**:
- Cleaner, more compact UI
- Better space utilization
- Captions expand automatically only when needed
- Committed to production: `6e121a0`

---

### 6. Guest Mode Removal
**Problem**: App had mixed guest/authenticated flows causing confusion.

**Solution**:
- Removed public `/app/community-stories/page.tsx`
- Kept only dashboard version requiring authentication
- Updated all guest-facing links to point to `/signup`
- Removed "Community Stories" link from story viewer header

**Result**: Clean authentication flow - users must sign in to access community features.

---

## 🔧 Database Migrations Created

### Successfully Deployed:
1. ✅ `20251018_add_story_privacy.sql` - Story privacy and public sharing features
2. ✅ `20251019_add_trial_tracking.sql` - Trial system with image usage tracking
3. ✅ `20251019_fix_public_stories_rls.sql` - RLS policies for viewing public stories
4. ✅ `20251019_sync_oauth_users.sql` - Sync existing OAuth users to users table
5. ✅ `20251019_fix_scenes_insert_rls.sql` - First attempt at fixing scene INSERT policies

### Pending Deployment:
6. ⚠️ **`20251019_fix_scenes_rls_v2.sql`** - CRITICAL: Comprehensive RLS fix (see outstanding issues below)
7. 🆕 **`20251020_add_api_usage_tracking.sql`** - NEW: API usage tracking and rate limiting

---

### 7. Rate Limiting & API Usage Tracking (NEW)
**Date**: October 19, 2025 (Late session)
**Priority**: P0 - Critical for cost management and growth analytics

**Problem**: No rate limiting on expensive APIs could lead to abuse and high costs. No analytics data for monitoring growth.

**Solution Implemented**:

#### A. Database Schema
Created migration: `20251020_add_api_usage_tracking.sql`

**Table**: `api_usage_logs`
- Tracks all API calls with user_id, endpoint, status_code
- Records resource usage (images_generated, scenes_enhanced, characters_created)
- Includes performance metrics (response_time_ms)
- Guest user support via session_id

**Helper Functions**:
- `get_daily_image_count(user_id)` - Images in last 24 hours
- `get_hourly_image_count(user_id)` - Images in last 1 hour
- `check_daily_image_limit(user_id, limit)` - Boolean check
- `check_hourly_image_limit(user_id, limit)` - Boolean check

#### B. Rate Limit Configuration
File: `src/lib/utils/rate-limit.ts`

**Limits** (as requested):
```typescript
FREE TRIAL:
- 100 images/day
- 20 images/hour (burst protection)
- 50 images total (trial limit)

PAID USERS:
- 100 images/day
- 20 images/hour (burst protection)
- No total limit
```

**Key Features**:
- ✅ Clear, friendly error messages (not technical)
- ✅ Tells users exactly what to do (reduce scenes, wait, upgrade)
- ✅ Shows time remaining ("Please wait 42 minutes")
- ✅ Checks limits BEFORE generating images (saves money)

**Example Error Messages**:
```
"You've reached your trial limit of 50 images. Upgrade to continue creating stories!"

"This would exceed your daily limit. You have 15 images remaining today. Try generating fewer scenes!"

"You're generating images too quickly! Please wait 42 minutes before trying again."
```

#### C. Updated API Routes
File: `src/app/api/generate-images/route.ts`

Changes:
- Added rate limit check before image generation
- Returns 429 status with clear message if limit exceeded
- Logs all API calls (success and failure)
- Includes current limits in response

Response format (rate limit hit):
```json
{
  "error": "Rate limit exceeded",
  "message": "You've reached your daily limit...",
  "limits": {
    "daily": { "used": 100, "limit": 100, "remaining": 0 },
    "hourly": { "used": 15, "limit": 20, "remaining": 5 },
    "total": { "used": 45, "limit": 50, "remaining": 5 }
  }
}
```

#### D. Usage Dashboard Component
Files:
- `src/app/api/usage/limits/route.ts` - API endpoint to get current usage
- `src/components/usage/UsageLimitBadge.tsx` - Dashboard widget

**Features**:
- Real-time usage display with progress bars
- Color-coded warnings (green → orange → red)
- Trial limit prominently displayed
- Warning messages at 75% and 90% usage
- Refresh button

**Usage in Dashboard**:
```tsx
import { UsageLimitBadge } from '@/components/usage/UsageLimitBadge';

<UsageLimitBadge />
```

#### E. Analytics Capabilities

**Growth Metrics**:
- Daily Active Users (DAU)
- Most active users
- Cost tracking ($0.05 per image)
- Error rates by endpoint
- Rate limit hit tracking

**Example Query** (Cost Tracking):
```sql
SELECT
  DATE(created_at) as date,
  SUM(images_generated) as total_images,
  ROUND(SUM(images_generated) * 0.05, 2) as cost_usd
FROM api_usage_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Benefits**:
- ✅ Prevents abuse (max $5/day per user)
- ✅ User-friendly error messages (no silent failures)
- ✅ Growth analytics (DAU, engagement, costs)
- ✅ Feature usage insights (which APIs are popular)
- ✅ Long-term data for pricing optimization

**Documentation**: See `RATE_LIMITING_IMPLEMENTATION.md` for complete details, test plan, and analytics queries.

---

## ❌ Outstanding Issues (CRITICAL)

### Issue #1: Scene Save RLS Error (BLOCKER)
**Status**: 🔴 **BLOCKING USERS FROM SAVING STORIES**

**Error Message**:
```
Failed to save scene 1: new row violates row-level security policy for table "scenes"
```

**Description**: Users cannot save stories. When they try to save scenes, Supabase RLS blocks the INSERT operation on the `scenes` table.

**Root Cause**:
- Previous RLS policies may not have been applied correctly in production
- Or there are conflicting policies
- Or the policies are missing the correct permission checks

**Where Error Occurs**:
- File: `/src/lib/services/project.service.ts:365`
- Operation: `supabase.from('scenes').insert({ ... })`
- User: Any authenticated user trying to save their story

**Attempted Fixes**:
1. ✅ Created `20251019_fix_scenes_insert_rls.sql` - User ran this but error persists
2. 🔄 Created `20251019_fix_scenes_rls_v2.sql` - **NEEDS TO BE RUN**

**Next Steps Required**:
1. **Run the comprehensive migration**: `20251019_fix_scenes_rls_v2.sql`
   - Location: `/storyme-app/supabase/migrations/20251019_fix_scenes_rls_v2.sql`
   - This migration:
     - Drops ALL existing RLS policies on `scenes` and `generated_images` tables
     - Recreates complete policy set from scratch
     - Ensures RLS is enabled
     - Adds policies for all operations: SELECT, INSERT, UPDATE, DELETE

2. **Verify policies were created**:
   ```sql
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('scenes', 'generated_images')
   ORDER BY tablename, policyname;
   ```

   Expected policies for `scenes`:
   - Users can view own scenes (SELECT)
   - Users can view public scenes (SELECT)
   - Users can insert own scenes (INSERT) ← **THIS IS KEY**
   - Users can update own scenes (UPDATE)
   - Users can delete own scenes (DELETE)

3. **Test the fix**:
   - Create a new story
   - Try to save scenes
   - Should work without RLS errors

**Why v2 Migration is Better**:
- Completely cleans up any conflicting policies
- Uses proper `WITH CHECK` clauses for INSERT operations
- Includes both `USING` and `WITH CHECK` for UPDATE operations
- Explicitly enables RLS on tables
- More comprehensive coverage of all CRUD operations

---

## 📊 Key Technical Context

### Technology Stack
- **Framework**: Next.js 15.5.4 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with Google OAuth
- **Security**: Row Level Security (RLS)
- **Deployment**: Vercel (production)

### Database Tables Involved
1. **auth.users** - Supabase managed auth table
2. **users** - Custom user table with trial tracking
3. **projects** - User stories/projects
4. **scenes** - Individual scenes in a story
5. **generated_images** - AI-generated images for scenes

### Authentication Flow
1. User signs up via email or Google OAuth
2. OAuth callback creates/syncs user record in `users` table
3. User gets 7-day free trial with 50 image limit
4. User can create stories (projects) with scenes and images

### RLS Security Model
- Users can CRUD their own resources
- Users can VIEW public/completed resources from others
- All operations check `projects.user_id = auth.uid()`
- Scene/image policies check ownership through project relationship

---

## 🔄 Files Modified This Session

### Frontend Components
1. `/app/(dashboard)/community-stories/page.tsx` - **CREATED** - Dashboard community stories
2. `/app/community-stories/page.tsx` - **DELETED** - Removed public version
3. `/components/landing/HeroStoryShowcase.tsx` - Updated links to `/signup`
4. `/app/story/[id]/page.tsx` - Removed community stories link
5. `/components/story/ScenePreviewApproval.tsx` - UI size improvements

### Backend/API
6. `/app/api/auth/callback/route.ts` - OAuth user sync logic
7. `/app/api/auth/signout/route.ts` - GET/POST handler support

### Database Migrations
8. `/supabase/migrations/20251019_fix_public_stories_rls.sql` - Public story viewing
9. `/supabase/migrations/20251019_sync_oauth_users.sql` - OAuth user sync
10. `/supabase/migrations/20251019_fix_scenes_insert_rls.sql` - First RLS attempt
11. `/supabase/migrations/20251019_fix_scenes_rls_v2.sql` - **Comprehensive RLS fix (PENDING)**

---

## 🎯 Trial System Features (Already Implemented)

### Trial Tracking
- 7-day free trial starting from user creation
- 50 image generation limit during trial
- Automatic tracking via database trigger
- UsageBadge component shows remaining images

### Database Trigger
Automatically increments `images_generated_count` on each image generation:
```sql
CREATE OR REPLACE FUNCTION increment_image_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET images_generated_count = images_generated_count + 1
  WHERE id = (
    SELECT user_id FROM projects WHERE id = NEW.project_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 🚀 Recent Git Commits

```
6e121a0 - Fix: Make scene preview more compact with smaller fonts
37f6b9f - Fix: Make regenerate panel more compact and responsive
b443c68 - Fix: Define artStyle constant to resolve ReferenceError
c10cacb - Fix: Add missing fields to regenerate API and defensive checks
724e577 - Fix: Handle undefined generationTime in ImageGallery
f62914c - Add scene image regeneration feature
```

---

## 📋 Immediate Next Steps (Priority Order)

### 🔴 CRITICAL - Must Do First
1. **Run `20251019_fix_scenes_rls_v2.sql` in Supabase**
   - This is BLOCKING all users from saving stories
   - File location: `/storyme-app/supabase/migrations/20251019_fix_scenes_rls_v2.sql`
   - Verify policies created correctly after running
   - Test story saving functionality

### 🟡 Important - Verify After Critical Fix
2. **Test complete user flow**:
   - Google OAuth signup → User record creation
   - Create new story → Generate scenes
   - Save story → Should work without RLS errors
   - View community stories → See public stories from others
   - Sign out → No 405 errors

3. **Verify all migrations deployed**:
   ```sql
   SELECT * FROM supabase_migrations ORDER BY version DESC;
   ```
   Should show all migrations from 20251018 and 20251019

### 🟢 Nice to Have - Future Improvements
4. **Monitor OAuth user creation**:
   - Check that new OAuth users get proper trial data
   - Verify `users` table is staying in sync with `auth.users`

5. **Consider adding monitoring**:
   - Track RLS policy violations in logs
   - Alert on authentication failures
   - Monitor trial expiration and conversion rates

---

## 🐛 Known Issues Resolved This Session

1. ✅ Community Stories navigation losing session
2. ✅ Sign out button 405 errors
3. ✅ Users couldn't view public stories (RLS)
4. ✅ OAuth users missing from users table
5. ✅ Scene preview UI too large
6. ✅ Guest mode causing confusion
7. ⚠️ Scene save RLS error - **Migration ready, needs deployment**

---

## 💡 Important Notes for Next Session

### RLS Policy Pattern
When creating RLS policies for related tables (scenes → projects), always check ownership through the relationship:

```sql
-- Good: Check project ownership for scene operations
CREATE POLICY "Users can insert own scenes"
  ON scenes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  );
```

### OAuth User Sync
The callback handler now automatically creates user records. If users report missing data:
1. Check `auth.users` table for their account
2. Check `users` table for corresponding record
3. Run sync migration if needed
4. Verify trial dates are set correctly

### Testing RLS Policies
After modifying RLS policies, test with:
1. Different user accounts (not just admin)
2. Both own and other users' content
3. All CRUD operations (not just SELECT)
4. Error messages should be clear

### Migration File Naming
Pattern: `YYYYMMDD_descriptive_name.sql`
- Use date prefix for chronological ordering
- Use descriptive names explaining what it does
- Include comments in SQL for future reference

---

## 📞 User Feedback Received

1. "user should stay sign in when go to community stories, keep them sign in" ✅ Fixed
2. "sign out button still throw error" ✅ Fixed
3. "not all user can see the public stories under community stories tab, seems some permission issue?" ✅ Fixed
4. "google oauthen enabled user or some user in the authenticated table but not in user table" ✅ Fixed
5. "enhance scene preview font is too big... bullet point for each scene is too big" ✅ Fixed
6. "seeing error when save story Failed to save scene 1: new row violates row-level security policy for table 'scenes'" ⚠️ **Migration ready for deployment**

---

## 🔐 Security Considerations

### RLS Policy Security
- All policies check `auth.uid()` to verify user identity
- Public content requires explicit `visibility = 'public'` AND `status = 'completed'`
- Users can only modify their own resources
- Images and scenes check ownership through project relationship

### OAuth Security
- User creation happens server-side in callback
- Trial data initialized securely
- No client-side manipulation of user records
- Auth state managed by Supabase Auth

### Data Privacy
- Private stories are never visible to other users
- Public stories require explicit user action to publish
- RLS enforced at database level (not just application level)

---

## 📚 Useful SQL Queries for Debugging

### Check RLS Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('scenes', 'generated_images', 'projects')
ORDER BY tablename, cmd;
```

### Check OAuth User Sync Status
```sql
SELECT
  au.id,
  au.email,
  au.created_at as auth_created,
  u.id as user_record_exists,
  u.trial_status
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE au.app_metadata->>'provider' = 'google'
ORDER BY au.created_at DESC;
```

### Check Trial Status
```sql
SELECT
  email,
  trial_status,
  trial_started_at,
  trial_ends_at,
  images_generated_count,
  images_limit,
  CASE
    WHEN trial_ends_at > NOW() THEN 'Active'
    ELSE 'Expired'
  END as current_status
FROM users
ORDER BY created_at DESC;
```

### Check Projects and Scenes
```sql
SELECT
  p.id,
  p.user_id,
  p.title,
  p.visibility,
  p.status,
  COUNT(s.id) as scene_count
FROM projects p
LEFT JOIN scenes s ON s.project_id = p.id
GROUP BY p.id
ORDER BY p.created_at DESC;
```

---

## 🎨 UI/UX Improvements Made

1. **Community Stories Page**
   - Now uses dashboard layout for authenticated users
   - Maintains header and navigation
   - No more session loss

2. **Scene Preview Approval**
   - Smaller, cleaner title (text-2xl)
   - Compact scene bullets (w-8 h-8, text-sm)
   - Auto-expanding caption textarea (starts at 1 line)
   - Better space utilization

3. **Authentication Flow**
   - Removed confusing guest mode
   - Clear signup path from landing page
   - Consistent sign out behavior

---

## 🔄 Development Workflow

### Current Branch
- `main` branch

### Development Server
- Running at: `http://localhost:3000`
- Command: `cd storyme-app && npm run dev`
- Background process ID: bc138f

### Deployment
- Production: Vercel
- Auto-deploys from `main` branch
- Environment variables configured in Vercel dashboard

### Database Access
- Supabase dashboard for SQL execution
- Migrations run manually in SQL Editor
- RLS policies managed through SQL

---

## 📝 Code Patterns Established

### RLS Policy Pattern for Related Tables
```sql
-- Template for checking ownership through relationship
CREATE POLICY "policy_name"
  ON child_table
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM parent_table
      WHERE parent_table.id = child_table.parent_id
        AND parent_table.user_id = auth.uid()
    )
  );
```

### OAuth Callback Pattern
```typescript
// Check for existing user record
const { data: existingUser } = await supabase
  .from('users')
  .select('id')
  .eq('id', userId)
  .single();

// Create if doesn't exist
if (!existingUser) {
  await supabase.from('users').insert([{
    id: userId,
    email: email,
    // ... other fields
  }]);
}
```

### Auto-expanding Textarea Pattern
```typescript
<textarea
  onChange={(e) => {
    // Handle value change
    onValueChange(e.target.value);

    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }}
  onFocus={(e) => {
    // Initial resize on focus
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }}
  rows={1}
  style={{ minHeight: '2.5rem' }}
  className="... overflow-hidden"
/>
```

---

## End of Session Summary

This session successfully resolved 6 out of 7 critical issues. The remaining issue (scene save RLS error) has a comprehensive migration ready for deployment. Once `20251019_fix_scenes_rls_v2.sql` is run in production, all blocking issues will be resolved and users will be able to:

- Sign up via Google OAuth with proper trial tracking
- Navigate community stories without losing session
- View public stories from other users
- Save their own stories without RLS errors
- Sign out reliably
- Use a cleaner, more compact UI

**Next conversation should start with**: Running the v2 RLS migration and verifying the save functionality works.
