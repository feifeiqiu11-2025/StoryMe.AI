# StoryMe.AI Studio Development Summary

Last Updated: 2025-12-03

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

---

## Image Generation System (2025-12-02)

### Overview

The app generates AI illustrations for:
1. **Character Previews** - Portrait-style images when characters are created
2. **Scene Images** - Story page illustrations with characters in action
3. **Cover Images** - Book cover artwork for the story

All image generation uses **Google Gemini 2.0 Flash** with reference photos for character consistency.

---

### API Comparison: Why Gemini?

| Feature | Gemini 2.0 Flash | Fal.ai (FLUX LoRA) | DALL-E 3 |
|---------|------------------|---------------------|----------|
| **Reference Photos** | ✅ Uses actual photos | ❌ Text descriptions only | ❌ Text only |
| **Character Consistency** | ✅ Excellent (same face) | ⚠️ Poor (varies per scene) | ❌ No consistency |
| **Multi-Character** | ✅ Up to 5 references | ⚠️ Primary only | ❌ N/A |
| **Speed** | ~8-15 seconds | ~10-20 seconds | ~15-30 seconds |
| **Cost** | Free tier available | Pay per image | $0.04-0.08/image |
| **Aspect Ratio** | Square via prompt | Native support | 1024x1024 |
| **Prompt Following** | ✅ Good | ⚠️ Sometimes ignores | ✅ Good |

**Decision**: Gemini was chosen because:
1. **Character consistency** - Can actually use reference photos to maintain same face/features
2. **Multi-character support** - Can include up to 5 reference images
3. **Cost effective** - Free tier for development
4. **Quality** - Good balance of style and character recognition

**Fal.ai limitations we encountered**:
- Human-animal hybrid issues (characters merged with animals)
- Clothing kept changing between scenes
- Reference images were largely ignored
- Negative prompts didn't fully prevent issues

---

### Prompting Strategy

#### Unified Template Structure

Both 2D and 3D styles use a simplified, consistent prompt structure:

```
Create a [2D/3D] children's book illustration: ${sceneDescription}

STYLE: [style-specific details]. Square 1:1.

IMPORTANT:
- Generate an ILLUSTRATED image, NOT a photograph
- Reference photos show face/hair features only - transform into illustrated characters
- NO religious figures (Jesus, Buddha, etc.)

CHARACTERS:
${characterDescriptions}
- Keep clothing consistent unless scene specifies costume/role/holiday
${hasAnimalCharacters ? '- Animals: illustrated style, NO human clothing, NO hybrids.' : ''}
${hasAnimalsInScene && hasHumanCharacters ? '- Humans and animals completely separate.' : ''}
```

#### Key Prompt Rules (Lessons Learned)

1. **Never Real Photos**: Always include "NOT a photograph" - models can paste reference photos otherwise
2. **Clothing Consistency**: Base outfit from character description, only change for roles/holidays/costumes
3. **No Human-Animal Hybrids**: Explicit instruction to keep humans and animals separate
4. **No Religious Figures**: Prevent generation of Jesus, Buddha, etc.
5. **Style First**: Clearly state 2D or 3D at the start
6. **Concise Prompts**: Long prompts get ignored - keep under 500 characters

#### 2D Classic Style
```
STYLE: Hand-drawn 2D cartoon illustration, soft watercolor/gouache, warm pastel colors, large expressive eyes.
```

#### 3D Pixar Style
```
STYLE: 3D animated Pixar/Disney style, soft rounded features, vibrant colors, large expressive eyes.
```

---

### Character Type Detection

Characters can be humans (from photo) or animals (from description).

**Detection Flow**:
1. During character creation, user chooses "From Photo" or "From Description"
2. For "From Description" characters, AI analyzes if it's an animal
3. `isAnimal` flag is stored in `description.isAnimal`
4. This flag determines prompt rules (no clothing for animals, separation rules)

