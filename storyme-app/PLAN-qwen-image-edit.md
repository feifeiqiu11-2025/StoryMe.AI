# Plan: Qwen Image Edit Integration

## Overview
Replace current "Regenerate" flow with "Edit Image" using Qwen-Image-Edit API for both scene images and cover images. This provides better results for small fixes while preserving the original image composition.

## Design Principles
- **Simplicity**: Single "Edit Image" option only (remove regenerate)
- **Consistency**: Same edit flow for scene images and cover images
- **Minimal data**: Only pass current image URL + user instruction to Qwen
- **Graceful fallback**: Handle API errors gracefully
- **Reusable component**: Create one EditImageControl component used by both scenes and covers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EditImageControl                         │
│  (Reusable component for scene & cover image editing)       │
│                                                             │
│  Props:                                                     │
│  - currentImageUrl: string                                  │
│  - imageType: 'scene' | 'cover'                            │
│  - imageId: string (sceneId or 'cover')                    │
│  - onEditComplete: (newImageUrl: string) => void           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  POST /api/edit-image                       │
│                                                             │
│  Request: { imageUrl, instruction, imageType, imageId }     │
│  Response: { success, imageUrl, editInstruction }           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   qwen-image-client.ts                      │
│                                                             │
│  editImage(imageUrl, instruction) → EditResult              │
│  - Calls DashScope API (Singapore region)                   │
│  - Returns edited image base64                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create Qwen Image Client
**File**: `src/lib/qwen-image-client.ts` (NEW)

```typescript
/**
 * Qwen Image Edit Client
 *
 * Uses Alibaba DashScope API for image editing via Qwen-Image-Edit model.
 * Supports: remove objects, add elements, change expressions, style transfer
 */

export interface QwenEditResult {
  imageBase64: string;
  mimeType: string;
}

export async function editImageWithQwen(
  imageUrl: string,
  instruction: string
): Promise<QwenEditResult>

export function isQwenAvailable(): boolean
```

