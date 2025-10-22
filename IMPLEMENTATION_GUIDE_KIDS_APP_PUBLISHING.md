# Implementation Guide: Kids App Publishing Feature

## Overview
Enable publishing stories from KindleWood Studio to KindleWood Kids App using the existing `publications` table architecture.

**Estimated Time**: 4-6 hours
**Complexity**: Medium
**Priority**: High

---

## Architecture Summary

### Data Model (Two-Table Design)

```
publications (existing - no changes needed)
├── One record per project per platform
├── Tracks: "Story X was published to Platform Y"
└── Status tracking: pending → live → unpublished

publication_targets (NEW table)
├── Multiple records per publication
├── Tracks: "Who can access this publication"
└── Supports: child_profiles, users, subscribers, etc.
```

### Example Flow:
```
Parent publishes "Magic Forest" to Kids App for Emma and Connor:

publications:
  { project_id: "magic-forest", platform: "kindlewood_app", status: "live" }

publication_targets:
  { publication_id, target_type: "child_profile", target_id: "emma-uuid" }
  { publication_id, target_type: "child_profile", target_id: "connor-uuid" }
```

---

## Step 1: Database Migration

### Create Migration File
**Path**: `supabase/migrations/20251022_add_publication_targets.sql`

```sql
-- Migration: Add publication_targets table for multi-target publishing
-- Description: Allows publishing to multiple children, subscribers, etc.
-- Date: 2025-10-22

-- Create publication_targets table
CREATE TABLE IF NOT EXISTS publication_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to parent publication
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,

  -- Target identifier (flexible for different platforms)
  target_type VARCHAR(50) NOT NULL,
  -- Examples: 'child_profile', 'user', 'subscriber', 'organization'

  target_id UUID NOT NULL,
  -- References: child_profiles.id, users.id, etc.

  -- Target-specific metadata (JSONB for flexibility)
  target_metadata JSONB DEFAULT '{}',
  -- Examples: { "category": "bedtime", "reading_level": "advanced", "favorite": true }

  -- Access control
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT unique_publication_target UNIQUE(publication_id, target_id)
);

-- Create indexes for performance
CREATE INDEX idx_publication_targets_publication
  ON publication_targets(publication_id);

CREATE INDEX idx_publication_targets_target
  ON publication_targets(target_type, target_id);

CREATE INDEX idx_publication_targets_active
  ON publication_targets(is_active);

CREATE INDEX idx_publication_targets_target_active
  ON publication_targets(target_id, is_active);

-- Enable Row Level Security
ALTER TABLE publication_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Users can view targets for their publications
CREATE POLICY "Users can view their publication targets"
  ON publication_targets FOR SELECT
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- RLS Policy 2: Children can view stories published to them
CREATE POLICY "Children can view stories published to them"
  ON publication_targets FOR SELECT
  USING (
    target_type = 'child_profile' AND
    target_id IN (
      SELECT id FROM child_profiles WHERE parent_user_id = auth.uid()
    )
  );

-- RLS Policy 3: Users can add targets to their publications
CREATE POLICY "Users can add targets to their publications"
  ON publication_targets FOR INSERT
  WITH CHECK (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- RLS Policy 4: Users can update their publication targets
CREATE POLICY "Users can update their publication targets"
  ON publication_targets FOR UPDATE
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- RLS Policy 5: Users can remove targets
CREATE POLICY "Users can remove publication targets"
  ON publication_targets FOR DELETE
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE publication_targets IS
  'Tracks which specific users/children/audiences can access each publication';

COMMENT ON COLUMN publication_targets.target_type IS
  'Type of target: child_profile, user, organization, subscriber, etc.';

COMMENT ON COLUMN publication_targets.target_id IS
  'UUID of the target entity (child_profiles.id, users.id, etc.)';

COMMENT ON COLUMN publication_targets.target_metadata IS
  'JSON field for target-specific settings (e.g., category override, permissions)';
```

