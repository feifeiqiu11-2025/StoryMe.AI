# Feature Plan: Scene Image Regeneration

## 📋 Overview

Allow users to regenerate individual scene images when they're not satisfied with the result. Users can:
1. View the AI prompt used for generation
2. Edit the prompt to refine the image
3. Regenerate just that specific scene
4. Replace the old image with the new one

---

## 🎯 User Story

**As a user**, when I see a generated scene image that doesn't match my vision:
- I want to see what AI prompt was used
- I want to edit the prompt to improve it
- I want to regenerate just that one scene (not all scenes)
- I want the new image to replace the old one
- I want to keep the best version

---

## 🔍 Current State Analysis

### What We Have:
✅ **Image Generation API** - `/api/generate-images/route.ts`
  - Generates all scenes at once
  - Uses character references
  - Maintains scene consistency
  - Returns prompt used for each image

✅ **Image Gallery Component** - `ImageGallery.tsx`
  - Displays all generated images
  - Shows scene descriptions
  - Has rating system
  - Identifies low-rated scenes

✅ **Data Structure** - `GeneratedImage` type
  - Stores `prompt` (the actual prompt used)
  - Stores `sceneDescription` (original scene text)
  - Has `status` field for tracking generation state

### What's Missing:
❌ No way to regenerate a single scene
❌ No prompt editing UI
❌ No API endpoint for single scene regeneration
❌ No way to replace/update an existing image

---

## 🏗️ Technical Design

### 1. New API Endpoint

**File**: `/api/regenerate-scene/route.ts` (new)

**Purpose**: Regenerate a single scene image

**Request**:
```typescript
POST /api/regenerate-scene
{
  sceneId: string,
  sceneNumber: number,
  customPrompt: string,          // User-edited prompt
  originalSceneDescription: string,
  characters: Character[],
  artStyle: string,
  projectId?: string              // For authenticated users
}
```

**Response**:
```typescript
{
  success: boolean,
  generatedImage: GeneratedImage,  // New image data
  error?: string
}
```

**Logic**:
1. Accept single scene regeneration request
2. Use custom prompt if provided, otherwise use enhanced scene description
3. Generate image using same logic as bulk generation
4. Return new image data
5. For authenticated users: Save to database and replace old image

---

### 2. UI Component: Regeneration Controls

**File**: `ImageGallery.tsx` (modify)

**Add to each scene card**:
```tsx
<RegenerateSceneControl
  sceneNumber={image.sceneNumber}
  originalPrompt={image.prompt}
  sceneDescription={image.sceneDescription}
  onRegenerate={(newImage) => handleReplaceImage(image.id, newImage)}
/>
```

**New Component**: `RegenerateSceneControl.tsx`

**Features**:
- Toggle button: "Edit & Regenerate"
- Expandable panel showing:
  - Original prompt (read-only)
  - Editable prompt textarea
  - "Regenerate" button
  - Loading state during regeneration
  - Error handling

**UI Flow**:
```
[Scene Image Card]
  └─ [⚡ Regenerate Scene] button
       ↓ (click)
  └─ [Expanded Panel]
       ├─ "Original AI Prompt:" (collapsed by default)
       │   └─ [Show/Hide] toggle
       │       └─ <readonly textarea>
       │
       ├─ "Edit Prompt:" (editable)
       │   └─ <textarea with original prompt>
       │   └─ "Tip: Be specific about poses, expressions, background"
       │
       ├─ [🔄 Regenerate Image] button
       │   └─ (shows loading spinner during generation)
       │
       └─ [❌ Cancel] button
```

---

### 3. State Management

**In ImageGallery Component**:

