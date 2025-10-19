# StoryMe.AI - Project Status (October 18, 2025)

## Project Overview
StoryMe.AI is a children's storybook creation platform that uses AI to generate illustrated stories with consistent characters. Users can create custom characters, write story scripts, and generate illustrated scenes with AI.

**Production URL**: https://story-me-ai.vercel.app
**Repository**: https://github.com/feifeiqiu11-2025/StoryMe.AI

## Tech Stack
- **Framework**: Next.js 15.5.4 with Turbopack
- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (OAuth with Google)
- **Image Generation**: Fal.ai API
- **AI**: Claude API for scene enhancement
- **Deployment**: Vercel

## Recently Completed Features (Oct 18, 2025)

### 1. Scene Regeneration Feature ✅
**Commit**: `f62914c` - Add scene image regeneration feature
- Users can now regenerate individual scenes with custom prompts
- New `RegenerateSceneControl` component for editing prompts
- New `/api/regenerate-scene` endpoint
- Integrated into both authenticated and guest modes
- Allows users to refine images that don't meet expectations

### 2. Critical Bug Fixes ✅
**Session Focus**: Fixed production errors preventing image generation

#### Fix 1: Undefined generationTime
**Commit**: `724e577` - Fix: Handle undefined generationTime in ImageGallery
- Added fallback `(image.generationTime || 0)` to prevent `.toFixed()` crash
- Fixed client-side exception in ImageGallery component

#### Fix 2: Missing API Response Fields
**Commit**: `c10cacb` - Fix: Add missing fields to regenerate API and defensive checks
- Added `sceneId` field to regenerate API response
- Added `characterRatings` field with character mapping
- Added `Array.isArray()` check for defensive programming

#### Fix 3: artStyle ReferenceError (CRITICAL)
**Commit**: `b443c68` - Fix: Define artStyle constant to resolve ReferenceError
- **Root cause**: `artStyle` variable was used but never defined
- Fixed "Uncaught ReferenceError: artStyle is not defined" error
- Added `ART_STYLE` constant to both create and guest pages
- Added `artStyle`, `readingLevel`, and `storyTone` fields to `StorySession` interface
- Properly initialized session state with artStyle

#### Fix 4: Regenerate Panel UI
**Commit**: `37f6b9f` - Fix: Make regenerate panel more compact and responsive
- Removed duplicate prompt display (was showing twice)
- Made panel more compact to fit within page boundaries
- Reduced padding, font sizes, and button sizes
- Fixed text wrapping issues
- Changed textarea to `resize-none` to prevent overflow

## Current Architecture

### Key Files and Directories

#### API Routes (`/src/app/api/`)
- `generate-images/route.ts` - Bulk image generation for all scenes
- `regenerate-scene/route.ts` - Single scene regeneration with custom prompt
- `enhance-scenes/route.ts` - AI scene enhancement with Claude
- `generate-cover/route.ts` - PDF cover generation
- `characters/` - Character library CRUD operations
- `projects/` - Project management (save, load, delete)
- `images/[id]/rate/route.ts` - Scene rating API
- `auth/` - Authentication callbacks
- `upload/` - Image upload handling

#### Pages
- `/src/app/(dashboard)/create/page.tsx` - Authenticated story creation
- `/src/app/guest/page.tsx` - Guest mode story creation
- `/src/app/(dashboard)/characters/` - Character library management
- `/src/app/(dashboard)/projects/` - Project management
- `/src/app/(dashboard)/dashboard/` - User dashboard

#### Key Components (`/src/components/`)
- `story/ImageGallery.tsx` - Display generated images with ratings
- `story/RegenerateSceneControl.tsx` - Scene regeneration UI (NEW)
- `story/SceneRatingCard.tsx` - 1-5 star rating system
- `story/CharacterManager.tsx` - Character creation/editing
- `story/ScriptInput.tsx` - Story script input
- `story/StorySettingsPanel.tsx` - Reading level and tone settings
- `story/EnhancementPreview.tsx` - AI-enhanced scene preview
- `story/GenerationProgress.tsx` - Image generation progress

