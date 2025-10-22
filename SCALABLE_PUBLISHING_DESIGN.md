# Scalable Publishing System Design - Studio to Kids App

## Problem Analysis

### Current `publications` Table Design:
```sql
CONSTRAINT unique_project_platform UNIQUE(project_id, platform)
```

**Issue**: This constraint allows only ONE publication per project per platform.

**Conflict with Kids App Use Case**:
- Parents may have multiple children
- Same story should be publishable to different kids separately
- Each child has their own library and preferences

---

## Redesigned Solution: Two-Table Architecture

### Option 1: Keep `publications` + Add `publication_targets` (RECOMMENDED)

This approach maintains the generic `publications` table for tracking overall publishing per platform, while adding a child table for multi-target scenarios.

#### 1.1 Enhanced `publications` Table

**Keep existing structure**, just use `platform_metadata` smartly:

```sql
-- Example publication record for Kids App
{
  "project_id": "abc-123",
  "platform": "kindlewood_app",
  "status": "live",
  "platform_metadata": {
    "child_profile_ids": ["child-1", "child-2", "child-3"],
    "category": "bedtime",
    "published_count": 3,
    "total_reads": 47,
    "last_updated": "2025-10-22T10:00:00Z"
  }
}
```

**Pros**:
- Maintains single source of truth for "is this project published to this platform?"
- Simple queries for Studio UI (show published status)
- Uses existing JSONB field for flexibility

**Cons**:
- Can't query "which stories are available for child-1?" efficiently from Kids App
- Kids App needs to parse JSONB arrays (not optimal for RLS)
- Harder to track individual child interactions

#### 1.2 NEW `publication_targets` Table

**Purpose**: Track which specific children/audiences can access each publication.

```sql
-- Create publication_targets table
CREATE TABLE IF NOT EXISTS publication_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to parent publication
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,

  -- Target identifier (flexible for different platforms)
  target_type VARCHAR(50) NOT NULL, -- 'child_profile', 'user', 'organization', etc.
  target_id UUID NOT NULL, -- FK to child_profiles, users, etc.

  -- Target-specific metadata
  target_metadata JSONB DEFAULT '{}', -- e.g., { "category": "bedtime", "age_group": "5-7" }

  -- Access control
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,

  -- Ensure same target doesn't get duplicate entries
  CONSTRAINT unique_publication_target UNIQUE(publication_id, target_id)
);

-- Indexes
CREATE INDEX idx_publication_targets_publication ON publication_targets(publication_id);
CREATE INDEX idx_publication_targets_target ON publication_targets(target_type, target_id);
CREATE INDEX idx_publication_targets_active ON publication_targets(is_active);

-- RLS Policies
ALTER TABLE publication_targets ENABLE ROW LEVEL SECURITY;

-- Users can view targets for their publications
CREATE POLICY "Users can view their publication targets"
  ON publication_targets FOR SELECT
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Kids can view targets assigned to their profile
CREATE POLICY "Children can view stories published to them"
  ON publication_targets FOR SELECT
  USING (
    target_type = 'child_profile' AND
    target_id IN (
      SELECT id FROM child_profiles WHERE parent_user_id = auth.uid()
    )
  );

-- Users can add targets to their publications
CREATE POLICY "Users can add targets to their publications"
  ON publication_targets FOR INSERT
  WITH CHECK (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Users can update their publication targets
CREATE POLICY "Users can update their publication targets"
  ON publication_targets FOR UPDATE
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Users can remove targets
CREATE POLICY "Users can remove publication targets"
  ON publication_targets FOR DELETE
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );
```

---

## Data Model Visualization

### Publishing a Story to Kids App:

```
publications (1 record per project per platform)
├── id: "pub-123"
├── project_id: "story-abc"
├── platform: "kindlewood_app"
├── status: "live"
└── platform_metadata: { "category": "bedtime", "language": "en" }

publication_targets (multiple records for multiple kids)
├── { publication_id: "pub-123", target_type: "child_profile", target_id: "emma-123" }
├── { publication_id: "pub-123", target_type: "child_profile", target_id: "connor-456" }
└── { publication_id: "pub-123", target_type: "child_profile", target_id: "sophie-789" }
```

### For Spotify Publishing:

```
publications
├── id: "pub-456"
├── project_id: "story-abc"
├── platform: "spotify"
├── status: "live"
├── external_url: "https://spotify.com/episode/xyz"
└── compiled_audio_url: "https://storage/story-abc.mp3"

publication_targets (could be used for private podcasts)
└── { publication_id: "pub-456", target_type: "podcast_subscriber", target_id: "user-xyz" }
```

---

## Kids App Query Patterns

### Query 1: Get all stories for a specific child