```typescript
const [regeneratingScenes, setRegeneratingScenes] = useState<Set<string>>(new Set());
const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});

const handleRegenerateScene = async (
  sceneId: string,
  sceneNumber: number,
  customPrompt: string
) => {
  setRegeneratingScenes(prev => new Set(prev).add(sceneId));

  try {
    const response = await fetch('/api/regenerate-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId,
        sceneNumber,
        customPrompt,
        originalSceneDescription: image.sceneDescription,
        characters: characters,
        artStyle: artStyle,
        projectId: projectId,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Replace old image with new one
      setGeneratedImages(prev =>
        prev.map(img =>
          img.id === sceneId ? { ...img, ...data.generatedImage } : img
        )
      );
    }
  } catch (error) {
    console.error('Regeneration failed:', error);
    alert('Failed to regenerate scene. Please try again.');
  } finally {
    setRegeneratingScenes(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
  }
};
```

---

### 4. Database Updates (For Authenticated Users)

**In Regenerate API**:

```typescript
// If user is authenticated and projectId provided
if (projectId && user) {
  // Update the generated_images record
  await supabase
    .from('generated_images')
    .update({
      image_url: newImageUrl,
      prompt: customPrompt,
      generation_time: generationTime,
      updated_at: new Date().toISOString(),
      // Optional: track regeneration count
      regeneration_count: supabase.raw('regeneration_count + 1'),
    })
    .eq('id', sceneId)
    .eq('project_id', projectId);
}
```

**Optional Schema Addition** (for tracking):
```sql
ALTER TABLE generated_images
ADD COLUMN regeneration_count INTEGER DEFAULT 0,
ADD COLUMN original_prompt TEXT,  -- Store first prompt
ADD COLUMN last_regenerated_at TIMESTAMP;
```

---

### 5. Guest Mode Handling

**For Guest Users**:
- Regeneration works entirely in-memory
- No database updates
- State persists until page refresh
- Can still download regenerated images

---

## 📐 UI/UX Design

### Scene Card Layout (Before):
```
┌─────────────────────────────────────┐
│ [Image] │ Scene 1                   │
│         │ Description...            │
│         │ ⭐⭐⭐⭐⭐ Rate Scene       │
│         │ 👍 Good / 👎 Poor         │
│         │ [Download Image]          │
└─────────────────────────────────────┘
```

### Scene Card Layout (After):
```
┌─────────────────────────────────────┐
│ [Image] │ Scene 1                   │
│         │ Description...            │
│         │ ⭐⭐⭐⭐⭐ Rate Scene       │
│         │ 👍 Good / 👎 Poor         │
│         │                           │
│         │ [⚡ Regenerate Scene]     │  ← NEW
│         │ [Download Image]          │
└─────────────────────────────────────┘

(Click "Regenerate Scene")
       ↓

┌─────────────────────────────────────┐
│ [Image] │ Scene 1                   │
│         │ Description...            │
│         │                           │
│         │ ╔═══════════════════════╗ │
│         │ ║ 🎨 Customize Prompt   ║ │
│         │ ╟───────────────────────╢ │
│         │ ║ Original Prompt:      ║ │
│         │ ║ [Show/Hide]           ║ │
│         │ ║                       ║ │
│         │ ║ Edit Prompt:          ║ │
│         │ ║ ┌───────────────────┐ ║ │
│         │ ║ │Connor in park...  │ ║ │
│         │ ║ │                   │ ║ │
│         │ ║ └───────────────────┘ ║ │
│         │ ║                       ║ │
│         │ ║ [🔄 Regenerate] [❌] ║ │
│         │ ╚═══════════════════════╝ │
└─────────────────────────────────────┘
```

---

## 🎨 Visual Design Details

### Regenerate Button:
- **Icon**: ⚡ Lightning bolt (suggests quick action)
- **Color**: Blue outline (secondary action)
- **Position**: Below rating, above download
- **Text**: "Regenerate Scene" or "✏️ Edit & Regenerate"

### Expanded Panel:
- **Background**: Light blue/purple gradient (matches rating panel)
- **Border**: 2px border with accent color
- **Animation**: Smooth expand/collapse

