# Spotify Publishing Feature - Current Status

**Last Updated**: October 21, 2025
**Status**: ✅ Implementation Complete - Ready for Testing
**Dev Server**: http://localhost:3001

---

## 📊 Implementation Summary

All automated code implementation for Spotify publishing has been completed:

### ✅ Completed

1. **Database Schema** - Generic multi-platform publications table
   - File: `supabase/migrations/20251021_add_publications_generic.sql`
   - ⚠️ **NEEDS TO BE APPLIED** - See "Next Actions" below

2. **Audio Compilation Service** - FFmpeg-based audiobook compilation
   - File: `src/lib/services/audio-compilation.service.ts`
   - Dependencies installed: `fluent-ffmpeg@2.1.3`, `@ffmpeg-installer/ffmpeg@1.1.0`

3. **API Endpoints**
   - ✅ `POST /api/projects/[id]/publish-spotify` - Triggers compilation & publishing
   - ✅ `GET /api/projects/[id]/spotify-status` - Returns publication status
   - ✅ `GET /api/podcast/feed.xml` - RSS 2.0 feed for Spotify ingestion

4. **Frontend Integration**
   - ✅ Spotify button on Story Viewer page ([projects/[id]/page.tsx](storyme-app/src/app/(dashboard)/projects/[id]/page.tsx))
   - ✅ Dynamic button states: Default (gray) → Compiling (orange) → Published (blue) → Live (green)
   - ✅ Status checking on page load
   - ✅ Error handling and user feedback

5. **Documentation**
   - ✅ [PRE_TESTING_CHECKLIST.md](PRE_TESTING_CHECKLIST.md) - Setup verification steps
   - ✅ [SPOTIFY_TESTING_GUIDE.md](SPOTIFY_TESTING_GUIDE.md) - Comprehensive test scenarios
   - ✅ [NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md](NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md) - Manual tasks & future roadmap
   - ✅ [SPOTIFY_RSS_AUTOMATION_PLAN.md](SPOTIFY_RSS_AUTOMATION_PLAN.md) - Technical architecture
   - ✅ [CHECK_PUBLICATIONS_TABLE.sql](storyme-app/CHECK_PUBLICATIONS_TABLE.sql) - DB verification queries

---

## 🚨 Critical Issue Detected

**Error**: `Could not find the table 'public.publications' in the schema cache`

**Cause**: Database migration not yet applied to Supabase

**Impact**:
- RSS feed returns 500 error
- Publish button will fail when clicked
- No data persistence possible

**Fix Required**: Apply migration (see "Next Actions" below)

---

## 🎯 Next Actions (For You)

### Action 1: Apply Database Migration ⚠️ CRITICAL

**File**: [supabase/migrations/20251021_add_publications_generic.sql](storyme-app/supabase/migrations/20251021_add_publications_generic.sql)

**Steps**:
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/[your-project-id]
2. Click **SQL Editor** in left sidebar
3. Click **New Query**
4. Open the migration file above
5. Copy entire contents (123 lines)
6. Paste into SQL Editor
7. Click **Run** button
8. Should see: "Success. No rows returned"

**Verification**:
```bash
# In Supabase SQL Editor, run:
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'publications'
);
-- Should return: true
```

**Why Important**: Creates the core `publications` table that stores all publishing data for Spotify, KindleWood Kids App, and future platforms.

---

### Action 2: Verify Supabase Storage Bucket

**Bucket Name**: `story-audio-files`

**Steps**:
1. Go to Supabase Dashboard → **Storage** → **All Buckets**
2. Find bucket: `story-audio-files`
3. Click settings (gear icon)
4. Verify **"Public bucket"** is checked ✓

**If Bucket Doesn't Exist**:
1. Click **New Bucket**
2. Name: `story-audio-files`
3. Check **"Public bucket"** ✓
4. Click **Create bucket**

**Why Important**: Compiled MP3 audiobooks are uploaded here and must be publicly accessible for RSS feed enclosures.

---