#### Types (`/src/lib/types/story.ts`)
```typescript
interface StorySession {
  characters: Character[];
  script: string;
  scenes: Scene[];
  generatedImages: GeneratedImage[];
  status: 'idle' | 'processing' | 'completed' | 'error';
  artStyle?: string;
  readingLevel?: number;
  storyTone?: StoryTone;
}

interface GeneratedImage {
  id: string;
  sceneId: string;
  sceneNumber: number;
  sceneDescription: string;
  imageUrl: string;
  prompt: string;
  generationTime: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  characterRatings?: CharacterRating[];
  overallRating?: number;
  ratingFeedback?: string;
  error?: string;
}
```

#### Services
- `/src/lib/fal-client.ts` - Fal.ai image generation
- `/src/lib/services/pdf.service.ts` - PDF generation with jsPDF
- `/src/lib/scene-parser.ts` - Script parsing and character extraction
- `/src/lib/supabase/` - Supabase client and queries
- `/src/lib/utils/guest-story-storage.ts` - Guest mode localStorage

## Current Features

### ✅ Completed Features
1. **Multi-character Support** - Up to 5 characters per story
2. **Character Library** - Save and reuse characters across stories
3. **Guest Mode** - Try without authentication
4. **OAuth Authentication** - Google OAuth integration
5. **AI Scene Enhancement** - Claude enhances scenes with reading level and tone
6. **Image Generation** - Fal.ai generates consistent character illustrations
7. **Scene Regeneration** - Regenerate individual scenes with custom prompts
8. **Scene Rating System** - 1-5 star ratings for quality tracking
9. **Character Consistency Scoring** - Track character accuracy across scenes
10. **PDF Export** - Generate illustrated storybook PDFs
11. **Project Management** - Save, load, and delete story projects
12. **Mobile Responsive** - Works on all device sizes

## Known Issues & Limitations

### Current Limitations
1. **Art Style Fixed** - Currently hardcoded to "children's book illustration, colorful, whimsical"
2. **No Art Style Customization** - Users cannot choose different art styles
3. **Single Story Tone** - Tone applies to entire story, not per-scene
4. **No Image Editing** - Cannot crop, resize, or adjust images
5. **No Batch Regeneration** - Can only regenerate one scene at a time
6. **No Image History** - Cannot see previous versions of regenerated images

### Performance Notes
- Image generation: 15-30 seconds per scene
- Scene enhancement: ~5 seconds for 10 scenes
- PDF generation: Nearly instant (client-side)

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Fal.ai (Image Generation)
FAL_KEY=your-fal-key

# Anthropic (Scene Enhancement)
ANTHROPIC_API_KEY=your-anthropic-key

# OAuth (Optional)
NEXT_PUBLIC_SITE_URL=https://story-me-ai.vercel.app
```

## Database Schema (Supabase)

### Tables
- `users` - User accounts
- `characters` - Character library entries
- `projects` - Saved story projects
- `generated_images` - Generated scene images with metadata
- `character_ratings` - Per-character consistency ratings

### Key Relationships
- `projects.user_id` → `users.id`
- `characters.user_id` → `users.id`
- `generated_images.project_id` → `projects.id`
- `character_ratings.image_id` → `generated_images.id`

### Storage Buckets
- `character-images` - User-uploaded character reference images
- `generated-images` - AI-generated scene images

## Next Steps & Recommendations

### High Priority 🔴

1. **Add Art Style Selection**
   - Allow users to choose from preset art styles
   - Options: watercolor, cartoon, realistic, manga, pixel art, etc.
   - Update UI to include style selector in StorySettingsPanel
   - Pass selected style to image generation API

2. **Image History & Versioning**
   - Store previous versions when regenerating scenes
   - Add "View History" button to see all versions
   - Allow reverting to previous versions
   - Display generation timestamp for each version

3. **Batch Regeneration**
   - Allow selecting multiple low-rated scenes
   - "Regenerate All Below 3 Stars" button
   - Queue-based regeneration with progress tracking

### Medium Priority 🟡

4. **Enhanced Character Detection**
   - Better AI-powered character extraction from scripts
   - Highlight unrecognized character names
   - Suggest character additions during script input

5. **Scene-Level Tone Control**
   - Allow different tones for different scenes
   - "Override tone for this scene" option
   - Per-scene enhancement settings

6. **Image Editing Tools**
   - Basic crop/resize functionality
   - Brightness/contrast adjustments
   - Filter presets (vintage, vibrant, soft, etc.)

7. **Collaborative Features**
   - Share projects with other users
   - Public story gallery
   - Like/comment on public stories

### Low Priority 🟢

8. **Analytics Dashboard**
   - Track image generation statistics
   - Character consistency trends
   - Most popular art styles
   - Average ratings by user

9. **Story Templates**
   - Pre-built story templates for common themes
   - Birthday stories, bedtime stories, adventure stories
   - Fill-in-the-blank style templates

10. **Audio Narration**
    - Text-to-speech for story captions
    - Multiple voice options
    - Export audio along with PDF

## Development Commands

```bash
# Install dependencies
cd storyme-app
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production build locally
npm start

