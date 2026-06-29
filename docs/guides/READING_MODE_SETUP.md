# Reading Mode Feature - Setup & Testing Guide

## Overview
The Reading Mode feature adds an immersive, full-screen storybook reader with optional audio narration using OpenAI TTS.

## Features Implemented
✅ Full-screen reading mode with page-by-page navigation
✅ Swipe gestures (mobile) + arrow buttons (all devices)
✅ Audio narration with OpenAI TTS
✅ Voice selection based on story tone
✅ Story-level audio toggle
✅ Auto-play when audio enabled
✅ Page progress indicators
✅ Keyboard navigation (arrow keys, spacebar, ESC)

---

## Setup Instructions

### 1. Database Migration

You need to apply the database migration to create the `story_audio_pages` table and storage bucket.

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `add-story-audio-pages.sql`
5. Click **Run**

**Option B: Using psql command line**

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Apply migration
psql $DATABASE_URL -f add-story-audio-pages.sql
```

### 2. Create Storage Bucket

In Supabase Dashboard:

1. Go to **Storage** → **Buckets**
2. Click **Create a new bucket**
3. Name: `story-audio-files`
4. **Public bucket**: YES (check the box)
5. Click **Create bucket**

Alternatively, run this SQL in the SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-audio-files', 'story-audio-files', true);
```

### 3. Verify Environment Variables

Make sure your `.env.local` has:

```bash
# OpenAI (for TTS)
OPENAI_API_KEY=sk-proj-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

✅ OpenAI API key is already configured in your `.env.local`

### 4. Install Dependencies

Dependencies are already installed:
- ✅ `openai` - OpenAI SDK
- ✅ `react-swipeable` - Swipe gesture support

### 5. Start Development Server

```bash
npm run dev
```

---

## Testing the Feature

### Test 1: View Reading Mode (Without Audio)

1. Go to **My Stories** (http://localhost:3000/projects)
2. Click on any existing story
3. Click the **"📖 Reading Mode"** button
4. You should see:
   - Full-screen reading view
   - Cover page with title
   - Swipe left/right to navigate (or use arrow buttons)
   - Page counter at bottom ("Page 1 of X")
   - Exit button (X) at top left

### Test 2: Generate Audio for a Story

Since audio generation is not yet integrated into the save workflow, you'll need to manually trigger it via API:

**Method 1: Using Browser Console**

1. Open a story page
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run this (replace `PROJECT_ID` with actual project ID from URL):

```javascript
fetch('/api/generate-story-audio', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId: 'PROJECT_ID' })
})
.then(r => r.json())
.then(d => console.log('Audio generation result:', d))
```

**Method 2: Using curl**

```bash
# Get auth token from browser (Application → Cookies → sb-access-token)
curl -X POST http://localhost:3000/api/generate-story-audio \
  -H "Content-Type: application/json" \
  -d '{"projectId":"YOUR_PROJECT_ID"}'
```

This will:
- Generate audio for each page (cover + all scenes)
- Upload MP3 files to Supabase storage
- Store URLs in `story_audio_pages` table
- Take ~20-50 seconds depending on story length

### Test 3: Reading Mode with Audio

After generating audio:

1. Click **"📖 Reading Mode"** button again
2. Click the **🔊 audio toggle** button (top right)
3. Audio should auto-play for each page
4. Navigate pages - audio should play for each new page
5. Click audio toggle again to disable

### Test 4: Mobile Experience

1. Open on mobile device (or use Chrome DevTools device emulation)
2. Enter Reading Mode
3. Test swipe gestures:
   - Swipe left → Next page
   - Swipe right → Previous page
4. Tap screen → Show/hide controls
5. Test audio on mobile

### Test 5: Voice Tones

Create stories with different tones and verify voices:

- **Playful** → Nova voice, faster speed
- **Educational** → Echo voice, moderate speed
- **Adventurous** → Onyx voice, dynamic
- **Calming/Gentle** → Shimmer voice, slower
- **Mysterious** → Fable voice, dramatic

---

## Troubleshooting

### Issue: "Unauthorized" Error
- Make sure you're logged in
- Check Supabase RLS policies are applied

### Issue: No Audio Button
- Generate audio first using the API call above
- Check browser console for errors

### Issue: Audio Not Playing
- Check browser allows autoplay (some browsers block it)
- Try clicking the audio toggle manually
- Check browser console for errors
- Verify audio files were uploaded to Supabase storage

### Issue: Images Not Loading in Reading Mode
- Check that project has cover_image_url (or it will use placeholder)
- Check that scenes have images generated

### Issue: Database Migration Failed
- Check that you're using PostgreSQL (Supabase uses Postgres)
- Verify you have permissions to create tables
- Check for typos in the SQL

### Issue: Storage Upload Failed
- Verify `story-audio-files` bucket exists
- Check bucket is public
- Verify storage RLS policies allow uploads

---

## Database Schema Reference

```sql
-- story_audio_pages table
CREATE TABLE story_audio_pages (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  page_number INT,
  page_type VARCHAR(20), -- 'cover' | 'scene'
  scene_id UUID,
  text_content TEXT,
  audio_url TEXT,
  audio_filename TEXT,
  audio_duration_seconds NUMERIC(6,2),
  voice_id VARCHAR(100),
  tone VARCHAR(50),
  generation_status VARCHAR(20), -- 'pending' | 'generating' | 'completed' | 'failed'
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## API Reference

### POST /api/generate-story-audio

Generate audio narration for all pages of a story.

**Request:**
```json
{
  "projectId": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generated audio for 10 pages",
  "totalPages": 10,
  "successfulPages": 10,
  "audioPages": [...]
}
```

### GET /api/projects/[id]/audio-pages

Get all audio pages for a project.

**Response:**
```json
{
  "audioPages": [...],
  "hasAudio": true
}
```

---

## Next Steps (Future Integration)

### Automatic Audio Generation on Save

To automatically generate audio when saving a project, we would need to:

1. Update `/api/projects` POST endpoint
2. Add background job queue (optional, for better UX)
3. Add audio generation status to project model

For now, audio must be generated manually via the API after saving.

### Optional: Add "Generate Audio" Button

You could add a button in the story view to manually trigger audio generation without using the console.

---

## Cost Estimates

**OpenAI TTS Pricing:**
- ~$0.015 per 1,000 characters
- Average story (10 pages, 100 chars each) = ~$0.015
- Very affordable for this use case

**Supabase Storage:**
- ~1-2 MB per story (10 pages)
- Free tier: 1 GB (500+ stories)

---

## Files Modified/Created

### New Files:
- `add-story-audio-pages.sql` - Database migration
- `src/app/api/generate-story-audio/route.ts` - Audio generation API
- `src/app/api/projects/[id]/audio-pages/route.ts` - Fetch audio pages API
- `src/components/story/ReadingModeViewer.tsx` - Reading mode component
- `READING_MODE_SETUP.md` - This file

### Modified Files:
- `src/lib/domain/models.ts` - Added StoryAudioPage types
- `src/app/(dashboard)/projects/[id]/page.tsx` - Added Reading Mode button and integration
- `package.json` - Added openai and react-swipeable dependencies

---

## Support

If you encounter issues, check:
1. Browser console for JavaScript errors
2. Network tab for failed API calls
3. Supabase logs for database/storage errors
4. OpenAI API usage dashboard for quota/errors

Happy testing! 🎉📖🔊