### Prompt Editor:
- **Textarea**: Min 3 rows, auto-expand
- **Placeholder**: "Edit the AI prompt to improve this scene..."
- **Help Text**: "💡 Tip: Be specific about character poses, expressions, and background details"
- **Character Counter**: Show prompt length (optional)

### Regenerate Button (Action):
- **Loading State**: Show spinner icon + "Generating..."
- **Disable State**: Disabled during generation
- **Success State**: Brief green checkmark, then auto-collapse panel

---

## 🔄 User Flow

### Happy Path:
1. User views generated scenes
2. Sees a scene that's "off" (wrong pose, background, etc.)
3. Clicks "⚡ Regenerate Scene"
4. Panel expands, showing original prompt
5. User edits prompt: "Connor playing soccer, kicking ball to the right, sunny park"
6. Clicks "🔄 Regenerate Image"
7. Loading spinner appears
8. New image generates (~15-30 seconds)
9. Image smoothly fades in, replacing old one
10. Panel auto-collapses
11. Success notification: "✅ Scene regenerated!"

### Error Handling:
- **Generation Fails**: Show error message, keep panel open, allow retry
- **Network Error**: Show retry button
- **Timeout**: Show "Generation taking longer than usual" message

---

## 💾 Data Flow

```
User Action
    ↓
[Edit Prompt in UI]
    ↓
Click "Regenerate"
    ↓
POST /api/regenerate-scene
    ↓
Generate with Fal.ai
    ↓
Store new image URL
    ↓
Update database (if authenticated)
    ↓
Return new image data
    ↓
Update UI state
    ↓
Replace image in gallery
```

---

## ⚠️ Edge Cases & Considerations

### 1. Multiple Regenerations
**Issue**: User regenerates same scene multiple times
**Solution**:
- Track regeneration count
- Optional: Limit to 3-5 regenerations per scene
- Show warning: "This scene has been regenerated 3 times. Consider adjusting character descriptions."

### 2. Concurrent Regenerations
**Issue**: User tries to regenerate multiple scenes at once
**Solution**:
- Allow only 1 regeneration at a time
- Show "Please wait for current regeneration to complete" message
- OR: Queue regenerations (more complex)

### 3. Prompt Too Short/Long
**Issue**: User deletes prompt or makes it too long
**Solution**:
- Min length: 10 characters
- Max length: 1000 characters
- Show validation error
- Disable "Regenerate" button if invalid

### 4. Guest Mode Persistence
**Issue**: Regenerated images lost on refresh (guest mode)
**Solution**:
- Show warning: "💡 Sign in to save regenerated images"
- Add prompt in guest signup modal
- Optionally: Store in localStorage temporarily

### 5. Cost Management
**Issue**: Each regeneration costs money (Fal.ai)
**Solution**:
- Track regeneration count per user
- Free tier: 3 regenerations per story
- Premium: Unlimited regenerations
- Show count: "2 regenerations remaining"

### 6. Character Consistency
**Issue**: Regenerated image doesn't match character references
**Solution**:
- Always include character references in regeneration
- Maintain same character prompts
- Add warning: "Regeneration uses same character references for consistency"

---

## 📊 Success Metrics

**User Engagement**:
- % of users who use regeneration feature
- Average regenerations per story
- Scenes most frequently regenerated

**Quality Improvement**:
- Rating before regeneration vs. after
- % of regenerations that improve rating
- User feedback on regenerated images

**Technical**:
- Regeneration success rate (API)
- Average regeneration time
- Error rate

---

## 🚀 Implementation Phases

### Phase 1: Core Functionality (MVP)
**Time**: 4-6 hours

1. Create `/api/regenerate-scene/route.ts`
2. Add `RegenerateSceneControl` component
3. Integrate into `ImageGallery`
4. Basic UI: Prompt editor + regenerate button
5. Update image in state
6. Test in guest mode

**Deliverable**: Users can regenerate scenes with edited prompts

### Phase 2: Enhanced UX
**Time**: 2-3 hours