### Run Migration
```bash
cd storyme-app
supabase migration new add_publication_targets
# Copy SQL above into the new migration file
supabase db push
```

---

## Step 2: Create API Endpoint

### File: `src/app/api/projects/[id]/publish-kids-app/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/projects/[id]/publish-kids-app
 * Publish a story to KindleWood Kids App for selected children
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const projectId = params.id;

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get request body
    const body = await request.json();
    const { childProfileIds, category = 'bedtime' } = body;

    if (!childProfileIds || !Array.isArray(childProfileIds) || childProfileIds.length === 0) {
      return NextResponse.json(
        { error: 'childProfileIds array is required' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, title, cover_image_url, description')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // 4. Verify all child profiles belong to user
    const { data: profiles, error: profilesError } = await supabase
      .from('child_profiles')
      .select('id, name')
      .in('id', childProfileIds)
      .eq('parent_user_id', user.id);

    if (profilesError || !profiles || profiles.length !== childProfileIds.length) {
      return NextResponse.json(
        { error: 'Invalid child profile IDs' },
        { status: 400 }
      );
    }

    // 5. Validate project has all required content
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

    const sceneIds = scenes.map(s => s.id);

    // 6. Verify all scenes have images
    const { data: images, error: imagesError } = await supabase
      .from('generated_images')
      .select('scene_id')
      .in('scene_id', sceneIds);

    if (imagesError) {
      return NextResponse.json({ error: 'Error checking images' }, { status: 500 });
    }

    const scenesWithImages = new Set(images?.map(i => i.scene_id) || []);
    const missingImages = scenes.filter(s => !scenesWithImages.has(s.id));

    if (missingImages.length > 0) {
      return NextResponse.json(
        {
          error: 'Some scenes are missing images',
          missingScenes: missingImages.map(s => s.scene_number),
          message: `Please generate images for scene(s): ${missingImages.map(s => s.scene_number).join(', ')}`
        },
        { status: 400 }
      );
    }

    // 7. Verify all scenes have audio
    const { data: audioFiles, error: audioError } = await supabase
      .from('story_audio_pages')
      .select('scene_id')
      .in('scene_id', sceneIds);

    if (audioError) {
      return NextResponse.json({ error: 'Error checking audio' }, { status: 500 });
    }

    const scenesWithAudio = new Set(audioFiles?.map(a => a.scene_id) || []);
    const missingAudio = scenes.filter(s => !scenesWithAudio.has(s.id));

    if (missingAudio.length > 0) {
      return NextResponse.json(
        {
          error: 'Some scenes are missing audio',
          missingScenes: missingAudio.map(s => s.scene_number),
          message: `Please generate audio for scene(s): ${missingAudio.map(s => s.scene_number).join(', ')}`
        },
        { status: 400 }
      );
    }

    // 8. Create or update publication record
    const { data: publication, error: pubError } = await supabase
      .from('publications')
      .upsert({
        project_id: projectId,
        user_id: user.id,
        platform: 'kindlewood_app',
        title: project.title,
        author: user.email || 'Unknown',
        description: project.description,
        cover_image_url: project.cover_image_url,
        guid: `kindlewood-app-${projectId}`,
        status: 'live',
        published_at: new Date().toISOString(),
        live_at: new Date().toISOString(),
        platform_metadata: {
          category: category,
          language: 'en',
          child_count: childProfileIds.length,
          scene_count: scenes.length,
        },
      }, {
        onConflict: 'project_id,platform',
      })
      .select()
      .single();

    if (pubError) {
      console.error('Error creating publication:', pubError);
      return NextResponse.json({ error: pubError.message }, { status: 500 });
    }

    // 9. Add publication targets for each child
    const targets = childProfileIds.map(childId => ({
      publication_id: publication.id,
      target_type: 'child_profile',
      target_id: childId,
      is_active: true,
      target_metadata: {
        category: category,
      },
    }));

    const { data: insertedTargets, error: targetsError } = await supabase
      .from('publication_targets')
      .upsert(targets, {
        onConflict: 'publication_id,target_id',
      })
      .select();

    if (targetsError) {
      console.error('Error creating publication targets:', targetsError);
      return NextResponse.json({ error: targetsError.message }, { status: 500 });
    }

    // 10. Return success response
    return NextResponse.json({
      success: true,
      publication,
      targets: insertedTargets,
      publishedTo: profiles.map(p => p.name),
      message: `"${project.title}" published to ${insertedTargets.length} child profile(s): ${profiles.map(p => p.name).join(', ')}`,
    });

  } catch (error) {
    console.error('Error publishing to Kids App:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/publish-kids-app
 * Check if a story is published to Kids App and get details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const projectId = params.id;

    // Get publication record with targets
    const { data: publication, error } = await supabase
      .from('publications')
      .select(`
        *,
        publication_targets!inner(
          id,
          target_id,
          is_active,
          added_at,
          child_profiles!publication_targets_target_id_fkey(
            id,
            name
          )
        )
      `)
      .eq('project_id', projectId)
      .eq('platform', 'kindlewood_app')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error)
      console.error('Error fetching publication:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!publication) {
      return NextResponse.json({
        isPublished: false,
        status: 'not_published',
        publishedTo: [],
      });
    }

    const activeTargets = publication.publication_targets.filter(t => t.is_active);

    return NextResponse.json({
      isPublished: publication.status === 'live' && activeTargets.length > 0,
      status: publication.status,
      publishedAt: publication.published_at,
      publishedTo: activeTargets.map(t => ({
        childId: t.target_id,
        childName: t.child_profiles?.name || 'Unknown',
        publishedAt: t.added_at,
      })),
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

/**
 * DELETE /api/projects/[id]/publish-kids-app
 * Unpublish a story from Kids App
 */
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

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Get publication
    const { data: publication } = await supabase
      .from('publications')
      .select('id')
      .eq('project_id', projectId)
      .eq('platform', 'kindlewood_app')
      .single();

    if (!publication) {
      return NextResponse.json(
        { error: 'Publication not found' },
        { status: 404 }
      );
    }

    // Soft delete - set is_active to false for all targets
    const { error: targetsError } = await supabase
      .from('publication_targets')
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
      })
      .eq('publication_id', publication.id);

    if (targetsError) {
      return NextResponse.json({ error: targetsError.message }, { status: 500 });
    }

    // Update publication status
    const { error: pubError } = await supabase
      .from('publications')
      .update({
        status: 'unpublished',
        unpublished_at: new Date().toISOString(),
      })
      .eq('id', publication.id);

    if (pubError) {
      return NextResponse.json({ error: pubError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Story unpublished from Kids App',
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

## Step 3: Update Project Page UI

### File: `src/app/(dashboard)/projects/[id]/page.tsx`

### 3.1 Add State Variables

Add these to your component state (around line 50-80 where other state is defined):

```typescript
// Kids App publishing state
const [kidsAppStatus, setKidsAppStatus] = useState<'not_published' | 'loading' | 'published'>('not_published');
const [publishedProfiles, setPublishedProfiles] = useState<Array<{
  childId: string;
  childName: string;
  publishedAt: string;
}>>([]);
```

### 3.2 Add Status Fetching Effect

Add this useEffect after your existing effects:

```typescript
// Fetch Kids App publish status
useEffect(() => {
  async function fetchKidsAppStatus() {
    try {
      const res = await fetch(`/api/projects/${projectId}/publish-kids-app`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.isPublished) {
        setKidsAppStatus('published');
        setPublishedProfiles(data.publishedTo || []);
      }
    } catch (error) {
      console.error('Error fetching Kids App status:', error);
    }
  }

  if (projectId) {
    fetchKidsAppStatus();
  }
}, [projectId]);
```

### 3.3 Add Publish Handler Function

Add this handler function with your other handlers:

```typescript
async function handlePublishToKidsApp() {
  try {
    // Fetch user's child profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('child_profiles')
      .select('id, name, age')
      .eq('parent_user_id', user?.id)
      .order('name');

    if (profilesError) {
      console.error('Error fetching child profiles:', profilesError);
      alert('Error loading child profiles. Please try again.');
      return;
    }

    if (!profiles || profiles.length === 0) {
      alert('No child profiles found.\n\nPlease create a child profile in the KindleWood Kids App first.');
      return;
    }

    // Show confirmation with list of kids
    const confirmMessage = `Publish "${project.title}" to KindleWood Kids App for:\n\n${profiles.map(p => `  • ${p.name} (age ${p.age})`).join('\n')}\n\nContinue?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setKidsAppStatus('loading');

    // Publish to all kids (could add modal for selection later)
    const childProfileIds = profiles.map(p => p.id);

    const res = await fetch(`/api/projects/${projectId}/publish-kids-app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childProfileIds,
        category: 'bedtime', // Could add category selector in future
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to publish');
    }

    setKidsAppStatus('published');
    setPublishedProfiles(data.targets?.map((t: any, i: number) => ({
      childId: t.target_id,
      childName: profiles[i]?.name || 'Unknown',
      publishedAt: t.added_at,
    })) || []);

    alert(`✅ ${data.message}`);

  } catch (error: any) {
    console.error('Error publishing to Kids App:', error);
    alert(`❌ ${error.message || 'Failed to publish to Kids App'}`);
    setKidsAppStatus('not_published');
  }
}
```

### 3.4 Replace Placeholder Button

Find the "Kids App" button (around line 616-625) and replace with:

```typescript
{/* Publish to Kids App Button */}
<button
  onClick={handlePublishToKidsApp}
  disabled={kidsAppStatus === 'loading' || kidsAppStatus === 'published'}
  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
    kidsAppStatus === 'published'
      ? 'bg-green-600 text-white cursor-default'
      : kidsAppStatus === 'loading'
      ? 'bg-gray-400 text-white cursor-wait'
      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
  }`}
  title={
    kidsAppStatus === 'published'
      ? `Published to: ${publishedProfiles.map(p => p.childName).join(', ')}`
      : 'Publish to KindleWood Kids App'
  }
>
  {kidsAppStatus === 'loading' ? (
    <>
      {/* Loading Spinner */}
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>Publishing...</span>
    </>
  ) : kidsAppStatus === 'published' ? (
    <>
      {/* Checkmark Icon */}
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span>Published to Kids App ({publishedProfiles.length})</span>
    </>
  ) : (
    <>
      {/* Kids Icon */}
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
      </svg>
      <span>Kids App</span>
    </>
  )}
</button>
```

---

## Step 4: Update Kids App (Flutter)

### File: `kindlewood_kids_flutter/lib/services/story_service.dart`

### Update the `getStoriesForProfile` method:

Find the method around line 12-157 and replace the query section (lines 16-27) with:

```dart
/// Get published stories for a child profile
Future<List<StoryWithProject>> getStoriesForProfile(
  ChildProfile profile,
) async {
  try {
    // Fetch publications published to this child via publication_targets
    final publicationsResponse = await _supabase
        .from('publication_targets')
        .select('''
          *,
          publications!inner(
            id,
            project_id,
            title,
            cover_image_url,
            status,
            platform_metadata,
            published_at
          )
        ''')
        .eq('target_type', 'child_profile')
        .eq('target_id', profile.id)
        .eq('is_active', true)
        .eq('publications.platform', 'kindlewood_app')
        .in_('publications.status', ['live', 'published'])
        .order('added_at', ascending: false);

    // Extract project IDs from the joined query
    final projectIds = <String>[];
    final Map<String, Map<String, dynamic>> publicationsMap = {};

    for (final row in publicationsResponse as List) {
      final pub = row['publications'] as Map<String, dynamic>;
      final projectId = pub['project_id'].toString();
      projectIds.add(projectId);
      publicationsMap[projectId] = pub;
    }

    if (projectIds.isEmpty) {
      return [];
    }

    // Rest of the method remains the same - fetch projects, scenes, images, audio
    final projectsResponse = await _supabase
        .from('projects')
        .select()
        .in_('id', projectIds);

    // ... (keep existing code for fetching scenes, images, audio, etc.)

  } catch (e) {
    print('Error fetching stories: $e');
    rethrow;
  }
}
```

**Note**: The rest of the method (fetching scenes, images, audio) remains exactly the same!

---

## Testing Checklist

### Database Migration
- [ ] Run migration successfully
- [ ] Verify `publication_targets` table exists
- [ ] Check RLS policies are active
- [ ] Test query performance (should be fast)

### Studio - Publishing
- [ ] Navigate to a complete project (with images & audio)
- [ ] Click "Kids App" button
- [ ] Verify child profiles load correctly
- [ ] Confirm publishing dialog shows correct kids
- [ ] Publish successfully
- [ ] Verify button changes to "Published to Kids App (N)"
- [ ] Check database: `publications` and `publication_targets` have records

### Studio - Validation
- [ ] Try publishing project without images → Should show error
- [ ] Try publishing project without audio → Should show error
- [ ] Try publishing with no child profiles → Should show helpful message

### Kids App - Viewing
- [ ] Log in as child profile
- [ ] Verify published story appears in Story Library
- [ ] Open story and verify all pages load
- [ ] Verify images display correctly
- [ ] Verify audio plays correctly
- [ ] Test word tapping (definitions)

### Cross-Family Security
- [ ] Create two test families with same child name
- [ ] Publish story in Family 1
- [ ] Log in as Family 2's child
- [ ] Verify story does NOT appear (RLS working)

### Unpublishing
- [ ] Click unpublish (if implemented)
- [ ] Verify story disappears from Kids App
- [ ] Verify database: `is_active = false`, `status = 'unpublished'`

---

## Common Issues & Solutions

### Issue: "Some scenes are missing images"
**Solution**: Generate images for all scenes in Studio before publishing

### Issue: "Some scenes are missing audio"
**Solution**: Generate audio (TTS) for all scenes in Studio before publishing

### Issue: "No child profiles found"
**Solution**:
1. Open KindleWood Kids App
2. Create at least one child profile
3. Try publishing again

### Issue: Story not appearing in Kids App after publishing
**Checklist**:
- [ ] Check `publications.status = 'live'`
- [ ] Check `publication_targets.is_active = true`
- [ ] Verify `target_id` matches logged-in child's UUID
- [ ] Clear Kids App cache and reload
- [ ] Check RLS policies are active

### Issue: Publishing fails with "Invalid child profile IDs"
**Solution**: Ensure child profiles belong to the logged-in user (check `parent_user_id`)

---

## Future Enhancements (Optional)

### 1. Child Selector Modal
Replace `confirm()` dialog with proper modal:
- Checkboxes to select which kids
- Preview story details
- Choose category per child

### 2. Category Selector
Add dropdown to choose story category:
- Bedtime
- Adventure
- Learning
- Educational

### 3. Unpublish Button
Add button to unpublish from Kids App:
- Remove from specific kids
- Remove from all kids
- Soft delete (keep history)

### 4. Publishing Analytics
Track in `publication_targets.target_metadata`:
```json
{
  "total_reads": 23,
  "last_read_at": "2025-10-22T10:30:00Z",
  "favorite": true,
  "completion_rate": 0.85
}
```

### 5. Batch Publishing
Publish multiple stories at once:
- Select multiple projects
- Publish all to selected kids
- Show progress bar

---

## Database Schema Reference

### `publications` (Existing - No Changes)
```sql
id UUID PRIMARY KEY
project_id UUID REFERENCES projects(id)
user_id UUID REFERENCES users(id)
platform VARCHAR(50)  -- 'kindlewood_app'
status VARCHAR(50)    -- 'live', 'unpublished'
title TEXT
cover_image_url TEXT
platform_metadata JSONB  -- { "category": "bedtime", "child_count": 3 }
published_at TIMESTAMPTZ
live_at TIMESTAMPTZ
UNIQUE(project_id, platform)
```

### `publication_targets` (NEW)
```sql
id UUID PRIMARY KEY
publication_id UUID REFERENCES publications(id)
target_type VARCHAR(50)  -- 'child_profile'
target_id UUID           -- child_profiles.id
target_metadata JSONB    -- { "category": "bedtime" }
is_active BOOLEAN        -- true/false
added_at TIMESTAMPTZ
removed_at TIMESTAMPTZ
UNIQUE(publication_id, target_id)
```

### `child_profiles` (Existing)
```sql
id UUID PRIMARY KEY
parent_user_id UUID REFERENCES users(id)
name TEXT
age INTEGER
avatar_url TEXT
created_at TIMESTAMPTZ
```

---

## API Endpoints Summary

### POST `/api/projects/[id]/publish-kids-app`
**Purpose**: Publish story to Kids App

**Request Body**:
```json
{
  "childProfileIds": ["uuid-1", "uuid-2"],
  "category": "bedtime"
}
```

**Response**:
```json
{
  "success": true,
  "publication": { ... },
  "targets": [ ... ],
  "message": "Published to 2 child profile(s)"
}
```

### GET `/api/projects/[id]/publish-kids-app`
**Purpose**: Check publish status

**Response**:
```json
{
  "isPublished": true,
  "status": "live",
  "publishedTo": [
    { "childId": "uuid-1", "childName": "Emma" },
    { "childId": "uuid-2", "childName": "Connor" }
  ]
}
```

### DELETE `/api/projects/[id]/publish-kids-app`
**Purpose**: Unpublish story

**Response**:
```json
{
  "success": true,
  "message": "Story unpublished from Kids App"
}
```

---

## Security Considerations

✅ **Row Level Security (RLS)**
- Users can only publish their own projects
- Users can only publish to their own child profiles
- Children can only see stories published to them

✅ **Validation**
- Verify project ownership
- Verify child profile ownership
- Ensure all scenes have images and audio

✅ **UUID-based targeting**
- No name collisions across families
- Secure foreign key references
- Database-enforced integrity

✅ **Soft deletes**
- `is_active` flag instead of hard delete
- Preserve publishing history
- Enable re-publishing

---

## Support

### Questions During Implementation
- Check existing Spotify publishing (`publish-spotify/route.ts`) for reference
- Review `publications` table schema in migration `20251021_add_publications_generic.sql`
- Test RLS policies in Supabase Dashboard

### Post-Implementation
- Monitor error logs in API routes
- Check Supabase logs for RLS policy issues
- Test with real users in staging environment

---

## Summary

**What's Being Built:**
1. ✅ Database table for multi-child targeting
2. ✅ API endpoint for publishing/unpublishing
3. ✅ Studio UI for publishing workflow
4. ✅ Kids App query updates (minimal changes)

**Time Estimate:**
- Database migration: 30 minutes
- API endpoint: 2 hours
- Studio UI: 1.5 hours
- Kids App updates: 30 minutes
- Testing: 30 minutes
- **Total: ~5 hours**

**Dependencies:**
- Existing `publications` table ✅
- Existing `child_profiles` table ✅
- Existing Spotify publishing pattern ✅

**Result:**
Parents can publish stories from Studio directly to their children's Kids App library with full security and validation!