### Action 3: Create Test Story with Audio (Optional but Recommended)

**Purpose**: Test the Spotify publish button before production deployment

**Steps**:
1. Open: http://localhost:3001/
2. Log in to your account
3. Create a new story (or use existing)
4. Ensure story has at least 2-3 scenes with text
5. Click **Generate Audio** for cover
6. Click **Generate Audio** for each scene
7. Wait for all audio generation to complete (green audio players)

**Verification**:
- Navigate to story from My Stories
- All scenes should have playable audio players 🎵
- Spotify button should appear at bottom (🎵 gray button)

---

### Action 4: Test Local Publishing (After Migration Applied)

**Guide**: Follow [SPOTIFY_TESTING_GUIDE.md](SPOTIFY_TESTING_GUIDE.md)

**Quick Test**:
1. Open story with audio: http://localhost:3001/projects/[story-id]
2. Scroll to bottom
3. Click **🎵 Spotify** button
4. Confirm dialog
5. Watch button change: Default → Compiling → Published
6. Check success message

**What to Verify**:
- Audio compilation completes (5-30 seconds)
- Database record created (`publications` table)
- Compiled MP3 accessible at public URL
- RSS feed includes episode: http://localhost:3001/api/podcast/feed.xml
- Button state persists on page refresh

**Troubleshooting**: See [SPOTIFY_TESTING_GUIDE.md](SPOTIFY_TESTING_GUIDE.md) section "Common Issues & Fixes"

---

### Action 5: Production Deployment (After Local Testing Passes)

**Guide**: See [NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md](NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md)

**Manual Tasks Required**:

1. **Create Professional Podcast Cover Art**
   - Size: 3000x3000px JPG/PNG
   - Requirements: KindleWood branding, readable at small sizes, no explicit content
   - Replace: [public/podcast-cover-art.svg](storyme-app/public/podcast-cover-art.svg)

2. **Set Up Email Alias**
   - Create: `podcast@kindlewood.com` (or your domain)
   - Required for Spotify for Podcasters account

3. **Deploy to Vercel**
   ```bash
   cd /home/gulbrand/Feifei/StoryMe/storyme-app
   vercel --prod
   ```
   - Ensure Supabase environment variables configured
   - Verify deployment succeeds

4. **Submit RSS Feed to Spotify**
   - Go to: https://podcasters.spotify.com/
   - Sign in with `podcast@kindlewood.com`
   - Submit RSS feed URL: `https://yourdomain.com/api/podcast/feed.xml`
   - Wait for approval (1-2 days)

5. **Test Production Publishing**
   - Publish a test story on production
   - Wait 1-6 hours for Spotify to poll RSS feed
   - Verify episode appears on Spotify

---

## 🏗️ Architecture Overview

### How It Works

```
User clicks "Publish to Spotify"
  ↓
POST /api/projects/[id]/publish-spotify
  ↓
1. Validate project ownership
2. Check audio exists for all scenes
3. Create publication record (status: 'compiling')
  ↓
AudioCompilationService.compileAudiobook()
  ↓
4. Download all scene audio files from Supabase Storage
5. Use FFmpeg to concatenate into single MP3
6. Upload compiled MP3 to Supabase Storage (public URL)
7. Calculate duration, file size
  ↓
8. Update publication record (status: 'published')
  ↓
GET /api/podcast/feed.xml
  ↓
9. RSS feed includes new episode with:
   - Title, author, description
   - Audio enclosure URL (compiled MP3)
   - Duration, cover image
   - GUID (unique identifier)
  ↓
Spotify polls RSS feed every 1-6 hours
  ↓
10. Episode automatically appears on Spotify
```

### Database Schema

**Table**: `publications`

**Key Fields**:
- `platform`: 'spotify', 'kindlewood_app', 'apple_podcasts', etc.
- `status`: 'pending' → 'compiling' → 'published' → 'live'
- `compiled_audio_url`: Public URL to MP3 audiobook
- `audio_duration_seconds`: Total duration
- `guid`: Unique identifier (e.g., `spotify-story-{projectId}`)
- `external_url`: Spotify episode URL (set when live)