1. Add show/hide for original prompt
2. Loading states and animations
3. Error handling and retry
4. Success notifications
5. Prompt validation

**Deliverable**: Polished user experience

### Phase 3: Database Integration
**Time**: 2-3 hours

1. Update database on regeneration (authenticated users)
2. Track regeneration count
3. Store original prompt
4. Add regeneration history (optional)

**Deliverable**: Regenerations persist for logged-in users

### Phase 4: Advanced Features (Optional)
**Time**: 3-4 hours

1. Regeneration limits (free vs premium)
2. Prompt suggestions/templates
3. A/B comparison (old vs new image)
4. Regeneration history/undo
5. Batch regeneration (multiple scenes)

**Total Time**: 11-16 hours (Phases 1-3)

---

## 📝 Implementation Checklist

### Backend:
- [ ] Create `/api/regenerate-scene/route.ts`
- [ ] Handle single scene generation
- [ ] Update database for authenticated users
- [ ] Add error handling and validation
- [ ] Track regeneration count (optional)

### Frontend:
- [ ] Create `RegenerateSceneControl.tsx` component
- [ ] Add to `ImageGallery.tsx`
- [ ] Implement prompt editing UI
- [ ] Add loading states
- [ ] Handle image replacement in state
- [ ] Add success/error notifications
- [ ] Test in guest mode
- [ ] Test in authenticated mode

### Database (Optional):
- [ ] Add `regeneration_count` column
- [ ] Add `original_prompt` column
- [ ] Add `last_regenerated_at` column

### Testing:
- [ ] Test regeneration with valid prompt
- [ ] Test with empty/invalid prompt
- [ ] Test multiple regenerations
- [ ] Test concurrent regenerations
- [ ] Test guest mode
- [ ] Test authenticated mode
- [ ] Test error scenarios
- [ ] Test mobile responsive

### Documentation:
- [ ] Update user guide
- [ ] Add regeneration limits to pricing page (if applicable)
- [ ] Document API endpoint

---

## 🎯 Acceptance Criteria

✅ User can click "Regenerate Scene" on any generated image
✅ User can view the original AI prompt used
✅ User can edit the prompt in a textarea
✅ User can click "Regenerate" to create new image
✅ Loading state shows during generation
✅ New image replaces old image in gallery
✅ Works in both guest mode and authenticated mode
✅ Error messages show if generation fails
✅ Regenerated images persist for logged-in users
✅ UI is mobile-responsive
✅ Regeneration uses same character references

---

## 🔮 Future Enhancements

1. **Version History**: Keep multiple versions, allow switching
2. **Prompt Templates**: "Make character smile more", "Change to sunset", etc.
3. **Batch Regeneration**: Select multiple scenes, regenerate all
4. **Smart Suggestions**: AI suggests prompt improvements
5. **Compare Mode**: Side-by-side old vs new
6. **Quick Tweaks**: Buttons for common changes (brightness, style, etc.)
7. **Regeneration Analytics**: Learn which prompts work best
8. **Community Prompts**: Share successful prompts with other users

---

## ❓ Questions for Review

1. **Regeneration Limits**: Should we limit free users? (e.g., 3 per story)
2. **Original Image**: Keep original or always replace?
3. **Prompt Visibility**: Show full original prompt by default, or hide?
4. **Character Consistency**: Should we allow excluding characters in regeneration?
5. **Cost**: Regeneration costs ~same as initial generation. How to manage?
6. **UI Position**: Regenerate button before or after rating?
7. **Guest Mode**: Warn users about losing regenerations, or store in localStorage?
8. **Undo**: Should users be able to undo regeneration?

---

## 📐 Design Mockups Needed

1. Regenerate button design (collapsed state)
2. Expanded prompt editor panel
3. Loading state during regeneration
4. Success/error states
5. Mobile responsive layout

---

**Let's review this plan together! What are your thoughts on:**
- The overall approach?
- The UI/UX design?
- Implementation phases?
- Any questions above?
