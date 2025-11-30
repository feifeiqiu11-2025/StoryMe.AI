# StoryMe.AI Studio Development Summary

Last Updated: 2025-11-24

---

## Project Overview

**StoryMe.AI Studio** is a Next.js web application where users create personalized children's stories with:
- AI-powered story generation
- Image generation (DALL-E, Stable Diffusion)
- Bilingual audio narration (English/Chinese)
- User-recorded audio support
- Quiz generation
- Community story sharing

**Platform**: Web (Vercel deployment)
**Tech Stack**: Next.js 15.5.4, TypeScript, Supabase, OpenAI

---

## Recent Major Fixes & Features

### 1. Bilingual Audio Recording Support (2025-11-24)

**Status**: ✅ Deployed to Production

#### Problem
User-recorded Chinese audio was overwriting English AI TTS audio, preventing bilingual stories from having both language options available simultaneously.

#### Root Causes

1. **Wrong Database Field**: Chinese recordings saved to `audio_url` instead of `audio_url_zh`
2. **Destructive Save Logic**: API used DELETE+INSERT pattern that removed existing English audio
3. **Missing Auto-Detection**: AudioRecorder always defaulted to English regardless of story language

#### Solutions Implemented

**A. Bilingual Database Schema**
```sql
-- story_audio_pages table structure
audio_url TEXT,      -- English audio
audio_url_zh TEXT,   -- Chinese audio
language TEXT,       -- Primary language indicator
```

Both fields can exist simultaneously for truly bilingual stories.

**B. Non-Destructive Updates**
Changed API logic from:
```javascript
// ❌ Old (destructive)
await supabase.from('story_audio_pages').delete()...
await supabase.from('story_audio_pages').insert()...
```

To:
```javascript
// ✅ New (preserves existing audio)
const existingPage = await supabase.from('story_audio_pages').select()...
if (existingPage) {
  await supabase.from('story_audio_pages').update({
    [audioUrlField]: publicUrl  // audio_url_zh for Chinese
  })...
} else {
  await supabase.from('story_audio_pages').insert()...
}
```

**C. Smart Language Detection**
```javascript
// Auto-detect Chinese content
<AudioRecorder
  defaultLanguage={
    story?.scenes?.some((scene: any) => scene.captionChinese)
      ? 'zh'
      : 'en'
  }
/>
```

#### Key Files Changed

| File | Purpose | Lines Modified |
|------|---------|----------------|
| `src/app/api/upload-user-audio/route.ts` | Bilingual save logic | 229-322 |
| `src/app/stories/[id]/page.tsx` | Language auto-detection | 631-635 |
| `src/components/story/AudioRecorder.tsx` | Codec fallback | 141-181 |
| `src/app/(dashboard)/projects/[id]/page.tsx` | Inline recorder fixes | 318-395 |

#### Testing Commands

```bash
# Check audio status for a story
cd /Users/feifei/StoryMe.AI/storyme-app

NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
npx ts-node --transpile-only scripts/check-audio.ts

# Check detailed field structure
npx ts-node --transpile-only scripts/check-audio-detail.ts
```

**Expected Output**:
```
Page 1: audio_url: EXISTS, audio_url_zh: EXISTS
Page 2: audio_url: EXISTS, audio_url_zh: EXISTS
```

#### Impact
- ✅ Users can record both English AND Chinese audio
- ✅ Language selector (EN/中) appears in reading mode
- ✅ No data loss when adding bilingual audio
- ✅ Existing English AI TTS preserved when adding Chinese recordings

---

### 2. MediaRecorder Codec Compatibility Fix (2025-11-24)

**Status**: ✅ Deployed to Production

#### Problem
Audio recording failed on macOS Chrome with error:
```
NotSupportedError: Failed to execute 'start' on 'MediaRecorder': 
There was an error starting the MediaRecorder.
```

#### Root Cause
- `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` returns `true` on macOS
- But actual MediaRecorder instantiation fails
- Browser reports false positives for codec support

#### Solution: Robust Codec Fallback

Implemented try-catch loop through multiple codecs:

```javascript
const codecOptions = [
  { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 },
  { mimeType: 'audio/webm', audioBitsPerSecond: 128000 },
  { mimeType: 'audio/mp4', audioBitsPerSecond: 128000 },
  { mimeType: 'audio/ogg;codecs=opus', audioBitsPerSecond: 128000 },
  {}, // Browser default fallback
];

for (const options of codecOptions) {
  try {
    if (options.mimeType && !MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log(`❌ Codec not supported: ${options.mimeType}`);
      continue;
    }
    
    recorder = new MediaRecorder(stream, options);
    console.log(`✅ Using codec: ${options.mimeType || 'browser default'}`);
    break; // Success!
  } catch (err) {
    console.warn(`Failed with ${options.mimeType}:`, err);
    continue; // Try next codec
  }
}

if (!recorder) {
  throw new Error('No supported audio codec found');
}
```