**Constraint**: `UNIQUE(project_id, platform)` - One publication per project per platform

---

## 📁 File Structure

### New Files Created

```
storyme-app/
├── supabase/migrations/
│   └── 20251021_add_publications_generic.sql       ⚠️ APPLY THIS
│
├── src/
│   ├── lib/services/
│   │   └── audio-compilation.service.ts            ✅ Audio compilation logic
│   │
│   └── app/
│       └── api/
│           ├── projects/[id]/
│           │   ├── publish-spotify/route.ts        ✅ Publish endpoint
│           │   └── spotify-status/route.ts         ✅ Status endpoint
│           │
│           └── podcast/
│               └── feed.xml/route.ts               ✅ RSS feed
│
└── public/
    └── podcast-cover-art.svg                       🔄 Replace with professional design

Root Documentation:
├── PRE_TESTING_CHECKLIST.md                        📄 Setup verification
├── SPOTIFY_TESTING_GUIDE.md                        📄 Test scenarios
├── NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md           📄 Manual tasks & roadmap
├── SPOTIFY_RSS_AUTOMATION_PLAN.md                 📄 Technical architecture
└── CURRENT_STATUS_SPOTIFY_FEATURE.md              📄 This file
```

### Modified Files

```
storyme-app/src/app/(dashboard)/projects/[id]/page.tsx
  - Added Spotify button with 4 dynamic states
  - Added status checking on page load
  - Added handlePublishToSpotify() function
```

---

## 🔧 Technical Details

### Dependencies Added

```json
{
  "fluent-ffmpeg": "^2.1.3",
  "@ffmpeg-installer/ffmpeg": "^1.1.0",
  "@types/fluent-ffmpeg": "^2.1.27"
}
```

**Installed**: ✅ Verified via `npm list`

### Audio Format Specifications

- **Format**: MP3 (MPEG Audio Layer III)
- **Bitrate**: 128 kbps (CBR)
- **Sample Rate**: 44.1 kHz
- **Channels**: Stereo
- **Codec**: libmp3lame

### RSS Feed Specifications

