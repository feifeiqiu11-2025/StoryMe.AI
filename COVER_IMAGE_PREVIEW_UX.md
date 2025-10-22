# Cover Image Preview UX Design

## Current Problem
- User fills out story details (title, description, author, age)
- User clicks "Save Story"
- Cover image is generated in the backend **without user seeing it**
- User is surprised by the generated cover image

## Proposed Solution
Add a "Generate Cover Image" step BEFORE saving, with preview and regenerate options.

---

## New Save Story Flow

### Step 1: Fill Story Details (Current)
User fills out:
- Story title
- Description
- Author name
- Author age
- Reading level
- Story tone

### Step 2: Generate Cover Image (NEW!)

**UI Components**:

1. **"Generate Cover Image" Button**
   - Appears after user fills required fields
   - Primary button style (purple/blue)
   - Text: "Generate Cover Image Preview"
   - Loading state while generating

2. **Cover Image Preview Card**
   - Shows generated cover image (large preview)
   - Displays AI-generated prompt used
   - Two action buttons:
     - "✓ Use This Cover" (green) - proceed to save
     - "↻ Regenerate" (gray) - try again with different style

3. **Optional: Style Selector**
   - Dropdown or radio buttons for cover style:
     - "Magical & Dreamy" (default)
     - "Adventure & Action"
     - "Cute & Playful"
     - "Realistic & Detailed"
   - Updates prompt style for generation

### Step 3: Save Story (Modified)
- Only enabled after cover image is generated and approved
- "Save Story" button becomes active
- User clicks → Story saved with chosen cover image

---

## Detailed UX Flow

```
┌─────────────────────────────────────────┐
│  Story Details Form                      │
│  ─────────────────────────────────      │
│  Title: [___________________________]   │
│  Description: [____________________]   │
│  Author: [_________] Age: [___]        │
│  Reading Level: [Dropdown]             │
│  Story Tone: [Dropdown]                │
│                                         │
│  [Generate Cover Image Preview]  ←───  │  Step 1: Click to generate
└─────────────────────────────────────────┘

          ↓ (API call, ~3-5 seconds)

┌─────────────────────────────────────────┐
│  Cover Image Preview                     │
│  ─────────────────────────────────      │
│  ┌─────────────────────────────────┐   │
│  │                                  │   │
│  │     [Generated Cover Image]      │   │  Step 2: Preview shown
│  │         512x512px                │   │
│  │                                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  AI Prompt Used:                        │
│  "A magical storybook cover with..."   │
│                                         │
│  [↻ Regenerate] [✓ Use This Cover]    │  Step 3: Approve or regenerate
└─────────────────────────────────────────┘

          ↓ (User clicks "Use This Cover")

┌─────────────────────────────────────────┐
│  Cover Image Approved! ✓                │
│  ─────────────────────────────────      │
│  [Thumbnail preview]                    │
│                                         │
│  [Save Story]  ← Now enabled           │  Step 4: Save with approved cover
└─────────────────────────────────────────┘
```

---

## Technical Implementation

### Frontend Changes

**File**: `src/app/(dashboard)/create/page.tsx` (or wherever story save form is)

**New State**:
```typescript
const [coverImage, setCoverImage] = useState<{url: string, prompt: string} | null>(null);
const [generatingCover, setGeneratingCover] = useState(false);
const [coverApproved, setCoverApproved] = useState(false);
```

**New Functions**:
```typescript
const generateCoverImage = async () => {
  setGeneratingCover(true);
  try {
    const response = await fetch('/api/generate-cover', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        authorName,
        authorAge,
        storyTone,
      }),
    });
    const data = await response.json();
    setCoverImage({
      url: data.imageUrl,
      prompt: data.prompt,
    });
  } catch (error) {
    alert('Failed to generate cover image');
  } finally {
    setGeneratingCover(false);
  }
};

const regenerateCover = async () => {
  setCoverApproved(false);
  await generateCoverImage();
};

const approveCover = () => {
  setCoverApproved(true);
};
```