#### Diagnostic Logging Added

Browser console now shows detailed recording flow:
```
✅ Using codec: audio/webm
📦 Audio chunk received: 12345 bytes, type: audio/webm
📦 Audio chunk received: 23456 bytes, type: audio/webm
🛑 Recording stopped. Total chunks: 5, Recorder mimeType: audio/webm
📝 Created blob: 123456 bytes, type: audio/webm
✅ Recorded page 1 - 8s, URL: blob:http://localhost:3000/...
```

#### Files Modified

| Component | File | Lines |
|-----------|------|-------|
| Modal Recorder | `src/components/story/AudioRecorder.tsx` | 141-181, 360-387 |
| Inline Recorder | `src/app/(dashboard)/projects/[id]/page.tsx` | 318-395, 463-492 |

#### Impact
- ✅ Recording works on macOS Chrome
- ✅ Cross-browser compatibility improved
- ✅ Better debugging with console logs
- ✅ Graceful fallback when codecs fail

---

### 3. Reading Mode Bilingual Audio Player

**Status**: ✅ Production Feature

#### How It Works

**API Endpoint**: `/api/projects/[id]/audio-pages`

Returns:
```json
{
  "pages": [
    {
      "page_number": 1,
      "audio_url": "https://.../page-1-en.mp3",
      "audio_url_zh": "https://.../page-1-zh.mp3"
    }
  ],
  "hasEnglishAudio": true,
  "hasChineseAudio": true,
  "availableLanguages": ["en", "zh"]
}
```

**Reading Mode Component**: `src/components/story/ReadingModeViewer.tsx`

**Bilingual Detection**:
```javascript
const hasEnglishAudio = pages.some(p => p.audioUrl);
const hasChineseAudio = pages.some(p => p.audioUrlZh);
const hasBilingualAudio = hasEnglishAudio && hasChineseAudio;
```

**Audio URL Selection**:
```javascript
const getCurrentAudioUrl = (page) => {
  if (audioLanguage === 'zh' && page.audioUrlZh) {
    return page.audioUrlZh;  // Play Chinese
  }
  return page.audioUrl;       // Play English (default)
};
```

**Language Toggle UI** (only shows if bilingual):
```jsx
{hasBilingualAudio && (
  <button onClick={toggleLanguage}>
    {audioLanguage === 'en' ? 'EN' : '中'}
  </button>
)}
```

#### Features
- Auto-play audio narration page by page
- Language toggle button (EN/中)
- Browser autoplay policy handling
- Progress tracking
- Audio caching for performance

#### Key Files

| File | Purpose |
|------|---------|
| `src/components/story/ReadingModeViewer.tsx` | Audio player UI & logic |
| `src/app/api/projects/[id]/audio-pages/route.ts` | Bilingual audio data API |
| `src/app/(dashboard)/projects/[id]/page.tsx` | Project viewer integration |

---

## Database Schema

### `story_audio_pages` Table

```sql
CREATE TABLE story_audio_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  page_number INT NOT NULL,
  page_type TEXT,  -- 'cover', 'scene', 'quiz_question', 'quiz_transition'
  scene_id UUID,
  quiz_question_id UUID,
  
  -- Bilingual audio URLs
  audio_url TEXT,           -- English audio
  audio_url_zh TEXT,        -- Chinese audio
  audio_filename TEXT,      -- Shared filename (no _zh variant)
  audio_duration_seconds INT,
  
  -- Metadata
  audio_source TEXT,        -- 'user_recorded' or 'ai_tts'
  language TEXT,            -- Primary language: 'en' or 'zh'
  voice_profile_id UUID,
  recorded_by_user_id UUID,
  generation_status TEXT,   -- 'pending', 'processing', 'completed', 'failed'
  recording_metadata JSONB,
  
  text_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, page_number)
);

CREATE INDEX idx_story_audio_pages_project ON story_audio_pages(project_id);
CREATE INDEX idx_story_audio_pages_scene ON story_audio_pages(scene_id);
```

**Important Notes**:
- `audio_url` and `audio_url_zh` can BOTH exist for bilingual content
- `language` field indicates primary language (not exclusive)
- `audio_filename_zh` column does NOT exist (caused earlier bugs)
- UNIQUE constraint on `(project_id, page_number)` prevents duplicates

---

## Audio Recording Flow

### 1. User Interface
Two recording interfaces:
- **Modal Recorder**: `src/components/story/AudioRecorder.tsx` (used in public story view)
- **Inline Recorder**: `src/app/(dashboard)/projects/[id]/page.tsx` (used in project editor)