- **Format**: RSS 2.0 with iTunes podcast extensions
- **Content-Type**: `application/rss+xml; charset=utf-8`
- **Cache**: 30 minutes (`max-age=1800`)
- **Validation**: Compatible with [Cast Feed Validator](https://castfeedvalidator.com/)

### Platform Support (Scalable Design)

The `publications` table supports multiple platforms without schema changes:

| Platform | Status | Implementation |
|----------|--------|----------------|
| Spotify | ✅ Complete | RSS feed automation |
| KindleWood Kids App | 🔜 Planned | Mobile app endpoint |
| Apple Podcasts | 🔜 Future | Same RSS feed |
| YouTube | 🔜 Future | API integration |
| SoundCloud | 🔜 Future | API integration |

**Adding New Platform**:
1. Create API route: `/api/projects/[id]/publish-{platform}`
2. Set `platform` field to new value (e.g., 'kindlewood_app')
3. Implement platform-specific publishing logic
4. Reuse `AudioCompilationService` for audio compilation
5. No database schema changes needed

---

## 🎨 User Interface

### Spotify Button States

| State | Appearance | Enabled | Tooltip |
|-------|-----------|---------|---------|
| **Default** | Gray bg, "🎵 Spotify" | ✅ Yes | "Publish this story to Spotify as a podcast episode" |
| **Compiling** | Orange bg, spinner + "Publishing..." | ❌ No | "Compiling audio for Spotify..." |
| **Published** | Blue bg, "Published" | ❌ No | "Published! Will appear on Spotify within 1-6 hours" |
| **Live** | Green bg, "On Spotify ✓" | ✅ Yes (opens URL) | "Live on Spotify! Click to view" |

### User Confirmation Dialog

When user clicks "Publish to Spotify":

```
Publish to Spotify?

Your story will be published as an episode on the KindleWood Stories podcast.
It will appear on Spotify within 1-6 hours.

Make sure you have generated audio for all scenes first.

Continue?
```

### Success Message

After successful publish:

```
✅ Your story has been published to the KindleWood podcast!
It will appear on Spotify within 1-6 hours.
```

---

## 🐛 Known Issues & Limitations

### Current Limitations

1. **Live Status Detection**: Button doesn't auto-update from "Published" to "Live"
   - **Workaround**: Manually update database `status='live'` when confirmed on Spotify
   - **Future**: Implement webhook from Spotify or cron job to check episode status

2. **Compilation Performance**: Audio compilation runs synchronously (blocks request)
   - **Impact**: Large stories (10+ scenes) may timeout on Vercel (30s limit)
   - **Workaround**: Keep stories under 10 scenes
   - **Future**: Move to background job queue (BullMQ, Inngest, etc.)

3. **Podcast Cover Art**: Currently using placeholder SVG
   - **Impact**: Not professional quality for Spotify submission
   - **Fix**: User must create 3000x3000px JPG (see Action 5 above)

4. **No Unpublish**: Once published, cannot be removed from RSS feed
   - **Workaround**: Manually delete from `publications` table
   - **Future**: Add "Unpublish" button (sets `status='unpublished'`, excludes from RSS)

5. **No Batch Publishing**: Can only publish one story at a time
   - **Workaround**: Click button on each story individually
   - **Future**: Add multi-select on My Stories page + bulk publish

---

## ✅ Checklist Before Production

- [ ] Database migration applied (`publications` table exists)
- [ ] Supabase Storage `story-audio-files` bucket is public
- [ ] Local testing completed (all scenarios in SPOTIFY_TESTING_GUIDE.md pass)
- [ ] Professional podcast cover art created (3000x3000px)
- [ ] Email alias `podcast@kindlewood.com` set up
- [ ] Production deployment successful (`vercel --prod`)
- [ ] RSS feed accessible: `https://yourdomain.com/api/podcast/feed.xml`
- [ ] RSS feed validates at castfeedvalidator.com
- [ ] Spotify for Podcasters account created
- [ ] RSS feed submitted to Spotify
- [ ] Waiting for Spotify approval (1-2 days)

---

## 📞 Support & Questions

**Documentation**:
- [PRE_TESTING_CHECKLIST.md](PRE_TESTING_CHECKLIST.md) - Setup steps
- [SPOTIFY_TESTING_GUIDE.md](SPOTIFY_TESTING_GUIDE.md) - Test scenarios
- [NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md](NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md) - Roadmap

**Troubleshooting**:
- Check browser DevTools Console (F12 → Console)
- Check terminal logs where dev server is running
- Check Supabase Dashboard → Logs → API Logs
- Check `publications` table for error messages

**Error Messages**:
- "publications table does not exist" → Apply migration (Action 1)
- "Failed to upload to storage" → Make bucket public (Action 2)
- "Please generate audio for all scenes" → Generate missing audio
- "Unauthorized" → Log out and log back in
- "Audio compilation failed" → Check FFmpeg installation

---

## 🚀 Next Steps Summary

**Immediate (Required for Testing)**:
1. ⚠️ Apply database migration in Supabase SQL Editor
2. Verify `story-audio-files` bucket is public
3. Create test story with audio (or use existing)
4. Run local tests (SPOTIFY_TESTING_GUIDE.md)

**Production (After Testing Passes)**:
5. Create professional podcast cover art
6. Deploy to Vercel production
7. Submit RSS feed to Spotify
8. Wait for approval & first episode to go live

**Future Enhancements**:
9. Implement KindleWood Kids App publishing
10. Add batch publishing from My Stories page
11. Add "Unpublish" functionality
12. Implement live status detection

---

**Current Status**: ✅ Code complete, ready for database migration and testing

**Dev Server**: Running on http://localhost:3001
**Environment**: Local development
**Last Updated**: October 21, 2025