**API Details**:
- Endpoint: `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- Model: `qwen-image-edit`
- Region: Singapore (international)
- Input: Image URL + text instruction
- Output: Edited image as base64

### Step 2: Create Edit Image API Endpoint
**File**: `src/app/api/edit-image/route.ts` (NEW)

```typescript
// Unified endpoint for both scene and cover images
//
// POST /api/edit-image
//
// Request Body:
//   - imageUrl: string (current image URL from Supabase)
//   - instruction: string (what to change, e.g., "remove the cat")
//   - imageType: 'scene' | 'cover'
//   - imageId: string (sceneId for scenes, or 'cover' for cover image)
//
// Response:
//   - success: boolean
//   - imageUrl: string (new Supabase URL after upload)
//   - editInstruction: string (stored for reference)
//   - error?: string (if failed)
```

### Step 3: Create Reusable EditImageControl Component
**File**: `src/components/story/EditImageControl.tsx` (NEW)

```typescript
interface EditImageControlProps {
  currentImageUrl: string;
  imageType: 'scene' | 'cover';
  imageId: string;
  onEditComplete: (newImageUrl: string) => void;
  buttonLabel?: string; // Default: "Edit Image"
}
```

**UI Design**:
```
┌─────────────────────────────────────────┐
│  [Edit Image] button (collapsed state)  │
└─────────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────────┐
│  What would you like to change?    [X]  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ e.g., remove the cat, add a tree │  │
│  │ in background, change expression │  │
│  └───────────────────────────────────┘  │
│                                         │
│  💡 Describe what to fix or change      │
│                                         │
│  [Apply Edit]              [Cancel]     │
└─────────────────────────────────────────┘
```

### Step 4: Update Scene Image UI
**File**: `src/components/story/RegenerateSceneControl.tsx` (KEEP - comment out unused code)

- Keep the file but comment out the old regeneration logic
- Add a note at top: "// DEPRECATED: Replaced by EditImageControl - kept for reference"

**File**: `src/components/story/ScenePreviewApproval.tsx` (MODIFY)
- Replace RegenerateSceneControl with EditImageControl
- Pass appropriate props

### Step 5: Update Cover Image UI
**File**: `src/app/(dashboard)/create/page.tsx` (MODIFY)

Location: Lines 1616-1673 (cover preview section)

Changes:
- Remove "Show AI Prompt" collapsible section (lines 1626-1656)
- Remove "Try Again" button that regenerates (line 1660-1664)
- Add EditImageControl component instead
- Keep "Use This Cover" approve button

**Before** (current):
```tsx
{coverImageUrl && !coverApproved && (
  <div>
    <img src={coverImageUrl} />

    {/* AI Prompt Editor - REMOVE */}
    <button>Show AI Prompt</button>
    {showPromptEditor && <textarea />}
    <button>Regenerate with Custom Prompt</button>

    {/* Buttons */}
    <button>↻ Try Again</button>  {/* REMOVE */}
    <button>✓ Use This Cover</button>  {/* KEEP */}
  </div>
)}
```

**After** (proposed):
```tsx
{coverImageUrl && !coverApproved && (
  <div>
    <img src={coverImageUrl} />

    {/* Edit Image Control - NEW */}
    <EditImageControl
      currentImageUrl={coverImageUrl}
      imageType="cover"
      imageId="cover"
      onEditComplete={(newUrl) => setCoverImageUrl(newUrl)}
    />

    {/* Approve Button */}
    <button>✓ Use This Cover</button>
  </div>
)}
```

### Step 6: Environment Variables
**File**: `.env.local` (ADD)
```
DASHSCOPE_API_KEY=your_dashscope_api_key
```

**File**: `.env.example` (MODIFY)
```
# Qwen Image Edit (Alibaba DashScope)
DASHSCOPE_API_KEY=your_dashscope_api_key
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/qwen-image-client.ts` | CREATE | Qwen DashScope API client |
| `src/app/api/edit-image/route.ts` | CREATE | Unified edit endpoint for scene & cover |
| `src/components/story/EditImageControl.tsx` | CREATE | Reusable edit UI component |
| `src/components/story/RegenerateSceneControl.tsx` | COMMENT OUT | Keep for reference, add deprecation note |
| `src/components/story/ScenePreviewApproval.tsx` | MODIFY | Use EditImageControl |
| `src/app/(dashboard)/create/page.tsx` | MODIFY | Add EditImageControl for cover |
| `.env.example` | MODIFY | Add DASHSCOPE_API_KEY |

## Qwen API Request Format

```typescript
// DashScope API call
const response = await fetch(
  'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-image-edit',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: imageUrl },
              { text: instruction }
            ]
          }
        ]
      }
    })
  }
);

// Response contains base64 image in result
```

## Error Handling

| Error | User Message | Action |
|-------|--------------|--------|
| API Key missing | "Image editing not configured" | Log warning, disable edit button |
| Qwen API failure | "Failed to edit image. Please try again." | Log error, show retry option |
| Upload failure | Keep base64 in memory | Log warning, still show edited image |
| Invalid image URL | "Invalid image" | Validate before API call |
| Rate limit (429) | "Too many requests. Please wait." | Exponential backoff retry |

## Testing Checklist

- [ ] Qwen client: Edit image with simple instruction works
- [ ] API endpoint: Returns edited image URL
- [ ] Scene edit: Edit scene image updates correctly
- [ ] Cover edit: Edit cover image updates correctly
- [ ] Error handling: Missing API key shows clear message
- [ ] Error handling: API failure shows retry option
- [ ] Upload: Edited images save to Supabase correctly
- [ ] Various instructions: remove, add, change expression all work

## Migration Notes

1. **No breaking changes**: Existing regenerate API still works
2. **Code preservation**: Comment out old code instead of deleting (for easy rollback)
3. **Gradual rollout**: Can keep old RegenerateSceneControl as fallback
4. **Feature flag**: Can add `ENABLE_QWEN_EDIT=true` to control rollout

## Code Commenting Strategy

When commenting out old code:
```typescript
// ============================================================
// DEPRECATED: Old regeneration logic - kept for reference
// Replaced by EditImageControl + Qwen Image Edit API
// To restore: uncomment this section and remove EditImageControl
// ============================================================
/*
... old code here ...
*/
```
