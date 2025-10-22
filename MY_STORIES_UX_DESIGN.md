# My Stories Page - Batch Actions UX Design

## Overview
Redesign the My Stories page with:
1. **Multi-select functionality** - Select one or multiple stories
2. **Page-level action buttons** - Batch operations on selected stories
3. **Status indicators on cards** - Visual icons showing publishing status

---

## Visual Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  My Stories                                                  [+ New] │
│  Browse and manage all your personalized storybooks                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────── Batch Actions ──────────────────────────┐ │
│  │  3 stories selected                                           │ │
│  │                                                               │ │
│  │  [🌍 Make Public]  [🎵 Publish to Spotify]                   │ │
│  │  [📱 Publish to Kids App]  [🗑️ Delete]  [✖ Cancel]          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
│  │ ☑        │  │ ☐        │  │ ☐        │                         │
│  │[Cover Img]  │[Cover Img]  │[Cover Img]                         │
│  │          │  │          │  │          │                         │
│  ├──────────┤  ├──────────┤  ├──────────┤                         │
│  │Story 1   │  │Story 2   │  │Story 3   │                         │
│  │12 scenes │  │8 scenes  │  │15 scenes │                         │
│  │10/21/2025│  │10/20/2025│  │10/19/2025│                         │
│  ├──────────┤  ├──────────┤  ├──────────┤                         │
│  │🌍 Public │  │🔒 Private│  │🌍 Public │                         │
│  │🎵 Spotify│  │🎵 Spotify│  │🎵 Spotify│                         │
│  │📱 Kids   │  │📱 Kids   │  │📱 Kids   │                         │
│  └──────────┘  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────────────────────┘

Legend for Status Icons:
🌍 Green  = Public on web
🔒 Gray   = Private

🎵 Green  = Published to Spotify
🎵 Gray   = Not published to Spotify
🎵 Blue   = Publishing in progress...

📱 Green  = Published to Kids App
📱 Gray   = Not published to Kids App
📱 Blue   = Publishing in progress...
```

---

## Detailed Design Specifications

### 1. Selection Mode

**Default State (No selections):**
- Checkbox hidden on each card
- Clicking card navigates to story viewer
- Hover shows checkbox faintly

**Active Selection State:**
- Checkbox visible on all cards
- Batch action bar appears at top
- Clicking card toggles selection (doesn't navigate)
- Click outside cards or "Cancel" exits selection mode

**How to Enter Selection Mode:**
1. User clicks checkbox on any card, OR
2. User hovers over card and clicks "Select" button that appears

### 2. Batch Action Bar

**Location:** Sticky bar below page title, above story grid

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│  {count} stories selected                                   │
│                                                             │
│  [🌍 Make Public]  [🔒 Make Private]  [🎵 Spotify]         │
│  [📱 Kids App]  [🗑️ Delete]  [✖ Cancel]                    │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Appears with smooth slide-down animation when 1+ stories selected
- Shows count of selected stories
- Buttons are disabled if action can't be performed on all selected stories
- Tooltips explain why buttons are disabled

**Button States:**

| Button | Enabled When | Action |
|--------|-------------|--------|
| Make Public | At least 1 private story selected | Set visibility to 'public' |
| Make Private | At least 1 public story selected | Set visibility to 'private' |
| Publish to Spotify | All selected stories have audio | Open Spotify publish modal |
| Publish to Kids App | Any story selected | Open Kids App publish modal |
| Delete | Any story selected | Show delete confirmation |
| Cancel | Always | Exit selection mode |

### 3. Story Card Status Indicators

**Location:** Bottom section of each card, below title/description

**Layout:**
```
┌────────────────────────────┐
│  [Cover Image]             │
│                            │
├────────────────────────────┤
│  Story Title               │
│  12 scenes • 10/21/2025    │
│  Connor and Carter...      │
├────────────────────────────┤
│  Status:                   │
│  🌍 🎵 📱                  │
└────────────────────────────┘
```

**Status Icon Variants:**

#### Web Visibility Status
- **🌍 (Green)** - "Public" - Story is visible on landing page
- **🔒 (Gray)** - "Private" - Story is private

#### Spotify Status
- **🎵 (Gray)** - "Not Published" - Story not on Spotify
- **🎵 (Blue, animated)** - "Publishing..." - Upload in progress
- **🎵 (Green)** - "Published" - Live on Spotify
- **🎵 (Red)** - "Failed" - Publishing failed

#### Kids App Status
- **📱 (Gray)** - "Not Published" - Not in Kids App
- **📱 (Blue, animated)** - "Publishing..." - Syncing to app
- **📱 (Green)** - "Published" - Available in Kids App
- **📱 (Orange)** - "Updates Available" - Story changed since last publish

**Tooltip on Hover:**
- Hovering over each icon shows detailed status
- Example: "Published to Spotify • 25 listens • Updated 2 days ago"

### 4. Interaction Flows

#### Flow 1: Make Multiple Stories Public
```
1. User clicks checkbox on Story A
   → Batch action bar slides down
   → Story A card shows checkmark

