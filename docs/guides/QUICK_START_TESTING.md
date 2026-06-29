# Quick Start: Test Spotify Publishing in 5 Minutes

**Goal**: Test the Spotify publish button locally before production deployment

---

## ⚡ Step 1: Apply Database Migration (2 minutes)

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/[your-project-id]
2. Click **SQL Editor** → **New Query**
3. Copy contents of: `/home/gulbrand/Feifei/StoryMe/storyme-app/supabase/migrations/20251021_add_publications_generic.sql`
4. Paste and click **Run**
5. Should see: "Success. No rows returned"

**Quick Verify**:
```sql
-- Run this to confirm table exists:
SELECT COUNT(*) FROM publications;
-- Should return: 0 (table exists but empty)
```

---

## ⚡ Step 2: Verify Storage Bucket (30 seconds)

1. Supabase Dashboard → **Storage** → **All Buckets**
2. Find bucket: `story-audio-files`
3. If doesn't exist:
   - Click **New Bucket**
   - Name: `story-audio-files`
   - Check **"Public bucket"** ✓
   - Click **Create**

---

## ⚡ Step 3: Open StoryMe Local App (30 seconds)

1. Dev server already running: **http://localhost:3001**
2. Open in browser
3. Log in with your account

---

## ⚡ Step 4: Get a Story with Audio (1-2 minutes)

**Option A: Use Existing Story**
- Go to My Stories: http://localhost:3001/projects
- Click on a story that already has audio for all scenes
- Skip to Step 5

**Option B: Create Quick Test Story**
1. Click **Create New Story**
2. Title: "Spotify Test Story"
3. Author: "Test", Age: 7
4. Click through to Story Viewer
5. Click **Generate Audio** for cover (wait ~10 seconds)
6. Add 1-2 scenes with short text (e.g., "The dragon flew over the castle.")
7. Click **Generate Audio** for each scene (wait ~10 seconds each)
8. All audio players should be green/playable

---

## ⚡ Step 5: Test Publish Button (1 minute)

1. On Story Viewer page, scroll to bottom action buttons
2. Should see: **🎵 Spotify** (gray button)
3. Click the button
4. Confirm dialog → Click **OK**
5. Watch button change:
   - "Publishing..." (orange, spinner) ← compiling audio
   - "Published" (blue) ← success!
6. Should see success alert:
   ```
   ✅ Your story has been published to the KindleWood podcast!
   It will appear on Spotify within 1-6 hours.
   ```

---

## ⚡ Step 6: Verify It Worked (30 seconds)

### Check 1: Database
Supabase Dashboard → SQL Editor:
```sql
SELECT title, status, audio_duration_seconds, compiled_audio_url
FROM publications
WHERE platform = 'spotify'
ORDER BY requested_at DESC
LIMIT 1;
```

**Expected Result**:
- `title`: "Spotify Test Story"
- `status`: "published"
- `audio_duration_seconds`: ~30-60 (depending on story length)
- `compiled_audio_url`: Full URL to MP3 file

### Check 2: Audio File
1. Copy `compiled_audio_url` from database
2. Open URL in browser
3. Should download/play MP3 audiobook (cover + all scenes concatenated)

### Check 3: RSS Feed
1. Open: http://localhost:3001/api/podcast/feed.xml
2. Should see XML with your story in `<item>` tag:
   ```xml
   <item>
     <title>Spotify Test Story</title>
     <enclosure url="https://[...].mp3" ... />
   </item>
   ```

---

## ✅ Success!

If all 3 checks pass:
- ✅ Spotify publishing works locally
- ✅ Ready for production deployment

---

## 🐛 Troubleshooting

**Button stuck on "Publishing..."**
- Check browser console (F12 → Console) for errors
- Check terminal logs where dev server is running
- Database should show `status = 'published'` or `'failed'` (not 'compiling')

**Error: "publications table does not exist"**
- Retry Step 1 (apply migration)
- Verify: `SELECT * FROM publications;` returns empty result (not error)

**Error: "Failed to upload to storage"**
- Verify `story-audio-files` bucket exists and is **public**
- Supabase Dashboard → Storage → story-audio-files → Settings → Public bucket ✓

**Error: "Please generate audio for all scenes"**
- All scenes must have audio (green audio players)
- Click "Generate Audio" for any missing scenes

**Button is gray but disabled**
- Story might already be published
- Check database: `SELECT * FROM publications WHERE project_id = '[story-id]';`
- If exists, button correctly shows published state

---

## 📚 Next Steps

**After local testing passes**:

1. **Create Professional Cover Art**
   - 3000x3000px JPG
   - Replace: `storyme-app/public/podcast-cover-art.svg`

2. **Deploy to Production**
   ```bash
   cd /home/gulbrand/Feifei/StoryMe/storyme-app
   vercel --prod
   ```

3. **Submit to Spotify**
   - Go to: https://podcasters.spotify.com/
   - Submit RSS feed: `https://yourdomain.com/api/podcast/feed.xml`
   - Wait 1-2 days for approval

4. **Publish First Real Story**
   - Use production app
   - Click Spotify button
   - Wait 1-6 hours for episode to appear on Spotify

**Full Guides**:
- [SPOTIFY_TESTING_GUIDE.md](SPOTIFY_TESTING_GUIDE.md) - Detailed test scenarios
- [NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md](NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md) - Production deployment
- [CURRENT_STATUS_SPOTIFY_FEATURE.md](CURRENT_STATUS_SPOTIFY_FEATURE.md) - Complete status overview

---

**Estimated Time**: 5 minutes
**Difficulty**: Easy
**Prerequisites**: Dev server running, Supabase access
