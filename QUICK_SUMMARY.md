# Kids App Publishing - Quick Summary

## What We're Building
Enable parents to publish stories from **KindleWood Studio** directly to **KindleWood Kids App** for their children.

---

## Architecture (5-Minute Overview)

### Two-Table Design

```
┌─────────────────────────────────────┐
│      publications (existing)        │
│  Tracks: "What was published where" │
└─────────────────────────────────────┘
                 │
                 │ One-to-Many
                 ▼
┌─────────────────────────────────────┐
│   publication_targets (NEW)         │
│  Tracks: "Who can access it"        │
└─────────────────────────────────────┘
```

### Example:
```
Parent publishes "Magic Forest" to Emma and Connor:

publications:
  ├─ project_id: "magic-forest-123"
  ├─ platform: "kindlewood_app"
  └─ status: "live"

publication_targets:
  ├─ target_id: "emma-uuid-456"
  └─ target_id: "connor-uuid-789"
```

---

## Implementation Checklist

### 1. Database (30 min)
```sql
-- Create table
CREATE TABLE publication_targets (
  publication_id UUID REFERENCES publications(id),
  target_type VARCHAR(50),     -- 'child_profile'
  target_id UUID,              -- child_profiles.id
  is_active BOOLEAN,
  UNIQUE(publication_id, target_id)
);

-- Add RLS policies (5 policies)
-- Add indexes (4 indexes)
```

**File**: Create new migration in `supabase/migrations/`

---

### 2. Studio API (2 hours)

**File**: `src/app/api/projects/[id]/publish-kids-app/route.ts`

**Endpoints**:
- POST - Publish to kids
- GET - Check status
- DELETE - Unpublish

**Flow**:
1. Verify project ownership ✓
2. Validate all scenes have images + audio ✓
3. Create `publications` record ✓
4. Create `publication_targets` records (one per child) ✓
5. Return success ✓

---

### 3. Studio UI (1.5 hours)

**File**: `src/app/(dashboard)/projects/[id]/page.tsx`

**Changes**:
```typescript
// Add state
const [kidsAppStatus, setKidsAppStatus] = useState('not_published');
const [publishedProfiles, setPublishedProfiles] = useState([]);

// Fetch status on load
useEffect(() => {
  fetch(`/api/projects/${id}/publish-kids-app`)
    .then(res => res.json())
    .then(data => {
      if (data.isPublished) setKidsAppStatus('published');
    });
}, []);

// Replace placeholder button
<button onClick={handlePublishToKidsApp}>
  {status === 'published' ? '✓ Published' : 'Kids App'}
</button>
```

---

### 4. Kids App Update (30 min)

**File**: `kindlewood_kids_flutter/lib/services/story_service.dart`

**Change one query**:
```dart
// OLD: Direct query to published_stories (doesn't exist)
await _supabase.from('published_stories')...

// NEW: Join through publication_targets
await _supabase.from('publication_targets')
  .select('''
    *,
    publications!inner(
      project_id,
      title,
      cover_image_url
    )
  ''')
  .eq('target_id', profile.id)
  .eq('target_type', 'child_profile')
  .eq('is_active', true);
```

**Everything else stays the same!**

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     STUDIO PROJECT                          │
│                                                             │
│  1. User clicks "Kids App" button                          │
│  2. Fetch child profiles                                   │
│  3. Show: "Publish to Emma, Connor?"                       │
│  4. User confirms                                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    API ENDPOINT                             │
│                                                             │
│  1. Verify ownership                                       │
│  2. Check all scenes have images + audio                   │
│  3. Create publications record                             │
│  4. Create publication_targets (Emma, Connor)              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE                                 │
│                                                             │
│  publications:                                             │
│    { project: "Magic Forest", platform: "kindlewood_app" } │
│                                                             │
│  publication_targets:                                      │
│    { target_id: "emma-uuid" }                              │
│    { target_id: "connor-uuid" }                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    KIDS APP                                 │
│                                                             │
│  1. Emma logs in                                           │
│  2. Query: publication_targets WHERE target_id = emma-uuid │
│  3. Join to get project details                            │
│  4. Display "Magic Forest" in Story Library                │
│  5. Emma reads story                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Benefits

### ✅ Scalable
- Works for 1 child or 10 children
- Same pattern for future platforms (YouTube, Apple Podcasts)

### ✅ Secure
- RLS policies prevent cross-family access
- UUID-based targeting (no name conflicts)
- Validates ownership at every step

### ✅ Simple
- Reuses existing `publications` table
- Kids App needs minimal changes
- Follows Spotify publishing pattern

---

## Testing Flow

1. **Studio**: Create project with images & audio
2. **Studio**: Click "Kids App" → Confirm publishing
3. **Database**: Verify records in `publications` and `publication_targets`
4. **Kids App**: Log in as child → See story in library
5. **Kids App**: Read story → Verify images, audio, word learning work

---

## Time Estimate

| Task | Time |
|------|------|
| Database migration | 30 min |
| API endpoint | 2 hours |
| Studio UI | 1.5 hours |
| Kids App update | 30 min |
| Testing | 30 min |
| **TOTAL** | **~5 hours** |

---

## Files to Create/Modify

### Studio (StoryMe)
- ✅ `supabase/migrations/20251022_add_publication_targets.sql` (NEW)
- ✅ `src/app/api/projects/[id]/publish-kids-app/route.ts` (NEW)
- ✅ `src/app/(dashboard)/projects/[id]/page.tsx` (MODIFY)

### Kids App
- ✅ `lib/services/story_service.dart` (MODIFY - one query)

---

## Security Features

```sql
-- RLS ensures Emma can only see stories published to her
WHERE target_id IN (
  SELECT id FROM child_profiles
  WHERE parent_user_id = auth.uid()
)

-- RLS ensures parents can only publish their own projects
WHERE project_id IN (
  SELECT id FROM projects
  WHERE user_id = auth.uid()
)
```

---

## Common Validation Errors

| Error | Solution |
|-------|----------|
| "Some scenes are missing images" | Generate images in Studio |
| "Some scenes are missing audio" | Generate audio (TTS) in Studio |
| "No child profiles found" | Create child profile in Kids App |
| "Invalid child profile IDs" | Child profiles must belong to logged-in user |

---

## Complete Documentation

For detailed implementation steps, see:
📄 **IMPLEMENTATION_GUIDE_KIDS_APP_PUBLISHING.md**

For architecture design rationale, see:
📄 **SCALABLE_PUBLISHING_DESIGN.md**

---

## Summary

**Database**: Add `publication_targets` table
**Studio**: Add API + update UI button
**Kids App**: Update one query
**Result**: Parents can publish stories to kids! 🎉