2. User clicks checkbox on Story B and C
   → Count updates: "3 stories selected"
   → Story B and C cards show checkmarks

3. User clicks "Make Public" button
   → Confirmation modal appears:
     "Make 3 stories public?"
     "Your stories will be visible on the landing page."
     [Cancel] [Make Public]

4. User clicks "Make Public"
   → Modal closes
   → Loading indicators appear on cards
   → API calls made in parallel
   → Success: 🔒 (gray) changes to 🌍 (green)
   → Toast notification: "3 stories are now public"
   → Selection mode exits
```

#### Flow 2: Publish to Spotify (Batch)
```
1. User selects 2 stories with audio narration

2. User clicks "Publish to Spotify" button

3. Modal opens showing both stories:
   ┌────────────────────────────────────────┐
   │  Publish to Spotify                    │
   ├────────────────────────────────────────┤
   │  You're publishing 2 stories:          │
   │                                        │
   │  ✓ Story A (12 scenes, 15 min audio)  │
   │  ✓ Story B (10 scenes, 12 min audio)  │
   │                                        │
   │  Total duration: 27 minutes            │
   │                                        │
   │  ⚠️ Note: Combined duration is under   │
   │     1 hour minimum for Spotify.        │
   │     Consider publishing separately or  │
   │     adding more scenes.                │
   │                                        │
   │  [Cancel]        [Download Packages]   │
   └────────────────────────────────────────┘

4. User clicks "Download Packages"
   → Generates separate package for each story
   → Downloads as ZIP file: "KindleWood-Spotify-Packages.zip"
   → Contains:
     - story-a/
       - audio.mp3
       - cover.jpg
       - metadata.json
     - story-b/
       - audio.mp3
       - cover.jpg
       - metadata.json
     - README.txt (instructions for Spotify upload)

5. Status icons update to 🎵 (green) after manual confirmation
```

#### Flow 3: Publish to Kids App (Batch)
```
1. User selects 3 stories

2. User clicks "Publish to Kids App" button

3. Modal opens:
   ┌────────────────────────────────────────┐
   │  Publish to KindleWood Kids App        │
   ├────────────────────────────────────────┤
   │  Publishing 3 stories:                 │
   │  • Story A                             │
   │  • Story B                             │
   │  • Story C                             │
   │                                        │
   │  Select Child Profiles:                │
   │  ┌──────────────────────────────────┐ │
   │  │ [☑] Emma (Age 7)                 │ │
   │  │ [☑] Lucas (Age 5)                │ │
   │  │ [☐] Olivia (Age 9)               │ │
   │  └──────────────────────────────────┘ │
   │                                        │
   │  Options:                              │
   │  [☑] Allow offline reading             │
   │  [☐] Notify children when published    │
   │                                        │
   │  [Cancel]              [Publish Now]   │
   └────────────────────────────────────────┘

4. User clicks "Publish Now"
   → Modal closes
   → Cards show 📱 (blue, animated) "Publishing..."
   → API creates story_access records for Emma & Lucas
   → Push notifications sent (if enabled)
   → Icons update to 📱 (green) "Published"
   → Toast: "3 stories published to Kids App"