### 2. Recording Process

```javascript
// 1. Request microphone access
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Create MediaRecorder with codec fallback
const recorder = new MediaRecorder(stream, options);

// 3. Collect audio chunks
recorder.ondataavailable = (e) => {
  chunks.push(e.data);
};

// 4. Create blob when stopped
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: recorder.mimeType });
  const url = URL.createObjectURL(blob);
  // Save for preview
};

// 5. Upload when user clicks "Save"
const formData = new FormData();
formData.append('projectId', projectId);
formData.append('language', language);  // 'en' or 'zh'
formData.append('audio_1', blob, 'page-1.webm');

await fetch('/api/upload-user-audio', { method: 'POST', body: formData });
```

### 3. Backend Processing

**API Route**: `src/app/api/upload-user-audio/route.ts`

```javascript
// 1. Receive WebM audio from browser
const audioFile = formData.get('audio_1');
const language = formData.get('language') || 'en';

// 2. Convert WebM to MP3 (iOS compatibility)
const mp3Buffer = await convertWebmToMp3(buffer);

// 3. Upload to Supabase Storage
await supabase.storage.from('story-audio-files').upload(filename, mp3Buffer);

// 4. Save to database (bilingual support)
const audioUrlField = language === 'zh' ? 'audio_url_zh' : 'audio_url';

const existingPage = await supabase
  .from('story_audio_pages')
  .select('*')
  .eq('project_id', projectId)
  .eq('page_number', pageNumber)
  .single();

if (existingPage) {
  // UPDATE - preserve other language
  await supabase.from('story_audio_pages').update({
    [audioUrlField]: publicUrl,
    audio_source: 'user_recorded',
    language: existingPage.audio_url && existingPage.audio_url_zh 
      ? existingPage.language  // Keep original if both exist
      : language
  })...
} else {
  // INSERT new record
  await supabase.from('story_audio_pages').insert({
    [audioUrlField]: publicUrl,
    audio_source: 'user_recorded',
    language: language
  })...
}
```

### 4. Audio Format Conversion

**Why Convert**: iOS Safari cannot play WebM audio format.

**FFmpeg Conversion**:
```javascript
import ffmpeg from 'fluent-ffmpeg';

async function convertWebmToMp3(webmBuffer) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(Readable.from(webmBuffer))
      .inputFormat('webm')
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .format('mp3')
      .on('end', () => resolve(mp3Buffer))
      .on('error', reject);
  });
}
```

---

## Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (for AI TTS and story generation)
OPENAI_API_KEY=sk-proj-...

# Stability AI (for image generation)
STABILITY_API_KEY=sk-...

# Authentication
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

### Local Development

```bash
# Copy example env file
cp .env.example .env.local

# Add your API keys
# Then start dev server
npm run dev
```

---

## Deployment

### Vercel Configuration

**Platform**: Vercel
**Framework**: Next.js 15.5.4
**Node Version**: 18.x
**Auto-Deploy**: Yes (on push to main branch)

### Environment Variables in Vercel

All environment variables must be set in Vercel dashboard:
1. Go to project settings
2. Environment Variables section
3. Add production values

### Deploy Process

```bash
# Commit changes
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin main

# Vercel auto-deploys within 1-2 minutes
```

### Build Command
```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next"
}
```

---

## Utility Scripts

### Check Audio Pages

```bash
# See all audio pages for a story
cd /Users/feifei/StoryMe.AI/storyme-app

NEXT_PUBLIC_SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
npx ts-node --transpile-only scripts/check-audio.ts
```

**Output**:
```
📊 Total audio pages found: 21
📝 Breakdown by language:
  en: 21 pages
  zh: 3 pages
🎙️ Breakdown by source:
  user_recorded: 3 pages
  ai_tts: 18 pages
```

### Check Detailed Audio Fields

```bash
npx ts-node --transpile-only scripts/check-audio-detail.ts
```

**Output**:
```
Page 1: audio_url: EXISTS, audio_url_zh: EXISTS
Page 2: audio_url: EXISTS, audio_url_zh: NULL
```

### Delete User Recordings

```bash
npx ts-node --transpile-only scripts/delete-audio.ts
```

### Reset User Audio for Testing

```bash
npx ts-node --transpile-only scripts/reset-user-audio.ts
```

---

## API Routes

### Key Endpoints

| Endpoint | Purpose | Method |
|----------|---------|--------|
| `/api/upload-user-audio` | Upload recorded audio | POST |
| `/api/generate-story-audio` | Generate AI TTS audio | POST |
| `/api/projects/[id]/audio-pages` | Get audio pages | GET |
| `/api/stories/public/[id]` | Get public story | GET |