# Run tests
npm test

# Lint code
npm run lint
```

## Git Workflow

```bash
# Current branch: main
# Always work on main branch for this project

# Check status
git status

# Stage changes
git add <files>

# Commit with message
git commit -m "Description"

# Push to remote
git push

# Pull latest changes
git pull
```

## Recent Commit History

```
37f6b9f Fix: Make regenerate panel more compact and responsive
b443c68 Fix: Define artStyle constant to resolve ReferenceError
c10cacb Fix: Add missing fields to regenerate API and defensive checks
724e577 Fix: Handle undefined generationTime in ImageGallery
f62914c Add scene image regeneration feature
2b4a657 Add OAuth setup, guest mode improvements, and deployment docs
```

## Testing Notes

### Test Scenarios to Verify
1. ✅ Guest mode: Create story without login
2. ✅ Authenticated mode: Create story with login
3. ✅ Scene regeneration: Edit prompt and regenerate single scene
4. ✅ Character library: Save and reuse characters
5. ✅ Scene ratings: Rate scenes 1-5 stars
6. ✅ PDF export: Download illustrated PDF
7. ✅ Project save/load: Save and restore projects

### Production Testing Checklist
- [ ] Verify OAuth login flow
- [ ] Test scene regeneration on production
- [ ] Verify compact regenerate panel UI
- [ ] Test PDF download with multiple scenes
- [ ] Verify character consistency scoring
- [ ] Test mobile responsiveness

## Important Code Constants

```typescript
// Art style (currently hardcoded)
const ART_STYLE = "children's book illustration, colorful, whimsical";

// API timeouts
export const maxDuration = 300; // 5 minutes

// Image generation settings
const IMAGE_SIZE = "1024x1024";
const NUM_INFERENCE_STEPS = 50;

// Scene enhancement defaults
const DEFAULT_READING_LEVEL = 5;
const DEFAULT_STORY_TONE = 'playful';
```

## Contact & Access
- **GitHub Repo**: https://github.com/feifeiqiu11-2025/StoryMe.AI
- **Production**: https://story-me-ai.vercel.app
- **Vercel Project**: story-me-ai (auto-deploys from main branch)

---

## Quick Start for New Session

1. **Check latest commits**: `git log --oneline -5`
2. **Pull latest changes**: `git pull`
3. **Check production status**: Visit https://story-me-ai.vercel.app
4. **Review this document** for current status
5. **Check issues**: Look for any reported bugs or feature requests

## Session Context Variables

```bash
WORKING_DIR=/home/gulbrand/Feifei/StoryMe
STORYME_APP_DIR=/home/gulbrand/Feifei/StoryMe/storyme-app
MAIN_BRANCH=main
PRODUCTION_URL=https://story-me-ai.vercel.app
```
