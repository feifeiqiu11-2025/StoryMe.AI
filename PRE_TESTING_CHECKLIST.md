# Pre-Testing Checklist for Spotify Publishing

Before you begin testing the Spotify publishing feature, complete these verification steps:

---

## ✅ Step 1: Apply Database Migration

**Why**: The `publications` table must exist before testing

**Action**:
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/[your-project-id]
2. Click **SQL Editor** in left sidebar
3. Click **New Query**
4. Open file: `/home/gulbrand/Feifei/StoryMe/storyme-app/supabase/migrations/20251021_add_publications_generic.sql`
5. Copy entire contents and paste into SQL Editor
6. Click **Run** button
7. Should see: "Success. No rows returned"

**Verification**:
1. Open file: `/home/gulbrand/Feifei/StoryMe/storyme-app/CHECK_PUBLICATIONS_TABLE.sql`
2. Copy contents and paste into SQL Editor
3. Click **Run**
4. Should see:
   - `publications_table_exists`: **true**
   - List of columns including: `id`, `project_id`, `user_id`, `platform`, `status`, etc.
   - 6 indexes created
   - 4 RLS policies created
   - 2 constraints (primary key + unique project/platform)

---

## ✅ Step 2: Verify Supabase Storage Bucket

**Why**: Compiled audio files must be stored in public bucket

**Action**:
1. Go to Supabase Dashboard → **Storage** → **All Buckets**
2. Find bucket named: **`story-audio-files`**
3. Click bucket settings (gear icon)
4. Verify **"Public bucket"** is checked ✓

**If bucket doesn't exist**:
1. Click **New Bucket**
2. Name: `story-audio-files`
3. Check **"Public bucket"** ✓
4. Click **Create bucket**

**Verification**:
- Try accessing: `https://[your-project-id].supabase.co/storage/v1/object/public/story-audio-files/test.txt`
- Should NOT return 404 or permission error (even if file doesn't exist, bucket should be accessible)

---

## ✅ Step 3: Verify FFmpeg Installation

**Why**: Audio compilation requires FFmpeg

**Action**:
```bash
cd /home/gulbrand/Feifei/StoryMe/storyme-app
npm list fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

**Expected Output**:
```
storyme-app@0.1.0 /home/gulbrand/Feifei/StoryMe/storyme-app
├── @ffmpeg-installer/ffmpeg@1.1.0
└── fluent-ffmpeg@2.1.3
```

**If NOT installed**:
```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg @types/fluent-ffmpeg
```

---

## ✅ Step 4: Verify Dev Server Running

**Why**: Need local environment to test

**Current Status**: ✅ **Running on http://localhost:3001**

**Action**: Open browser and navigate to:
- Landing page: http://localhost:3001/
- My Stories: http://localhost:3001/projects
- Should see KindleWood branding and interface

**If NOT running**:
```bash
cd /home/gulbrand/Feifei/StoryMe/storyme-app
npm run dev
```

---

## ✅ Step 5: Verify Test Story with Audio

**Why**: Can't publish without audio

**Action**:
1. Log in to StoryMe: http://localhost:3001/
2. Go to **My Stories**: http://localhost:3001/projects
3. Check if you have at least one story with:
   - ✅ Title and cover image
   - ✅ At least 2-3 scenes with text
   - ✅ Audio generated for ALL scenes (including cover)

**If NO test story exists**:
1. Click **Create New Story**
2. Fill in story details (title, author, age)
3. Click through story creation flow
4. On Story Viewer page, click **Generate Audio** for cover
5. Click **Generate Audio** for each scene
6. Wait for all audio to complete (shows green audio players)

**Verification**:
- Click story from My Stories
- Should see:
  - 🎵 Audio player for cover (top of page)
  - 🎵 Audio player for each scene
  - All audio players should be playable (not grayed out)

---

## ✅ Step 6: Verify Spotify Button Exists

**Why**: Need UI element to trigger publishing

**Action**:
1. From My Stories, click on a story with audio
2. Scroll down to bottom action buttons
3. Should see button with: **🎵 Spotify** (gray background)

**If button NOT visible**:
- Check file exists: `/home/gulbrand/Feifei/StoryMe/storyme-app/src/app/(dashboard)/projects/[id]/page.tsx`
- Check browser console for errors (F12 → Console tab)
- Try hard refresh: Ctrl+Shift+R (Linux) or Cmd+Shift+R (Mac)

---

## ✅ Step 7: Verify API Endpoints Compiled

**Why**: Backend routes must be compiled by Next.js

**Action**: Check terminal where dev server is running for compilation errors

**Expected**: Should see:
```
✓ Compiled middleware in 235ms
✓ Ready in 1402ms
```

**No errors** about:
- `/api/projects/[id]/publish-spotify`
- `/api/projects/[id]/spotify-status`
- `/api/podcast/feed.xml`

**Verification**: Try accessing endpoints:
```bash
# Should return: "Method not allowed" or "Unauthorized" (NOT 404)
curl -X GET http://localhost:3001/api/projects/test-id/spotify-status

# Should return XML or "Error fetching episodes" (NOT 404)
curl http://localhost:3001/api/podcast/feed.xml
```

---

## ✅ Step 8: Check Environment Variables

**Why**: Supabase credentials needed for API routes

**Action**:
```bash
cd /home/gulbrand/Feifei/StoryMe/storyme-app
cat .env.local | grep -E "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

**Expected**: Should see both variables populated:
```
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (long token)
```

**If missing or incorrect**: Update `.env.local` with correct Supabase credentials from dashboard

---

## ✅ Step 9: Verify User Logged In

**Why**: API routes require authentication

**Action**:
1. Open http://localhost:3001/ in browser
2. Check top-right corner
3. Should see your email/username, NOT "Sign In" button

**If NOT logged in**:
1. Click **Sign In** or **Get Started**
2. Log in with your test account
3. Should redirect to My Stories page

---

## 📋 Pre-Testing Summary

Before proceeding to **SPOTIFY_TESTING_GUIDE.md**, verify all items checked ✓:

- [ ] ✅ Database migration applied (`publications` table exists)
- [ ] ✅ Supabase Storage `story-audio-files` bucket is public
- [ ] ✅ FFmpeg packages installed (`fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`)
- [ ] ✅ Dev server running on http://localhost:3001
- [ ] ✅ Test story exists with audio for all scenes
- [ ] ✅ Spotify button visible on Story Viewer page (🎵 gray button)
- [ ] ✅ API endpoints compiled without errors
- [ ] ✅ Environment variables configured (`.env.local`)
- [ ] ✅ User logged in with valid session

---

## 🚀 Ready to Test!

Once all items above are verified, proceed to:

**📄 SPOTIFY_TESTING_GUIDE.md**

Start with **Test Scenario 1: First-Time Publish**

---

## 🐛 Troubleshooting

### Issue: "publications table does not exist"
**Fix**: Apply database migration (Step 1)

### Issue: "Failed to upload to storage"
**Fix**: Make `story-audio-files` bucket public (Step 2)

### Issue: "FFmpeg command not found"
**Fix**: Install FFmpeg packages (Step 3)

### Issue: "Cannot find module '@/lib/services/audio-compilation.service'"
**Fix**: Restart dev server - file may not be detected yet

### Issue: "Unauthorized" when clicking Spotify button
**Fix**: Log out and log back in to refresh session

### Issue: Spotify button not visible
**Fix**: Hard refresh browser (Ctrl+Shift+R) to clear cache

---

**Questions?** Check:
- Browser DevTools Console (F12 → Console)
- Terminal where dev server is running
- Supabase Dashboard → Logs → API Logs
