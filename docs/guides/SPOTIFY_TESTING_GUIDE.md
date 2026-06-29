# Spotify Publishing - Local Testing Guide

**Status**: All automated implementation complete ✅
**Dev Server**: http://localhost:3002
**Created**: October 21, 2025

---

## 🎯 What We're Testing

The Spotify publishing feature allows users to:
1. Click "Publish to Spotify" button on Story Viewer page
2. System compiles all scene audio into single MP3 audiobook
3. Story is added to RSS podcast feed at `/api/podcast/feed.xml`
4. Spotify automatically polls RSS feed every 1-6 hours
5. Episode appears on Spotify without manual uploads

---

## ✅ Pre-Testing Checklist

Before testing the Spotify publish feature, verify:

- [ ] **Dev server running**: http://localhost:3002
- [ ] **Database migration applied**: `20251021_add_publications_generic.sql`
- [ ] **FFmpeg packages installed**: `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`
- [ ] **Supabase Storage bucket exists**: `story-audio-files` (public bucket)
- [ ] **User logged in**: Need authenticated session
- [ ] **Test story exists**: With at least 2-3 scenes
- [ ] **Audio generated**: All scenes must have audio (use "Generate Audio" button)

---

## 🧪 Test Scenario 1: First-Time Publish

### Steps:

1. **Navigate to Story Viewer**
   - Go to My Stories page: http://localhost:3002/projects
   - Click on a story that has audio for all scenes
   - Should see Story Viewer page with audio players

2. **Check Initial Button State**
   - Look for Spotify button (🎵 icon)
   - Should show: **"Spotify"** (gray background)
   - Tooltip: "Publish this story to Spotify as a podcast episode"
   - Button should be **enabled**

3. **Click "Publish to Spotify"**
   - Click the gray Spotify button
   - Should see confirmation dialog:
     ```
     Publish to Spotify?

     Your story will be published as an episode on the KindleWood Stories podcast.
     It will appear on Spotify within 1-6 hours.

     Make sure you have generated audio for all scenes first.

     Continue?
     ```
   - Click **OK**

4. **Observe Compilation Process**
   - Button should show: **"Publishing..."** with spinner
   - Button disabled during compilation
   - Check browser DevTools Console for logs
   - Check terminal for backend logs:
     ```
     ✨ Created new Spotify publication [uuid]
     🔊 Compiling audiobook for project [uuid]
     📥 Downloaded audio file: page-000.mp3
     📥 Downloaded audio file: page-001.mp3
     🎵 Concatenating 2 audio files...
     ⏱️ Audio duration: 180 seconds
     📤 Uploading to Supabase Storage...
     ✅ Publication [uuid] successfully published
     ```

5. **Verify Success State**
   - Should see success alert:
     ```
     ✅ Your story has been published to the KindleWood podcast!
     It will appear on Spotify within 1-6 hours.
     ```
   - Button should now show: **"Published"** (blue background)
   - Tooltip: "Published! Will appear on Spotify within 1-6 hours"
   - Button should be **disabled**

6. **Check Database**
   - Open Supabase dashboard → SQL Editor
   - Run:
     ```sql
     SELECT * FROM publications
     WHERE platform = 'spotify'
     ORDER BY requested_at DESC
     LIMIT 5;
     ```
   - Should see new record with:
     - `status`: 'published'
     - `compiled_audio_url`: Public URL to MP3
     - `audio_duration_seconds`: Total duration in seconds
     - `file_size_bytes`: File size
     - `published_at`: Timestamp
     - `title`, `author`, `description`: Story metadata
     - `guid`: Unique identifier like `spotify-story-[uuid]`

7. **Verify Compiled Audio File**
   - Copy `compiled_audio_url` from database
   - Open in browser or download
   - Should play complete story: cover audio + all scenes concatenated
   - Verify audio quality (128kbps MP3, 44.1kHz, stereo)

---

## 🧪 Test Scenario 2: RSS Feed Verification

### Steps:

1. **Access RSS Feed**
   - Navigate to: http://localhost:3002/api/podcast/feed.xml
   - Should see XML response (RSS 2.0 format)

2. **Verify Feed Structure**
   - Check feed metadata:
     ```xml
     <channel>
       <title>KindleWood Stories</title>
       <description>A magical podcast...</description>
       <language>en-us</language>
       <itunes:author>KindleWood Studio</itunes:author>
       <itunes:category text="Kids &amp; Family"/>
       <itunes:image href="https://[domain]/podcast-cover-art.jpg"/>
     </channel>
     ```