```

---

## Component Structure

### 1. Updated `ProjectsPage.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StoryCard from '@/components/projects/StoryCard';
import BatchActionBar from '@/components/projects/BatchActionBar';
import PublishModal from '@/components/publishing/PublishModal';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publishModalOpen, setPublishModalOpen] = useState<{
    platform: 'spotify' | 'kids-app' | null;
    storyIds: string[];
  }>({ platform: null, storyIds: [] });

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  // Select all
  const selectAll = () => {
    setSelectedIds(new Set(projects.map(p => p.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Batch make public
  const batchMakePublic = async () => {
    const ids = Array.from(selectedIds);
    // Show confirmation modal
    // Call API to update visibility
    // Update local state
    // Clear selection
  };

  // Batch publish to Spotify
  const batchPublishSpotify = () => {
    setPublishModalOpen({
      platform: 'spotify',
      storyIds: Array.from(selectedIds)
    });
  };

  // Batch publish to Kids App
  const batchPublishKidsApp = () => {
    setPublishModalOpen({
      platform: 'kids-app',
      storyIds: Array.from(selectedIds)
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Stories</h1>
          <p className="text-gray-600">
            Browse and manage all your personalized storybooks
          </p>
        </div>
        <Link
          href="/create"
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold shadow-md transition-all"
        >
          + New Story
        </Link>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <BatchActionBar
          selectedCount={selectedIds.size}
          onMakePublic={batchMakePublic}
          onMakePrivate={batchMakePrivate}
          onPublishSpotify={batchPublishSpotify}
          onPublishKidsApp={batchPublishKidsApp}
          onDelete={batchDelete}
          onCancel={clearSelection}
          selectedProjects={projects.filter(p => selectedIds.has(p.id))}
        />
      )}

      {/* Stories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <StoryCard
            key={project.id}
            project={project}
            isSelected={selectedIds.has(project.id)}
            onToggleSelect={toggleSelection}
            selectionMode={selectedIds.size > 0}
          />
        ))}
      </div>

      {/* Publish Modal */}
      <PublishModal
        isOpen={publishModalOpen.platform !== null}
        platform={publishModalOpen.platform}
        storyIds={publishModalOpen.storyIds}
        onClose={() => setPublishModalOpen({ platform: null, storyIds: [] })}
      />
    </div>
  );
}
```

### 2. New `BatchActionBar.tsx`

```typescript
'use client';

interface BatchActionBarProps {
  selectedCount: number;
  onMakePublic: () => void;
  onMakePrivate: () => void;
  onPublishSpotify: () => void;
  onPublishKidsApp: () => void;
  onDelete: () => void;
  onCancel: () => void;
  selectedProjects: any[];
}

export default function BatchActionBar({
  selectedCount,
  onMakePublic,
  onMakePrivate,
  onPublishSpotify,
  onPublishKidsApp,
  onDelete,
  onCancel,
  selectedProjects,
}: BatchActionBarProps) {
  // Check if any selected story is private
  const hasPrivate = selectedProjects.some(p => p.visibility === 'private');
  // Check if any selected story is public
  const hasPublic = selectedProjects.some(p => p.visibility === 'public');
  // Check if all selected stories have audio
  const allHaveAudio = selectedProjects.every(p => p.hasAudio);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 mb-6 shadow-lg animate-slideDown">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Selection count */}
        <div className="text-sm font-semibold text-gray-700">
          {selectedCount} {selectedCount === 1 ? 'story' : 'stories'} selected
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Make Public */}
          {hasPrivate && (
            <button
              onClick={onMakePublic}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm shadow-md transition-all"
            >
              <span>🌍</span>
              <span>Make Public</span>
            </button>
          )}

          {/* Make Private */}
          {hasPublic && (
            <button
              onClick={onMakePrivate}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium text-sm shadow-md transition-all"
            >
              <span>🔒</span>
              <span>Make Private</span>
            </button>
          )}

          {/* Publish to Spotify */}
          <button
            onClick={onPublishSpotify}
            disabled={!allHaveAudio}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 font-medium text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={!allHaveAudio ? 'All stories must have audio narration' : 'Publish to Spotify'}
          >
            <span>🎵</span>
            <span>Spotify</span>
          </button>

          {/* Publish to Kids App */}
          <button
            onClick={onPublishKidsApp}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 font-medium text-sm shadow-md transition-all"
          >
            <span>📱</span>
            <span>Kids App</span>
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm shadow-md transition-all"
          >
            <span>🗑️</span>
            <span>Delete</span>
          </button>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm shadow-md transition-all"
          >
            <span>✖</span>
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Updated `StoryCard.tsx`

```typescript
'use client';

interface StoryCardProps {
  project: any;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  selectionMode: boolean;
}

export default function StoryCard({
  project,
  isSelected,
  onToggleSelect,
  selectionMode,
}: StoryCardProps) {
  const handleCardClick = () => {
    if (selectionMode) {
      // In selection mode, clicking toggles selection
      onToggleSelect(project.id);
    } else {
      // Normal mode, navigate to story viewer
      router.push(`/projects/${project.id}`);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(project.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer relative ${
        isSelected ? 'ring-4 ring-blue-500' : ''
      }`}
    >
      {/* Selection Checkbox */}
      {(selectionMode || isSelected) && (
        <div
          className="absolute top-3 left-3 z-10"
          onClick={handleCheckboxClick}
        >
          <div
            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-blue-600 border-blue-600'
                : 'bg-white border-gray-400 hover:border-blue-500'
            }`}
          >
            {isSelected && (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Cover Image */}
      <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
        {project.coverImage ? (
          <img
            src={project.coverImage}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">📖</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Title and Meta */}
        <h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-1">
          {project.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span>{project.sceneCount} scenes</span>
          <span>•</span>
          <span>{formatDate(project.createdAt)}</span>
        </div>

        {project.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Status Indicators */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
          <span className="text-xs font-medium text-gray-500">Status:</span>

          {/* Web Visibility */}
          <PublishStatusIcon
            type="web"
            status={project.visibility === 'public' ? 'published' : 'not-published'}
            tooltip={project.visibility === 'public' ? 'Public on web' : 'Private'}
          />

          {/* Spotify */}
          <PublishStatusIcon
            type="spotify"
            status={project.spotifyStatus || 'not-published'}
            tooltip={getSpotifyTooltip(project)}
          />

          {/* Kids App */}
          <PublishStatusIcon
            type="kids-app"
            status={project.kidsAppStatus || 'not-published'}
            tooltip={getKidsAppTooltip(project)}
          />
        </div>
      </div>
    </div>
  );
}
```

### 4. New `PublishStatusIcon.tsx`

```typescript
'use client';

interface PublishStatusIconProps {
  type: 'web' | 'spotify' | 'kids-app';
  status: 'not-published' | 'publishing' | 'published' | 'failed' | 'updates-available';
  tooltip: string;
}

export default function PublishStatusIcon({ type, status, tooltip }: PublishStatusIconProps) {
  const getIcon = () => {
    switch (type) {
      case 'web':
        return status === 'published' ? '🌍' : '🔒';
      case 'spotify':
        return '🎵';
      case 'kids-app':
        return '📱';
    }
  };

  const getColor = () => {
    switch (status) {
      case 'not-published':
        return 'text-gray-400';
      case 'publishing':
        return 'text-blue-500 animate-pulse';
      case 'published':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'updates-available':
        return 'text-orange-500';
    }
  };

  return (
    <div className="relative group">
      <span className={`text-xl ${getColor()} transition-all cursor-help`}>
        {getIcon()}
      </span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {tooltip}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}
```

---

## Database Schema Updates

```sql
-- Add publishing status columns to projects table
ALTER TABLE projects
ADD COLUMN spotify_status VARCHAR(20) DEFAULT 'not-published',
ADD COLUMN spotify_published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN spotify_url TEXT,
ADD COLUMN kids_app_status VARCHAR(20) DEFAULT 'not-published',
ADD COLUMN kids_app_published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN has_audio BOOLEAN DEFAULT false;

-- Create index for status queries
CREATE INDEX idx_projects_spotify_status ON projects(spotify_status);
CREATE INDEX idx_projects_kids_app_status ON projects(kids_app_status);

-- Or use the separate publishing_status table as described in the main plan
```

---

## API Endpoints

### Batch Update Visibility
```typescript
POST /api/projects/batch-update-visibility
Request:
{
  projectIds: string[];
  visibility: 'public' | 'private';
}

Response:
{
  success: true,
  updated: number;
  errors: string[];
}
```

### Batch Publish to Spotify
```typescript
POST /api/projects/batch-publish-spotify
Request:
{
  projectIds: string[];
}

Response:
{
  success: true,
  packages: [
    {
      projectId: string;
      audioUrl: string;
      coverUrl: string;
      metadata: SpotifyMetadata;
    }
  ];
  downloadUrl: string; // ZIP file with all packages
}
```

### Batch Publish to Kids App
```typescript
POST /api/projects/batch-publish-kids-app
Request:
{
  projectIds: string[];
  childProfileIds: string[];
  options: {
    allowOffline: boolean;
    notify: boolean;
  };
}

Response:
{
  success: true,
  published: number;
  errors: string[];
}
```

---

## Animation & Styling

### Slide Down Animation for Batch Bar
```css
@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slideDown {
  animation: slideDown 0.3s ease-out;
}
```

### Status Icon Pulse Animation
```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

## Mobile Responsive Design

### Small Screens (< 640px)
```
┌──────────────────────────┐
│  My Stories       [+ New]│
├──────────────────────────┤
│  2 selected              │
│  [🌍][🎵][📱][🗑️][✖]   │
├──────────────────────────┤
│  ┌────────────────────┐  │
│  │ ☑ [Cover]         │  │
│  │ Story 1           │  │
│  │ 🌍 🎵 📱         │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ ☑ [Cover]         │  │
│  │ Story 2           │  │
│  │ 🌍 🎵 📱         │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

- Action buttons stack vertically or show icons only
- Status icons remain visible
- Single column grid

---

## Benefits of This UX Approach

✅ **Efficient Batch Operations**
- Publish 10 stories at once instead of one-by-one
- Save clicks and time

✅ **Clear Visual Status**
- Immediately see which stories are published where
- No need to open each story to check

✅ **Scalable Design**
- Easy to add more platforms (YouTube, Apple Books, etc.)
- Just add another icon

✅ **Familiar Pattern**
- Similar to Gmail, Google Drive, Dropbox
- Users already understand this interaction model

✅ **Mobile Friendly**
- Works on all screen sizes
- Touch-friendly targets

✅ **Accessible**
- Keyboard navigation support
- Screen reader friendly
- Clear focus states

---

## Implementation Checklist

### Phase 1: Basic Selection (Week 1)
- [ ] Add checkbox to StoryCard component
- [ ] Implement selection state management
- [ ] Create BatchActionBar component
- [ ] Add slide-down animation
- [ ] Mobile responsive layout

### Phase 2: Status Indicators (Week 1-2)
- [ ] Create PublishStatusIcon component
- [ ] Add status columns to database
- [ ] Update API to return status data
- [ ] Implement tooltip styling
- [ ] Add icon color variants

### Phase 3: Batch Actions (Week 2-3)
- [ ] Batch visibility update API
- [ ] Batch Spotify publish API
- [ ] Batch Kids App publish API
- [ ] Confirmation modals
- [ ] Error handling and retries

### Phase 4: Polish (Week 3-4)
- [ ] Loading states and animations
- [ ] Success/error toasts
- [ ] Keyboard shortcuts (Ctrl+A for select all)
- [ ] Analytics tracking
- [ ] User testing and feedback

---

**Total Estimated Time:** 3-4 weeks for complete implementation
**Priority:** High - Significantly improves UX for power users with many stories