### Upload Audio API

**Endpoint**: `POST /api/upload-user-audio`

**Request**:
```javascript
const formData = new FormData();
formData.append('projectId', 'uuid');
formData.append('language', 'zh');  // 'en' or 'zh'
formData.append('voiceProfileName', "User's Voice");
formData.append('audioMetadata', JSON.stringify([
  {
    pageNumber: 1,
    pageType: 'cover',
    textContent: 'Story Title',
    duration: 5.2
  }
]));
formData.append('audio_1', blob, 'page-1.webm');
```

**Response**:
```json
{
  "success": true,
  "successfulPages": 1,
  "failedPages": [],
  "voiceProfile": {
    "id": "uuid",
    "name": "User's Voice"
  }
}
```

### Audio Pages API

**Endpoint**: `GET /api/projects/[id]/audio-pages`

**Response**:
```json
{
  "pages": [
    {
      "page_number": 1,
      "page_type": "cover",
      "audio_url": "https://.../page-1-en.mp3",
      "audio_url_zh": "https://.../page-1-zh.mp3",
      "audio_duration_seconds": 5,
      "audio_source": "user_recorded",
      "language": "zh"
    }
  ],
  "hasAudio": true,
  "hasEnglishAudio": true,
  "hasChineseAudio": true,
  "availableLanguages": ["en", "zh"]
}
```

---

## Git History

### Recent Commits

```bash
416dd16 - Fix audio recording for bilingual support and codec compatibility
99a136d - Previous features
```

### Commit Message Format

```
Brief summary (50 chars max)

## Detailed Changes

### 1. Feature Name
- What changed
- Why it changed
- Impact

### 2. Another Feature
...

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Troubleshooting

### Recording Not Working

**Symptoms**: Click record, nothing happens

**Debug Steps**:
1. Open browser console (Cmd+Option+J)
2. Look for errors
3. Check for codec fallback logs
4. Verify microphone permissions

**Common Issues**:
- Browser blocked microphone access
- No supported codec found
- HTTPS required (mic access)

### Audio Not Saving

**Symptoms**: Recording succeeds but doesn't appear in database

**Check**:
```bash
# Check database directly
npx ts-node --transpile-only scripts/check-audio.ts
```

**Common Issues**:
- Network error during upload
- FFmpeg conversion failed
- Storage upload failed
- Database constraint violation

### Language Selector Not Appearing

**Required Conditions**:
- `audio_url` must exist (English)
- `audio_url_zh` must exist (Chinese)
- API must return `hasChineseAudio: true`

**Debug**:
```bash
# Check both fields exist
npx ts-node --transpile-only scripts/check-audio-detail.ts

# Check API response
curl http://localhost:3000/api/projects/[id]/audio-pages
```

### Vercel Build Failing

**Check**:
1. Vercel dashboard → Deployments → View logs
2. Look for TypeScript errors
3. Verify environment variables set
4. Test build locally: `npm run build`

---

## Related Repositories

### KindleWoodKids (Flutter App)
**Path**: `/Users/feifei/KindleWoodKids`
**Purpose**: Read community stories, play games
**Platforms**: iOS (App Store), Web (Vercel)

### kindlewood_games (Flutter Package)
**Path**: `/Users/feifei/kindlewood_games`
**Repository**: https://github.com/feifeiqiu11-2025/kindlewood_games
**Purpose**: Educational games library

---

## Future Enhancements

### Audio Features
- [ ] Batch upload multiple pages at once
- [ ] Audio editing/trimming interface
- [ ] Waveform visualization during recording
- [ ] Background music mixing
- [ ] Audio normalization/compression

### Language Support
- [ ] Spanish audio (es)
- [ ] French audio (fr)
- [ ] Automatic language detection from text
- [ ] Multi-language UI support

### Performance
- [ ] Audio streaming (progressive loading)
- [ ] CDN optimization for audio files
- [ ] Client-side audio caching
- [ ] Lazy loading for long stories

### User Experience
- [ ] Visual feedback during recording
- [ ] Preview before save
- [ ] Undo/redo for recordings
- [ ] Recording templates/presets

---

## Documentation

### This SUMMARY.md
Updated when:
- New features deployed
- Database schema changes
- API changes
- Known issues discovered
- Configuration changes

### Other Documentation
- `README.md` - Project setup and getting started
- `CONTRIBUTING.md` - Development guidelines
- API docs - `/docs/api/` directory
- Component docs - Inline JSDoc comments

---

## Support & Contact

For technical issues:
1. Check this SUMMARY.md for common solutions
2. Review git commit history for recent changes
3. Check Vercel deployment logs
4. Review browser console errors