**Key Function**: `buildSmartCharacterPrompt()` in [gemini-image-client.ts:365-439](src/lib/gemini-image-client.ts#L365-L439)

```typescript
// Checks isAnimal flag set during character creation
const isAnimal = description.isAnimal === true;

if (isAnimal) {
  // Animals: just use description, no clothing logic
  return { prompt: charContext, isAnimal: true };
}

// Humans: apply clothing priority logic
// 1. Scene-specific role (doctor costume, swimsuit)
// 2. Base outfit from description
// 3. Theme clothing (Christmas pajamas)
// 4. Default casual clothes
```

---

### Key Files

#### Image Generation Core

| File | Purpose | Key Functions |
|------|---------|---------------|
| [src/lib/gemini-image-client.ts](src/lib/gemini-image-client.ts) | Main Gemini API client | `generateImageWithGemini()`, `generateImageWithGeminiClassic()`, `generateCharacterPreview()` |
| [src/lib/fal-client.ts](src/lib/fal-client.ts) | Legacy Fal.ai client (unused) | `generateImageWithMultipleCharacters()` |

#### API Routes

| File | Purpose | When Called |
|------|---------|-------------|
| [src/app/api/generate-cover/route.ts](src/app/api/generate-cover/route.ts) | Generate book cover | Story creation, cover regeneration |
| [src/app/api/generate-scene-image/route.ts](src/app/api/generate-scene-image/route.ts) | Generate scene images | Story generation, scene regeneration |
| [src/app/api/generate-character-preview/route.ts](src/app/api/generate-character-preview/route.ts) | Generate character portraits | Character creation |

#### Character Management

| File | Purpose |
|------|---------|
| [src/app/(dashboard)/characters/page.tsx](src/app/(dashboard)/characters/page.tsx) | Character library UI |
| [src/components/character/CharacterFormModal.tsx](src/components/character/CharacterFormModal.tsx) | Create/edit character form |
| [src/lib/types/story.ts](src/lib/types/story.ts) | Character types & interfaces |

#### Story Creation

| File | Purpose |
|------|---------|
| [src/app/(dashboard)/create/page.tsx](src/app/(dashboard)/create/page.tsx) | Story creation wizard |
| [src/lib/ai/scene-enhancer.ts](src/lib/ai/scene-enhancer.ts) | Enhance scene descriptions, detect character types |

---

### API Call Flow

#### Character Preview Generation

```
User creates character → CharacterFormModal
  ↓
POST /api/generate-character-preview
  ↓
gemini-image-client.ts: generateCharacterPreview() or generateCharacterPreviewClassic()
  ↓
Gemini API with reference photo
  ↓
Base64 image returned → Upload to Supabase → Display in UI
```

#### Scene Image Generation

```
User generates story → Create page
  ↓
scene-enhancer.ts: enhanceSceneDescriptions()
  - Adds details to scene descriptions
  - Detects characterTypes [{name, isAnimal}]
  ↓
For each scene: POST /api/generate-scene-image
  ↓
gemini-image-client.ts: generateImageWithGemini() or generateImageWithGeminiClassic()
  - buildSmartCharacterPrompt() for each character
  - Fetch reference photos as base64
  - Build prompt with rules
  ↓
Gemini API with reference photos
  ↓
Base64 image → Upload to Supabase → Store URL in project
```

#### Cover Image Generation

```
Story created → Cover generation triggered
  ↓
POST /api/generate-cover
  ↓
Uses SAME generateImageWithGemini/Classic functions as scenes
  - Ensures style consistency
  ↓
Gemini API with character references
  ↓
Base64 image → Upload to Supabase → Display as cover
```

---

### Gemini API Usage

#### Initialization
```typescript
import { GoogleGenAI, Modality } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

#### Generate with Reference Images
```typescript
const contentParts = [
  { text: fullPrompt },
  { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
  { text: '[Reference photo for Connor]' },
];

const result = await genAI.models.generateContent({
  model: 'gemini-2.0-flash-exp',
  contents: contentParts,
  config: {
    responseModalities: [Modality.TEXT, Modality.IMAGE],
  },
});
```

#### Rate Limit Handling
```typescript
// Retry logic with exponential backoff
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const result = await genAI.models.generateContent(...);
    return result;
  } catch (error) {
    if (error.message.includes('429')) {
      await sleep(60000); // Wait 60s on rate limit
      continue;
    }
    throw error;
  }
}
```

---

### Clothing Consistency System

To maintain consistent character appearance across scenes:

#### Priority Order
1. **Scene-specific role** (doctor coat, swimsuit) - temporary costume
2. **Base outfit** from `character.description.clothing`
3. **Cached outfit** from first scene generation
4. **Theme clothing** (Christmas pajamas, winter jacket)
5. **Default** casual play clothes

#### Outfit Cache
```typescript
// In-memory cache for story consistency
const outfitCache = new Map<string, string>();