```sql
SELECT
  p.project_id,
  p.title,
  p.cover_image_url,
  p.status,
  p.platform_metadata->>'category' as category,
  pt.added_at as published_at
FROM publications p
INNER JOIN publication_targets pt ON pt.publication_id = p.id
WHERE p.platform = 'kindlewood_app'
  AND p.status = 'live'
  AND pt.target_type = 'child_profile'
  AND pt.target_id = 'emma-123'
  AND pt.is_active = true
ORDER BY pt.added_at DESC;
```

### Query 2: Check if story is published to any kid

```sql
SELECT EXISTS (
  SELECT 1
  FROM publications p
  WHERE p.project_id = 'story-abc'
    AND p.platform = 'kindlewood_app'
    AND p.status IN ('live', 'published')
) as is_published;
```

### Query 3: Get which kids have access to a story

```sql
SELECT
  cp.id,
  cp.name,
  cp.age,
  pt.added_at
FROM publication_targets pt
INNER JOIN publications p ON p.id = pt.publication_id
INNER JOIN child_profiles cp ON cp.id = pt.target_id
WHERE p.project_id = 'story-abc'
  AND p.platform = 'kindlewood_app'
  AND pt.is_active = true;
```

---

## Updated Flutter Service (Kids App)

### Modify `story_service.dart`:

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
        .in('publications.status', ['live', 'published'])
        .order('added_at', ascending: false);

    // Extract project IDs
    final projectIds = (publicationsResponse as List)
        .map((row) => row['publications']['project_id'].toString())
        .toList();

    if (projectIds.isEmpty) {
      return [];
    }

    // Rest of the logic remains the same...
    // Fetch projects, scenes, images, audio as before

  } catch (e) {
    print('Error fetching stories: $e');
    rethrow;
  }
}
```

---

## Studio API Implementation

### POST `/api/projects/[id]/publish-kids-app`

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const projectId = params.id;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get request body
  const { childProfileIds, category = 'bedtime' } = await request.json();

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Verify child profiles belong to user
  const { data: profiles } = await supabase
    .from('child_profiles')
    .select('id, name')
    .in('id', childProfileIds)
    .eq('parent_user_id', user.id);

  if (!profiles || profiles.length !== childProfileIds.length) {
    return NextResponse.json({ error: 'Invalid child profiles' }, { status: 400 });
  }

  // Validate all scenes have images and audio
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id')
    .eq('project_id', projectId);

  const sceneIds = scenes.map(s => s.id);

  const { data: images } = await supabase
    .from('generated_images')
    .select('scene_id')
    .in('scene_id', sceneIds);

  const { data: audio } = await supabase
    .from('story_audio_pages')
    .select('scene_id')
    .in('scene_id', sceneIds);

  if (images.length < scenes.length || audio.length < scenes.length) {
    return NextResponse.json(
      { error: 'All scenes must have images and audio' },
      { status: 400 }
    );
  }

  // Step 1: Create or update publication record
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
      },
    }, {
      onConflict: 'project_id,platform',
      returning: 'representation',
    })
    .select()
    .single();

  if (pubError) {
    return NextResponse.json({ error: pubError.message }, { status: 500 });
  }

  // Step 2: Add publication targets for each child
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
      returning: 'representation',
    })
    .select();

  if (targetsError) {
    return NextResponse.json({ error: targetsError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    publication,
    targets: insertedTargets,
    message: `Published to ${insertedTargets.length} child profile(s)`,
  });
}
```

### GET `/api/projects/[id]/publish-kids-app` (Check Status)

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const projectId = params.id;

  // Get publication record
  const { data: publication } = await supabase
    .from('publications')
    .select(`
      *,
      publication_targets!inner(
        id,
        target_id,
        is_active,
        added_at,
        child_profiles!publication_targets_target_id_fkey(name)
      )
    `)
    .eq('project_id', projectId)
    .eq('platform', 'kindlewood_app')
    .single();

  if (!publication) {
    return NextResponse.json({
      isPublished: false,
      publishedTo: [],
    });
  }

  return NextResponse.json({
    isPublished: publication.status === 'live',
    status: publication.status,
    publishedTo: publication.publication_targets
      .filter(t => t.is_active)
      .map(t => ({
        childId: t.target_id,
        childName: t.child_profiles?.name,
        publishedAt: t.added_at,
      })),
    publication,
  });
}
```

---

## Migration Script

### New Migration: `20251022_add_publication_targets.sql`

```sql
-- Migration: Add publication_targets table for multi-target publishing
-- Description: Allows publishing to multiple children, podcast subscribers, etc.
-- Date: 2025-10-22

-- Create publication_targets table
CREATE TABLE IF NOT EXISTS publication_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to parent publication
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,

  -- Target identifier (flexible for different platforms)
  target_type VARCHAR(50) NOT NULL, -- 'child_profile', 'user', 'organization', etc.
  target_id UUID NOT NULL, -- FK to child_profiles, users, etc.

  -- Target-specific metadata
  target_metadata JSONB DEFAULT '{}',

  -- Access control
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,

  -- Ensure same target doesn't get duplicate entries
  CONSTRAINT unique_publication_target UNIQUE(publication_id, target_id)
);