3. **Verify Episode Item**
   - Find your published story in `<item>` tag:
     ```xml
     <item>
       <title>Your Story Title</title>
       <description>Story description...</description>
       <pubDate>Mon, 21 Oct 2025 12:00:00 GMT</pubDate>
       <enclosure
         url="https://[supabase-storage-url]/audiobooks/[project-id]/[publication-id].mp3"
         length="2048576"
         type="audio/mpeg"/>
       <guid isPermaLink="false">spotify-story-[uuid]</guid>
       <itunes:author>Child Name (age 8)</itunes:author>
       <itunes:duration>180</itunes:duration>
       <itunes:image href="https://[cover-url]"/>
     </item>
     ```

4. **Validate RSS Feed**
   - Copy feed XML
   - Go to: https://castfeedvalidator.com/
   - Paste XML and validate
   - Should pass all RSS 2.0 and iTunes podcast requirements

---

## 🧪 Test Scenario 3: Button States

Test all 4 button states:

### State 1: Default (Not Published)
- **Appearance**: Gray background, "🎵 Spotify" text
- **Enabled**: Yes
- **Tooltip**: "Publish this story to Spotify as a podcast episode"

### State 2: Compiling
- **Appearance**: Orange background, spinner + "Publishing..." text
- **Enabled**: No (disabled)
- **Tooltip**: "Compiling audio for Spotify..."
- **Trigger**: During audio compilation (usually 5-30 seconds)

### State 3: Published
- **Appearance**: Blue background, "Published" text
- **Enabled**: No (disabled)
- **Tooltip**: "Published! Will appear on Spotify within 1-6 hours"
- **Database**: `status = 'published'`

### State 4: Live (Future)
- **Appearance**: Green background, "On Spotify ✓" text
- **Enabled**: Yes (clickable to view)
- **Tooltip**: "Live on Spotify! Click to view"
- **Database**: `status = 'live'` (set manually or via webhook in future)

---

## 🧪 Test Scenario 4: Error Handling

### Test 4a: Missing Audio

1. Create a new story without generating audio for all scenes
2. Click "Publish to Spotify"
3. **Expected**: Should see error alert:
   ```
   ❌ Please generate audio for all scenes before publishing to Spotify

   Has audio: 1
   Required: 3
   ```

### Test 4b: Already Published

1. Go to a story that's already published to Spotify
2. Button should already show "Published" (blue, disabled)
3. Try clicking anyway (should be disabled)
4. **Expected**: Button remains disabled, no API call made

### Test 4c: Compilation Failure

1. Temporarily break FFmpeg (rename `node_modules/@ffmpeg-installer`)
2. Try publishing
3. **Expected**:
   - Error alert: "❌ Audio compilation failed"
   - Database: `status = 'failed'`, `error_message` populated
   - Button returns to default state (gray, enabled)
4. Restore FFmpeg and retry

---

## 🧪 Test Scenario 5: Status Persistence

### Steps:

1. Publish a story to Spotify (follow Scenario 1)
2. After success, **refresh the page** (F5)
3. **Expected**:
   - Button should still show "Published" (blue)
   - Status persisted from database
4. Navigate away and back to story
5. **Expected**:
   - Button state still persists (blue, disabled)

---

## 🧪 Test Scenario 6: Multiple Stories

### Steps:

1. Create 3 different stories with audio
2. Publish Story A to Spotify → Success
3. Publish Story B to Spotify → Success
4. Publish Story C to Spotify → Success
5. Check RSS feed: http://localhost:3002/api/podcast/feed.xml
6. **Expected**:
   - All 3 stories appear as separate `<item>` entries
   - Ordered by `published_at` (most recent first)
   - Each has unique `guid`

---

## 🧪 Test Scenario 7: Database Constraints

### Steps:

1. Open Supabase SQL Editor
2. Try to insert duplicate publication:
   ```sql
   INSERT INTO publications (project_id, user_id, platform, title, author, description, guid, status)
   VALUES (
     '[existing-project-id]',
     '[user-id]',
     'spotify',
     'Test Story',
     'Test Author',
     'Test description',
     'test-guid-123',
     'published'
   );
   ```
3. **Expected**:
   - Error: `duplicate key value violates unique constraint "unique_project_platform"`
   - This ensures one Spotify publication per project

---

## 📊 Expected Database Schema

After successful publish, `publications` table should have:

```sql
id                      | uuid (primary key)
project_id              | uuid (foreign key to projects)
user_id                 | uuid (foreign key to users)
platform                | 'spotify'
compiled_audio_url      | https://[supabase].storage/.../.mp3
audio_duration_seconds  | 180 (example)
file_size_bytes         | 2048576 (example)
title                   | "My Amazing Story"
author                  | "Emma (age 8)"
description             | "A magical adventure..."
external_id             | null (set when Spotify assigns episode ID)
external_url            | null (set when live on Spotify)
guid                    | "spotify-story-[project-uuid]"
status                  | 'published'
platform_metadata       | {} (JSON, currently empty)
requested_at            | 2025-10-21 12:00:00+00
compiled_at             | 2025-10-21 12:00:15+00
published_at            | 2025-10-21 12:00:15+00
live_at                 | null (set later)
unpublished_at          | null
error_message           | null
retry_count             | 0
```

---

## 🐛 Common Issues & Fixes

### Issue 1: "Failed to compile audio"
- **Cause**: FFmpeg not installed or audio files inaccessible
- **Fix**: Check terminal logs, verify `node_modules/@ffmpeg-installer/ffmpeg` exists
- **Fix**: Verify Supabase Storage `story-audio-files` bucket is public

### Issue 2: Button stuck on "Compiling..."
- **Cause**: API request timed out or failed silently
- **Fix**: Check browser DevTools Network tab for failed requests
- **Fix**: Check database - if `status = 'compiling'` for >5 minutes, manually update to 'failed'

### Issue 3: RSS feed shows 404
- **Cause**: Route not compiled or server not running
- **Fix**: Verify `src/app/api/podcast/feed.xml/route.ts` exists
- **Fix**: Restart dev server

### Issue 4: Audio URL returns 404
- **Cause**: Supabase Storage bucket not public or file upload failed
- **Fix**: Go to Supabase Dashboard → Storage → `story-audio-files` bucket → Make public
- **Fix**: Check database `compiled_audio_url` - should be public URL

### Issue 5: "Unauthorized" error
- **Cause**: User session expired
- **Fix**: Log out and log back in
- **Fix**: Check `supabase.auth.getUser()` returns valid user

---

## 🎉 Success Criteria

All tests pass if:

- ✅ User can click "Publish to Spotify" on story with audio
- ✅ Button shows all 4 states correctly (default, compiling, published, live)
- ✅ Audio compilation completes without errors (5-30 seconds)
- ✅ Database record created with status='published'
- ✅ Compiled MP3 file accessible at public URL
- ✅ RSS feed includes published story as `<item>`
- ✅ RSS feed validates at castfeedvalidator.com
- ✅ Multiple stories can be published independently
- ✅ Button state persists across page refreshes
- ✅ Error messages appear for missing audio or failures
- ✅ Duplicate publications prevented by database constraint

---

## 🚀 Next Steps After Local Testing

Once all tests pass locally:

1. **User Manual Tasks** (see NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md):
   - Create professional podcast cover art (3000x3000px JPG)
   - Set up `podcast@kindlewood.com` email
   - Deploy to production with `vercel --prod`
   - Submit RSS feed to Spotify for Podcasters
   - Wait for approval (1-2 days)

2. **Production Verification**:
   - Test publish on production URL
   - Verify RSS feed accessible publicly
   - Wait for Spotify to poll feed
   - Check episode appears on Spotify (1-6 hours)

3. **Future Enhancements**:
   - Implement "Live" status detection (webhook or cron job)
   - Add KindleWood Kids App publishing
   - Add batch publishing from My Stories page
   - Add unpublish functionality

---

## 📝 Testing Notes

Use this space to record your testing results:

**Test Date**: ________________
**Tester**: ________________
**Environment**: Local / Production

| Test Scenario | Pass/Fail | Notes |
|--------------|-----------|-------|
| First-Time Publish | ⬜ | |
| RSS Feed Verification | ⬜ | |
| Button States | ⬜ | |
| Error Handling | ⬜ | |
| Status Persistence | ⬜ | |
| Multiple Stories | ⬜ | |
| Database Constraints | ⬜ | |

**Overall Result**: ⬜ Pass / ⬜ Fail

---

## 🔗 Related Documentation

- **NEXT_STEPS_SPOTIFY_KINDLEWOOD_APP.md** - Implementation roadmap and manual tasks
- **SPOTIFY_RSS_AUTOMATION_PLAN.md** - Technical architecture and design decisions
- **Story-me-next-step-1021.md** - Original project planning document

---

**Questions?** Check terminal logs, browser DevTools console, and Supabase logs.