// Called after first scene to lock outfit
export function cacheCharacterOutfit(characterKey: string, outfit: string) {
  outfitCache.set(characterKey, outfit);
}

// Clear when starting new story
export function clearOutfitCache() {
  outfitCache.clear();
}
```

#### Role Detection
```typescript
function detectRoleClothing(sceneDescription: string): string | null {
  const rolePatterns = [
    { pattern: /pretend.*doctor/i, clothing: 'white doctor coat' },
    { pattern: /swim|pool|beach/i, clothing: 'swimsuit' },
    { pattern: /sleep|bed|pajama/i, clothing: 'cozy pajamas' },
    // ... more patterns
  ];
  // Returns temporary costume if scene mentions it
}
```

---

### Human-Animal Separation

**Problem**: Models sometimes create human-animal hybrids (human with animal head, etc.)

**Solution**: Multi-layer protection

1. **isAnimal flag** - Set during character creation, not guessed from text
2. **Explicit prompt rule**: "NO human-animal hybrids"
3. **Separation rule**: "Humans and animals must be completely separate"
4. **Scene detection**: `sceneContainsAnimals()` triggers extra rules

```typescript
// In prompt building
${hasAnimalCharacters ? '- Animals: NO human clothing, NO human-animal hybrids.' : ''}
${hasAnimalsInScene && hasHumanCharacters ? '- Humans and animals completely separate.' : ''}
```

---

### PDF Export & Image Display

Images are used in PDF generation for printed storybooks:

| Template | Image Height | Text Height | Use Case |
|----------|--------------|-------------|----------|
| A5 (StorybookTemplate) | 70% | 30% | Standard print |
| Large (StorybookTemplateLarge) | 75% | 25% | Display/read-aloud |

**Key Files**:
- [src/components/pdf/StorybookTemplate.tsx](src/components/pdf/StorybookTemplate.tsx) - A5 format
- [src/components/pdf/StorybookTemplateLarge.tsx](src/components/pdf/StorybookTemplateLarge.tsx) - Large format

---

### Environment Variables

```bash
# Required for image generation
GEMINI_API_KEY=your-gemini-api-key

# Optional (legacy, not used)
FAL_KEY=your-fal-ai-key
OPENAI_API_KEY=your-openai-key  # Used for story text, not images
```

---

### Troubleshooting

#### Images Look Like Photos
- Check prompt includes "NOT a photograph"
- Ensure "ILLUSTRATED" is emphasized
- Reference photos may be too prominent

#### Characters Look Different Each Scene
- Check clothing consistency rules are in prompt
- Verify outfit cache is working
- Check characterDescriptions includes outfit

#### Human-Animal Hybrids
- Verify isAnimal flag is set correctly
- Check separation rules in prompt
- Ensure hasAnimalsInScene is detected

#### Rate Limits (429 Errors)
- Gemini has free tier limits
- Retry logic handles this automatically
- May need to wait 60+ seconds between requests

---

---

## Image Edit Feature (2025-12-03)

### Overview

Added "Edit Image" feature to allow users to make precise modifications to generated scene and cover images using **Qwen-Image-Edit** (Tongyi Wanxiang) via Segmind API.

**Why**: Previously, "Regenerate" created entirely new images which often looked worse. Image editing preserves the original composition while making targeted changes.

---

### How It Works

```
User clicks "Edit Image" → Enters instruction (e.g., "remove the cat")
    ↓
EditImageControl.tsx → POST /api/edit-image
    ↓
qwen-image-client.ts → Segmind API (Qwen-Image-Edit)
    ↓
