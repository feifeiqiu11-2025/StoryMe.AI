# Publishing Stories from Studio to Kids App - Complete Requirements

## Overview
This document outlines the database schema and Studio implementation needed to enable publishing stories from KindleWood Studio to the KindleWood Kids App.

---

## Current State Analysis

### ✅ What Already Exists

#### Kids App Side (Flutter):
- **Story Service** (`story_service.dart`) - Fetches stories from `published_stories` table
- **Data Models** - Story, Project, ProjectPage models ready
- **UI Components** - Story library and reader screens complete
- **Shared Database** - Both apps use same Supabase instance

#### Studio Side (Next.js):
- **Publications Table** - Generic publishing system with `kindlewood_app` platform support
- **Spotify Publishing** - Reference implementation (working example)
- **UI Placeholder** - "Kids App" button exists but shows alert
- **Database Access** - Full Supabase access with RLS policies

### ❌ What's Missing
1. **`published_stories` table** - Doesn't exist in database yet
2. **API endpoint** - `/api/projects/[id]/publish-kids-app/route.ts`
3. **Publish button logic** - Remove placeholder alert, add real functionality
4. **RLS policies** - For `published_stories` table

---

## Database Schema Requirements

### 1. Create `published_stories` Table

**Purpose**: Links Studio projects to Kids App child profiles, making stories available in the Kids App.

```sql
-- Create published_stories table
CREATE TABLE IF NOT EXISTS published_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to Studio project
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Link to Kids App child profile
  child_profile_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,

  -- Story metadata (can override project defaults)
  title TEXT,
  cover_image_url TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'bedtime',
    -- Categories: 'bedtime', 'adventure', 'learning', 'educational'
  language VARCHAR(10) NOT NULL DEFAULT 'en',

  -- Publishing status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one project can be published multiple times (to different kids)
  -- but not duplicate for same kid
  CONSTRAINT unique_project_per_child UNIQUE(project_id, child_profile_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_published_stories_child_profile
  ON published_stories(child_profile_id);

CREATE INDEX IF NOT EXISTS idx_published_stories_project
  ON published_stories(project_id);

CREATE INDEX IF NOT EXISTS idx_published_stories_active
  ON published_stories(is_active);

CREATE INDEX IF NOT EXISTS idx_published_stories_category
  ON published_stories(category);

CREATE INDEX IF NOT EXISTS idx_published_stories_published_at
  ON published_stories(published_at DESC);

-- Comments
COMMENT ON TABLE published_stories IS
  'Stories published from Studio to Kids App, linked to specific child profiles';
COMMENT ON COLUMN published_stories.category IS
  'Story category for filtering: bedtime, adventure, learning, educational';
COMMENT ON COLUMN published_stories.is_active IS
  'Whether story is currently visible in Kids App (false = unpublished)';
```

### 2. Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE published_stories ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view published stories for their own child profiles
CREATE POLICY "Users can view stories for their child profiles"
  ON published_stories FOR SELECT
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles
      WHERE parent_user_id = auth.uid()
    )
  );

-- Policy 2: Users can publish stories from their own projects
CREATE POLICY "Users can publish their own projects"
  ON published_stories FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id = auth.uid()
    )
  );

-- Policy 3: Users can update their published stories
CREATE POLICY "Users can update their published stories"
  ON published_stories FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id = auth.uid()
    )
  );

-- Policy 4: Users can delete (unpublish) their stories
CREATE POLICY "Users can unpublish their stories"
  ON published_stories FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id = auth.uid()
    )
  );
```

### 3. Optional: Helper Function for Publishing

```sql
-- Function to publish a story (handles duplicate checks)
CREATE OR REPLACE FUNCTION publish_story_to_kids_app(
  p_project_id UUID,
  p_child_profile_id UUID,
  p_category VARCHAR DEFAULT 'bedtime'
)
RETURNS UUID AS $$
DECLARE
  v_story_id UUID;
  v_project_title TEXT;
  v_project_cover TEXT;
BEGIN
  -- Get project details
  SELECT title, cover_image_url INTO v_project_title, v_project_cover
  FROM projects WHERE id = p_project_id;

  -- Insert or update published story
  INSERT INTO published_stories (
    project_id,
    child_profile_id,
    title,
    cover_image_url,
    category,
    is_active,
    published_at
  ) VALUES (
    p_project_id,
    p_child_profile_id,
    v_project_title,
    v_project_cover,
    p_category,
    true,
    NOW()
  )
  ON CONFLICT (project_id, child_profile_id)
  DO UPDATE SET
    is_active = true,
    published_at = NOW(),
    category = p_category
  RETURNING id INTO v_story_id;

  RETURN v_story_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Studio Project Implementation Tasks