-- Create indexes for performance
CREATE INDEX idx_publication_targets_publication ON publication_targets(publication_id);
CREATE INDEX idx_publication_targets_target ON publication_targets(target_type, target_id);
CREATE INDEX idx_publication_targets_active ON publication_targets(is_active);
CREATE INDEX idx_publication_targets_target_active ON publication_targets(target_id, is_active);

-- Enable Row Level Security
ALTER TABLE publication_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy 1: Users can view targets for their publications
CREATE POLICY "Users can view their publication targets"
  ON publication_targets FOR SELECT
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Children can view stories published to them
CREATE POLICY "Children can view stories published to them"
  ON publication_targets FOR SELECT
  USING (
    target_type = 'child_profile' AND
    target_id IN (
      SELECT id FROM child_profiles WHERE parent_user_id = auth.uid()
    )
  );

-- Policy 3: Users can add targets to their publications
CREATE POLICY "Users can add targets to their publications"
  ON publication_targets FOR INSERT
  WITH CHECK (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Policy 4: Users can update their publication targets
CREATE POLICY "Users can update their publication targets"
  ON publication_targets FOR UPDATE
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Policy 5: Users can remove targets
CREATE POLICY "Users can remove publication targets"
  ON publication_targets FOR DELETE
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE publication_targets IS 'Tracks which specific users/children/audiences can access each publication';
COMMENT ON COLUMN publication_targets.target_type IS 'Type of target: child_profile, user, organization, subscriber, etc.';
COMMENT ON COLUMN publication_targets.target_id IS 'ID of the target entity (child_profiles.id, users.id, etc.)';
COMMENT ON COLUMN publication_targets.target_metadata IS 'JSON field for target-specific settings (e.g., category override, permissions)';
```

---

## Benefits of This Design

### ✅ Scalability
- **Multi-child support**: Publish to any number of children
- **Future-proof**: Same pattern works for Spotify private podcasts, YouTube unlisted videos, etc.
- **Flexible targeting**: Can add organization-level publishing, subscription tiers, etc.

### ✅ Performance
- **Efficient queries**: Direct join on indexed columns
- **RLS optimized**: Policy checks use indexed foreign keys
- **No JSONB parsing**: Kids App doesn't need to parse arrays

### ✅ Analytics-Ready
- **Per-child tracking**: Can track reads, favorites, completion per child
- **Historical data**: `added_at` and `removed_at` track publishing timeline
- **Metadata extensible**: `target_metadata` can store child-specific preferences

### ✅ Separation of Concerns
- **`publications`**: Tracks "what was published where and when"
- **`publication_targets`**: Tracks "who can access it"
- Clean boundary, easy to understand and maintain

---

## Use Cases Supported

### Kids App Publishing
```
Publication: One record per project
└── Targets: Multiple children (emma, connor, sophie)
```

### Private Podcasts (Future)
```
Publication: One record per project
└── Targets: Premium subscribers (user-1, user-2, user-3)
```

### Organization Publishing (Future)
```
Publication: One record per project
└── Targets: School districts (org-1, org-2)
```

### YouTube Unlisted (Future)
```
Publication: One record per project
└── Targets: Specific email addresses (invite-only)
```

---

## Summary: What to Build

### Database (StoryMe Supabase):
1. ✅ **Keep existing `publications` table** - No changes needed
2. ✅ **Add `publication_targets` table** - New migration
3. ✅ **RLS policies** - Secure access control

### Studio Project:
1. ✅ **API endpoint** - POST/GET/DELETE for Kids App publishing
2. ✅ **UI update** - Replace placeholder button
3. ✅ **Child selector** - Modal to pick which kids to publish to

### Kids App:
1. ✅ **Update StoryService** - Join with `publication_targets`
2. ✅ **No schema changes** - Just query differently
3. ✅ **No UI changes** - Everything stays the same

---

## Migration Path

### Step 1: Run Migration
```bash
supabase migration new add_publication_targets
# Add SQL from above
supabase db push
```

### Step 2: Update Kids App Service
Modify query to join through `publication_targets` instead of `published_stories`

### Step 3: Build Studio API
Implement publish endpoint with two-step process (publication + targets)

### Step 4: Update Studio UI
Replace placeholder button with real implementation

---

## Comparison with Previous Design

| Aspect | Old Design (`published_stories`) | New Design (`publication_targets`) |
|--------|----------------------------------|-------------------------------------|
| **Scalability** | Kids App only | All platforms |
| **Multi-child** | Requires separate table | Built-in |
| **Duplication** | Separate table per use case | Single generic pattern |
| **Analytics** | Limited | Extensible per target |
| **Future platforms** | Need new tables | Reuse same pattern |
| **Complexity** | Simpler but limited | Slightly more complex but powerful |

---

**This design is production-ready, scalable, and follows industry best practices for multi-tenant, multi-platform publishing systems.**