Edited image returned → Upload to Supabase → Update UI
```

---

### API Provider: Segmind

**Why not direct Alibaba DashScope?**
- DashScope is NOT available internationally yet
- Segmind hosts the same Qwen-Image-Edit model
- Works globally without geo-restrictions

**Model Details**:
- **Provider**: Segmind (https://www.segmind.com)
- **Model**: Qwen-Image-Edit-Fast (based on Alibaba's Tongyi Wanxiang)
- **Endpoint**: `https://api.segmind.com/v1/qwen-image-edit-fast`
- **Speed**: ~10-70 seconds (varies based on queue)
- **Cost**: Pay-per-use via Segmind credits

---

### Key Files

| File | Purpose |
|------|---------|
| [src/lib/qwen-image-client.ts](src/lib/qwen-image-client.ts) | Segmind API client for Qwen-Image-Edit |
| [src/app/api/edit-image/route.ts](src/app/api/edit-image/route.ts) | Unified endpoint for scene & cover editing |
| [src/components/story/EditImageControl.tsx](src/components/story/EditImageControl.tsx) | Reusable UI component |
| [src/components/story/ImageGallery.tsx](src/components/story/ImageGallery.tsx) | Scene image display with edit button |
| [src/app/(dashboard)/create/page.tsx](src/app/(dashboard)/create/page.tsx) | Cover image with edit button |

---

### Environment Variables

```bash
# Segmind API for Qwen-Image-Edit (international access)
SEGMIND_API_KEY=SG_your_api_key_here

# DashScope (Alibaba) - NOT available internationally yet
DASHSCOPE_API_KEY=sk-your_dashscope_key  # Kept for future use
```

---

### API Request Format

```typescript
// Segmind API call
const response = await fetch('https://api.segmind.com/v1/qwen-image-edit-fast', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.SEGMIND_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    image: imageUrl,        // Public URL of image to edit
    prompt: instruction,    // "remove the cat", "add a tree", etc.
    steps: 8,               // Speed/quality balance (1-20)
    guidance: 4,            // Prompt adherence (1-25)
    seed: -1,               // Random for variety
    image_format: 'png',
    quality: 90,
    base64: true,
  })
});
```

---

### Supported Edit Operations

- **Remove objects**: "remove the cat in background"
- **Add elements**: "add a tree behind the house"
- **Change expressions**: "make the boy look scared"
- **Style transfer**: "make it look more colorful"
- **Fix anatomy**: "fix the hand position"
- **Modify elements**: "change the dragon to be blue"

---

### UI Component: EditImageControl

```tsx
<EditImageControl
  currentImageUrl={imageUrl}
  imageType="scene" | "cover"
  imageId={sceneId}
  onEditComplete={(newUrl) => updateImage(newUrl)}
  buttonLabel="Edit Image"  // Optional
/>
```

**States**:
1. Collapsed: Shows "Edit Image" button
2. Expanded: Shows text input + Apply/Cancel buttons
3. Loading: Shows spinner + "Applying..." message

---

### Deprecated: RegenerateSceneControl

The old regeneration component has been deprecated but kept for reference:

```typescript
/**
 * @deprecated This component has been replaced by EditImageControl
 * which uses Qwen-Image-Edit API for more precise image editing.
 *
 * Replacement: src/components/story/EditImageControl.tsx
 * To restore: Uncomment RegenerateSceneControl usage in ImageGallery.tsx
 */
```

---

### Error Handling

| Error | User Message | Handling |
|-------|--------------|----------|
| API key missing | "Image editing not configured" | 503 error |
| Rate limit (429) | "Too many requests. Please wait." | Exponential backoff retry |
| API failure | "Failed to edit image. Please try again." | Log + retry option |
| Upload failure | Falls back to base64 display | Log warning |

---

### Known Limitations

1. **Speed**: First request can take 60-70s due to cold start on Segmind
2. **Subsequent requests**: Usually faster (~10-30s)
3. **Complex edits**: May require multiple attempts
4. **Style preservation**: Works best with small, targeted changes

---

### Future Improvements

- [ ] Try SeedEdit 3.0 for faster editing (2-3 seconds)
- [ ] Add GPT Image Edit as fallback option
- [ ] Switch to direct DashScope when available internationally
- [ ] Add edit history/undo functionality

---

## Support & Contact

For technical issues:
1. Check this SUMMARY.md for common solutions
2. Review git commit history for recent changes
3. Check Vercel deployment logs
4. Review browser console errors