**UI Component**:
```tsx
{!coverImage && (
  <button
    onClick={generateCoverImage}
    disabled={!title || !description || generatingCover}
    className="btn-primary"
  >
    {generatingCover ? 'Generating Cover...' : 'Generate Cover Image Preview'}
  </button>
)}

{coverImage && !coverApproved && (
  <div className="cover-preview-card">
    <img src={coverImage.url} alt="Cover preview" />
    <p className="text-sm text-gray-600">Prompt: {coverImage.prompt}</p>
    <div className="flex gap-2">
      <button onClick={regenerateCover} className="btn-secondary">
        ↻ Regenerate
      </button>
      <button onClick={approveCover} className="btn-success">
        ✓ Use This Cover
      </button>
    </div>
  </div>
)}

{coverApproved && (
  <div className="cover-approved">
    <img src={coverImage.url} alt="Approved cover" className="w-24 h-24" />
    <span className="text-green-600">✓ Cover Approved</span>
  </div>
)}

<button
  onClick={saveStory}
  disabled={!coverApproved}
  className="btn-primary"
>
  Save Story
</button>
```

---

### Backend Changes

**New API Endpoint**: `/api/generate-cover`

**File**: `src/app/api/generate-cover/route.ts`

```typescript
import { fal } from '@fal-ai/serverless-client';

export async function POST(request: NextRequest) {
  const { title, description, authorName, authorAge, storyTone } = await request.json();

  // Build prompt from story details
  const prompt = buildCoverPrompt(title, description, storyTone);

  // Generate image using fal.ai
  const result = await fal.subscribe('fal-ai/flux/dev', {
    input: {
      prompt,
      image_size: 'square',
      num_inference_steps: 28,
    },
  });

  return NextResponse.json({
    imageUrl: result.data.images[0].url,
    prompt,
  });
}

function buildCoverPrompt(title: string, description: string, tone: string): string {
  const baseStyle = 'professional children\'s book cover, vibrant colors, whimsical illustration style';

  return `${baseStyle}, storybook cover for "${title}", ${description}, ${tone} tone, centered title text placeholder, magical and enchanting atmosphere`;
}
```

---

## Alternative: Quick Preview Toggle

If full regenerate flow is too complex for MVP, simpler option:

**Quick Preview Mode**:
1. User fills form
2. "Preview Cover" button (optional, gray button)
3. Shows modal with generated cover
4. Modal has:
   - "Looks Good!" → closes modal, saves story
   - "Try Again" → regenerates and shows new preview
   - "Cancel" → closes modal, doesn't save

---

## Benefits

✅ **User sees cover before saving** - no surprises
✅ **Can regenerate if unhappy** - user control
✅ **Better UX** - shows AI is working on their behalf
✅ **Faster feedback loop** - see result immediately
✅ **Reduces support requests** - "Why is my cover weird?"

---

## Considerations

**Image Generation Limits**:
- Each regenerate counts toward user's image quota
- Show "Remaining: X/50 images" during preview
- Warn if low on quota: "You have 3 images remaining"

**Performance**:
- Cover generation takes 3-5 seconds
- Show loading spinner with progress text
- Cache generated covers to avoid re-generating on back navigation

**Accessibility**:
- Alt text for cover image preview
- Keyboard navigation for approve/regenerate buttons
- Screen reader announcements for generation status

---

## Future Enhancements

1. **Multiple Variations**
   - Generate 3 covers at once
   - User picks favorite
   - "Generate 3 More" button

2. **Custom Prompt**
   - Advanced option: "Write your own prompt"
   - Textarea for custom cover description
   - "Use custom prompt" checkbox

3. **Style Templates**
   - Predefined styles with thumbnails
   - "Watercolor", "Comic Book", "Vintage", etc.
   - Click to preview that style

4. **Edit Cover**
   - After approval, "Edit Cover" button
   - Opens simple editor (crop, rotate, filters)
   - Save edited version

---

## Implementation Priority

**MVP (Phase 1)**:
- ✅ Generate Cover Image button
- ✅ Single preview with approve/regenerate
- ✅ Disable save until cover approved

**Enhanced (Phase 2)**:
- Multiple style options
- Show quota remaining
- Cache generated covers

**Advanced (Phase 3)**:
- Multiple variations
- Custom prompts
- Cover editor

---

## Where to Implement

**Current Save Story Flow**:
- Story creation wizard (step-by-step)
- OR single form (all fields at once)

**Need to locate**:
- File with story save form
- API endpoint that saves story
- Image generation logic

Let me search for the current implementation...