### Task 1: Create Publish API Endpoint

**File**: `/src/app/api/projects/[id]/publish-kids-app/route.ts`

**Implementation**:

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const projectId = params.id;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { childProfileIds, category = 'bedtime' } = body;

    if (!childProfileIds || !Array.isArray(childProfileIds) || childProfileIds.length === 0) {
      return NextResponse.json(
        { error: 'childProfileIds array is required' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, title, cover_image_url')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Verify all child profiles belong to user
    const { data: profiles, error: profilesError } = await supabase
      .from('child_profiles')
      .select('id')
      .in('id', childProfileIds)
      .eq('parent_user_id', user.id);

    if (profilesError || profiles.length !== childProfileIds.length) {
      return NextResponse.json(
        { error: 'Invalid child profile IDs' },
        { status: 400 }
      );
    }

    // Check that project has scenes with images and audio
    const { data: scenes, error: scenesError } = await supabase
      .from('scenes')
      .select('id, scene_number')
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true });

    if (scenesError || !scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: 'Project has no scenes' },
        { status: 400 }
      );
    }

    // Verify all scenes have images
    const sceneIds = scenes.map(s => s.id);
    const { data: images } = await supabase
      .from('generated_images')
      .select('scene_id')
      .in('scene_id', sceneIds);

    const scenesWithImages = new Set(images?.map(i => i.scene_id) || []);
    const missingImages = scenes.filter(s => !scenesWithImages.has(s.id));

    if (missingImages.length > 0) {
      return NextResponse.json(
        {
          error: 'Some scenes are missing images',
          missingScenes: missingImages.map(s => s.scene_number)
        },
        { status: 400 }
      );
    }

    // Verify all scenes have audio
    const { data: audioFiles } = await supabase
      .from('story_audio_pages')
      .select('scene_id')
      .in('scene_id', sceneIds);

    const scenesWithAudio = new Set(audioFiles?.map(a => a.scene_id) || []);
    const missingAudio = scenes.filter(s => !scenesWithAudio.has(s.id));

    if (missingAudio.length > 0) {
      return NextResponse.json(
        {
          error: 'Some scenes are missing audio',
          missingScenes: missingAudio.map(s => s.scene_number)
        },
        { status: 400 }
      );
    }

    // Publish to each child profile
    const publishedStories = [];
    for (const childProfileId of childProfileIds) {
      const { data: publishedStory, error: publishError } = await supabase
        .from('published_stories')
        .upsert({
          project_id: projectId,
          child_profile_id: childProfileId,
          title: project.title,
          cover_image_url: project.cover_image_url,
          category: category,
          is_active: true,
          published_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id,child_profile_id'
        })
        .select()
        .single();

      if (publishError) {
        console.error('Error publishing story:', publishError);
        continue;
      }

      publishedStories.push(publishedStory);
    }

    // Also create a publication record for tracking
    const { data: publication } = await supabase
      .from('publications')
      .upsert({
        project_id: projectId,
        user_id: user.id,
        platform: 'kindlewood_app',
        title: project.title,
        author: user.email || 'Unknown',
        cover_image_url: project.cover_image_url,
        guid: `kindlewood-app-${projectId}`,
        status: 'live',
        published_at: new Date().toISOString(),
        live_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,platform'
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      publishedStories,
      publication,
      message: `Story published to ${publishedStories.length} child profile(s)`
    });

  } catch (error) {
    console.error('Error publishing to Kids App:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check publish status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const projectId = params.id;

    // Get published stories for this project
    const { data: publishedStories, error } = await supabase
      .from('published_stories')
      .select('*, child_profiles!inner(name)')
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get publication record
    const { data: publication } = await supabase
      .from('publications')
      .select()
      .eq('project_id', projectId)
      .eq('platform', 'kindlewood_app')
      .single();

    return NextResponse.json({
      isPublished: publishedStories && publishedStories.length > 0,
      publishedTo: publishedStories?.map(s => ({
        id: s.id,
        childName: s.child_profiles?.name,
        publishedAt: s.published_at,
      })) || [],
      publication,
    });

  } catch (error) {
    console.error('Error checking publish status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to unpublish
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const projectId = params.id;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete - set is_active to false
    const { error: updateError } = await supabase
      .from('published_stories')
      .update({ is_active: false })
      .eq('project_id', projectId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update publication status
    await supabase
      .from('publications')
      .update({
        status: 'unpublished',
        unpublished_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('platform', 'kindlewood_app');

    return NextResponse.json({
      success: true,
      message: 'Story unpublished from Kids App'
    });

  } catch (error) {
    console.error('Error unpublishing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### Task 2: Update Studio Project Page UI

**File**: `/src/app/(dashboard)/projects/[id]/page.tsx`

**Changes Needed**:

1. **Add state for Kids App publishing**:
```typescript
const [kidsAppStatus, setKidsAppStatus] = useState<'not_published' | 'published' | 'loading'>('not_published');
const [publishedProfiles, setPublishedProfiles] = useState<any[]>([]);
```

2. **Fetch Kids App status on load**:
```typescript
useEffect(() => {
  async function fetchKidsAppStatus() {
    try {
      const res = await fetch(`/api/projects/${projectId}/publish-kids-app`);
      const data = await res.json();
      if (data.isPublished) {
        setKidsAppStatus('published');
        setPublishedProfiles(data.publishedTo);
      }
    } catch (error) {
      console.error('Error fetching Kids App status:', error);
    }
  }
  fetchKidsAppStatus();
}, [projectId]);
```

3. **Replace placeholder button with real implementation** (around line 616-625):
```typescript
{/* Publish to Kids App */}
<button
  onClick={handlePublishToKidsApp}
  disabled={kidsAppStatus === 'loading' || kidsAppStatus === 'published'}
  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
    kidsAppStatus === 'published'
      ? 'bg-green-600 text-white cursor-default'
      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
  }`}
  title={
    kidsAppStatus === 'published'
      ? `Published to ${publishedProfiles.length} child profile(s)`
      : 'Publish to KindleWood Kids App'
  }
>
  {kidsAppStatus === 'loading' ? (
    <>
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span>Publishing...</span>
    </>
  ) : kidsAppStatus === 'published' ? (
    <>
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      <span>Published to Kids App</span>
    </>
  ) : (
    <>
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
      </svg>
      <span>Kids App</span>
    </>
  )}
</button>
```

4. **Add publish handler function**:
```typescript
async function handlePublishToKidsApp() {
  try {
    // First, fetch user's child profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('child_profiles')
      .select('id, name')
      .eq('parent_user_id', user?.id);

    if (profilesError || !profiles || profiles.length === 0) {
      alert('No child profiles found. Please create a child profile in the Kids App first.');
      return;
    }

    // Show modal to select which kids to publish to
    // For now, publish to all kids (you can add a modal later)
    const confirmMessage = `Publish "${project.title}" to Kids App for:\n${profiles.map(p => `• ${p.name}`).join('\n')}\n\nContinue?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setKidsAppStatus('loading');

    const childProfileIds = profiles.map(p => p.id);

    const res = await fetch(`/api/projects/${projectId}/publish-kids-app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childProfileIds,
        category: 'bedtime', // Could add category selector
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to publish');
    }

    setKidsAppStatus('published');
    setPublishedProfiles(data.publishedStories);
    alert(data.message);

  } catch (error: any) {
    console.error('Error publishing to Kids App:', error);
    alert(error.message || 'Failed to publish to Kids App');
    setKidsAppStatus('not_published');
  }
}
```

---

## Data Flow Summary

### Publishing Flow (Studio → Kids App):

1. **User clicks "Kids App" button** in Studio project page
2. **Studio fetches child profiles** for logged-in user
3. **User confirms** which kids to publish to
4. **API validates**:
   - Project ownership
   - All scenes have images
   - All scenes have audio
   - Child profiles belong to user
5. **API creates records**:
   - `published_stories` entries (one per child)
   - `publications` entry (tracking record)
6. **Kids App immediately sees story**:
   - Queries `published_stories` for child profile
   - Fetches linked `projects`, `scenes`, `generated_images`, `story_audio_pages`
   - Displays in Story Library

### Reading Flow (Kids App):

1. **Child logs in** to Kids App
2. **StoryService fetches** `published_stories` for that child
3. **Fetches related data**:
   - Project details from `projects`
   - Scenes from `scenes` (ordered by `scene_number`)
   - Images from `generated_images` (latest per scene)
   - Audio from `story_audio_pages` (latest per scene)
4. **Displays** in Story Library grid
5. **Tap to read** opens Story Reader with full content

---

## Tables Used

| Table | Purpose | Owner |
|-------|---------|-------|
| `published_stories` | ⭐ **NEW** - Links projects to kids | Both |
| `projects` | Studio projects/stories | Studio |
| `scenes` | Story pages/scenes | Studio |
| `generated_images` | Scene images | Studio |
| `story_audio_pages` | Scene audio narration | Studio |
| `child_profiles` | Kids App profiles | Kids App |
| `publications` | Publishing tracking (optional) | Studio |

---

## Migration Checklist

- [ ] **Run Database Migration**: Create `published_stories` table
- [ ] **Apply RLS Policies**: Secure table access
- [ ] **Create API Endpoint**: `/api/projects/[id]/publish-kids-app/route.ts`
- [ ] **Update Project Page**: Replace placeholder button
- [ ] **Add Publish Handler**: Implement `handlePublishToKidsApp()`
- [ ] **Add Status Fetching**: Check publish status on page load
- [ ] **Test Publishing**: Publish a story and verify in Kids App
- [ ] **Optional: Add Unpublish**: Delete/deactivate button
- [ ] **Optional: Add Category Selector**: Choose story category
- [ ] **Optional: Add Modal**: Better UX for selecting kids

---

## Testing Steps

1. **In Studio**:
   - Create a complete story with images and audio
   - Click "Kids App" button
   - Confirm publishing to child profiles
   - Verify button shows "Published to Kids App"

2. **In Kids App**:
   - Log in as child
   - Check Story Library
   - Verify published story appears
   - Open and read story
   - Verify images and audio play correctly

3. **Database Verification**:
   - Check `published_stories` table has entries
   - Verify `is_active = true`
   - Confirm correct `child_profile_id` and `project_id`

---

## Optional Enhancements

### 1. Publish Modal Component
Create a proper modal for selecting:
- Which kids to publish to (checkboxes)
- Story category (dropdown)
- Preview before publishing

### 2. Publishing Analytics
Track in `publications` table:
- Number of reads per story
- Read completion rates
- Popular stories

### 3. Unpublish Feature
Add button to:
- Set `is_active = false`
- Hide from Kids App
- Keep record for republishing

### 4. Batch Publishing
Allow publishing multiple stories at once to selected kids.

### 5. Story Updates
Handle when Studio project changes:
- Notify Kids App users
- Auto-update or require re-publish

---

## Security Considerations

1. **RLS Policies**: Ensure users can only publish their own projects
2. **Child Profile Verification**: Always verify child profiles belong to user
3. **Content Validation**: Check all scenes have required assets
4. **Rate Limiting**: Prevent spam publishing (optional)
5. **Soft Deletes**: Use `is_active` instead of hard deletes

---

## Support & Maintenance

### Common Issues:

**"Some scenes are missing images"**
- Solution: Generate images for all scenes in Studio

**"Some scenes are missing audio"**
- Solution: Generate audio for all scenes in Studio

**"No child profiles found"**
- Solution: Create child profile in Kids App first

**"Story not appearing in Kids App"**
- Check `is_active = true` in `published_stories`
- Verify `child_profile_id` matches logged-in child
- Clear Kids App cache and refresh

---

## Summary

### Database Schema Needed:
1. ✅ **`published_stories` table** - Main linking table
2. ✅ **RLS policies** - Security
3. ⚠️ Optional: **Helper function** for publishing

### Studio Implementation Needed:
1. ✅ **API endpoint** - POST/GET/DELETE `/api/projects/[id]/publish-kids-app`
2. ✅ **UI button update** - Replace placeholder with real implementation
3. ✅ **Publish handler** - Handle user interaction
4. ✅ **Status checking** - Show publish status

### Kids App (No Changes Needed):
- ✅ Already reads from `published_stories`
- ✅ Story models ready
- ✅ UI components complete

**Implementation Priority**: High - Core feature for connecting Studio to Kids App
**Estimated Development Time**: 4-6 hours
**Complexity**: Medium - Well-defined pattern to follow (Spotify reference)
