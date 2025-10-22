# Story Viewer Page - Publishing UI Design

## Overview
Update the Story Viewer page to include:
1. **Compact action buttons** with icons and smaller text
2. **Publishing status indicators** similar to My Stories page
3. **Publishing modals** for Spotify and Kids App

---

## Visual Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to My Stories                                           │
│                                                                 │
│  📚 Spooky Skeleton Friend                                      │
│  Connor and Carter following skeleton for a treasure...        │
│  12 scenes • 10/21/2025                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────── Action Buttons ──────────────────────┐  │
│  │ [📖 Read] [🎵 Audio] [📄 PDF]                           │  │
│  │ [🌍 Public] [🎵 Spotify] [📱 Kids App] [🗑️ Delete]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────── Publishing Status ────────────────────┐  │
│  │ 🌍 Public on web • 25 views                             │  │
│  │ 🎵 Not published to Spotify                             │  │
│  │ 📱 Published to Kids App • 2 children • Read 3 times    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Story scenes displayed below...]                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Button Design Specifications

### Compact Button Style

**Size Adjustments:**
- Padding: `px-4 py-2` (reduced from `px-6 py-3`)
- Font size: `text-sm` (smaller text)
- Icon size: Emoji or SVG icon at normal size
- Border radius: `rounded-lg` (slightly less rounded)

**Button Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Core Actions:                                       │
│  [📖 Read] [🎵 Audio] [📄 PDF]                      │
│                                                      │
│  Publishing:                                         │
│  [🌍 Public ✓] [🎵 Spotify] [📱 Kids] [🗑️]        │
└──────────────────────────────────────────────────────┘
```

### Button States & Colors

#### Reading Mode Button
```tsx
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium shadow-md transition-all">
  <span>📖</span>
  <span>Read</span>
</button>
```

#### Generate/Has Audio Button
```tsx
// If audio exists
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all">
  <span>🎵</span>
  <span>Audio ✓</span>
</button>

// If audio doesn't exist
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium shadow-md transition-all">
  <span>🎵</span>
  <span>Generate</span>
</button>
```

#### PDF Button
```tsx
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 font-medium shadow-md transition-all">
  <span>📄</span>
  <span>PDF</span>
</button>
```

#### Publishing Buttons

**Make Public/Private Toggle**
```tsx
// If public
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all">
  <span>🌍</span>
  <span>Public ✓</span>
</button>

// If private
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium shadow-md transition-all">
  <span>🔒</span>
  <span>Private</span>
</button>
```

**Spotify Button**
```tsx
// Not published (gray)
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium shadow-md transition-all">
  <span>🎵</span>
  <span>Spotify</span>
</button>

// Published (green with checkmark)
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all">
  <span>🎵</span>
  <span>Spotify ✓</span>
</button>

// Publishing (blue with spinner)
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg font-medium shadow-md cursor-wait" disabled>
  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
  <span>Publishing...</span>
</button>
```

**Kids App Button**
```tsx
// Not published
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium shadow-md transition-all">
  <span>📱</span>
  <span>Kids</span>
</button>

// Published
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium shadow-md transition-all">
  <span>📱</span>
  <span>Kids ✓</span>
</button>
```

**Delete Button**
```tsx
<button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-md transition-all">
  <span>🗑️</span>
</button>
// Icon only, no text
```

---

## Publishing Status Section

**Location:** Below action buttons, above story scenes

**Design:**
```tsx
<div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 space-y-2">
  <h3 className="text-sm font-bold text-gray-700 mb-3">📊 Publishing Status</h3>

  {/* Web Status */}
  <div className="flex items-center gap-3">
    <span className="text-2xl">🌍</span>
    <div className="flex-1">
      {isPublic ? (
        <>
          <span className="font-semibold text-green-700">Public on web</span>
          <span className="text-gray-600 text-sm"> • {viewCount} views</span>
        </>
      ) : (
        <span className="font-semibold text-gray-600">Private</span>
      )}
    </div>
  </div>

  {/* Spotify Status */}
  <div className="flex items-center gap-3">
    <span className={`text-2xl ${spotifyStatus === 'published' ? 'text-green-500' : 'text-gray-400'}`}>
      🎵
    </span>
    <div className="flex-1">
      {spotifyStatus === 'published' ? (
        <>
          <span className="font-semibold text-green-700">Published to Spotify</span>
          <span className="text-gray-600 text-sm"> • {listenCount} listens</span>
          <a href={spotifyUrl} target="_blank" className="text-blue-600 text-sm ml-2 hover:underline">
            View on Spotify →
          </a>
        </>
      ) : spotifyStatus === 'publishing' ? (
        <>
          <span className="font-semibold text-blue-600">Publishing to Spotify...</span>
          <div className="mt-1 bg-gray-200 rounded-full h-2 w-48">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
          </div>
        </>
      ) : (
        <span className="font-semibold text-gray-600">Not published to Spotify</span>
      )}
    </div>
  </div>

  {/* Kids App Status */}
  <div className="flex items-center gap-3">
    <span className={`text-2xl ${kidsAppStatus === 'published' ? 'text-green-500' : 'text-gray-400'}`}>
      📱
    </span>
    <div className="flex-1">
      {kidsAppStatus === 'published' ? (
        <>
          <span className="font-semibold text-green-700">Published to Kids App</span>
          <span className="text-gray-600 text-sm">
            {' '} • {childCount} {childCount === 1 ? 'child' : 'children'}
            {' '} • Read {readCount} times
          </span>
        </>
      ) : (
        <span className="font-semibold text-gray-600">Not published to Kids App</span>
      )}
    </div>
  </div>
</div>
```

---

## Mobile Responsive Design

### Desktop (> 768px)
```
┌────────────────────────────────────────┐
│ [📖 Read] [🎵 Audio] [📄 PDF]         │
│ [🌍 Public] [🎵 Spotify] [📱 Kids] 🗑️│
└────────────────────────────────────────┘
```

### Tablet (640px - 768px)
```
┌───────────────────────────────┐
│ [📖 Read] [🎵 Audio] [📄 PDF]│
│ [🌍 Public] [🎵 Spotify]     │
│ [📱 Kids] [🗑️]               │
└───────────────────────────────┘
```

### Mobile (< 640px)
```
┌─────────────────┐
│ [📖 Read]       │
│ [🎵 Audio]      │
│ [📄 PDF]        │
│ [🌍 Public]     │
│ [🎵 Spotify]    │
│ [📱 Kids]       │
│ [🗑️ Delete]     │
└─────────────────┘
```

**Responsive Classes:**
```tsx
<div className="flex flex-wrap gap-2 sm:gap-3">
  {/* Buttons automatically wrap on smaller screens */}
</div>
```

---

## Updated Component Code

### Main Page Component

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PublishModal from '@/components/publishing/PublishModal';
import PublishingStatusCard from '@/components/publishing/PublishingStatusCard';

export default function StoryViewerPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasAudio, setHasAudio] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState<{
    platform: 'spotify' | 'kids-app' | null;
  }>({ platform: null });
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // ... existing useEffect and handlers ...

  const handleTogglePublic = async () => {
    setUpdatingVisibility(true);
    try {
      const newVisibility = project.visibility === 'public' ? 'private' : 'public';

      // Show confirmation if going public
      if (newVisibility === 'public') {
        if (!confirm('Make this story public?\n\nIt will be visible on the landing page.')) {
          setUpdatingVisibility(false);
          return;
        }
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (response.ok) {
        setProject({ ...project, visibility: newVisibility });
      } else {
        alert('Failed to update visibility');
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
      alert('Failed to update visibility');
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const handlePublishSpotify = () => {
    setPublishModalOpen({ platform: 'spotify' });
  };

  const handlePublishKidsApp = () => {
    setPublishModalOpen({ platform: 'kids-app' });
  };

  const handleDelete = async () => {
    if (!confirm('Delete this story? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/projects');
      } else {
        alert('Failed to delete story');
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      alert('Failed to delete story');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return null;
  }

  const isPublic = project.visibility === 'public';
  const spotifyStatus = project.spotify_status || 'not-published';
  const kidsAppStatus = project.kids_app_status || 'not-published';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Story Header */}
      <div className="mb-6">
        <Link href="/projects" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block text-sm">
          ← Back to My Stories
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{project.title}</h1>
        {project.description && (
          <p className="text-gray-600 text-base sm:text-lg">{project.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs sm:text-sm text-gray-500">
          <span>{project.scenes?.length || 0} scenes</span>
          <span>•</span>
          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Compact Action Buttons */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          {/* Row 1: Core Actions */}
          <button
            onClick={handleEnterReadingMode}
            disabled={loadingAudio}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium shadow-md transition-all disabled:opacity-50"
          >
            <span>📖</span>
            <span>Read</span>
          </button>

          {hasAudio ? (
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all"
            >
              <span>🎵</span>
              <span>Audio ✓</span>
            </button>
          ) : (
            <button
              onClick={handleGenerateAudio}
              disabled={generatingAudio}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium shadow-md transition-all disabled:opacity-50"
            >
              {generatingAudio ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>🎵</span>
                  <span>Generate</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 font-medium shadow-md transition-all disabled:opacity-50"
          >
            {generatingPDF ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                <span>PDF...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>PDF</span>
              </>
            )}
          </button>

          {/* Divider on larger screens */}
          <div className="hidden sm:block w-px bg-gray-300 mx-1"></div>

          {/* Row 2: Publishing Actions */}
          <button
            onClick={handleTogglePublic}
            disabled={updatingVisibility}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all ${
              isPublic
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            } disabled:opacity-50`}
          >
            <span>{isPublic ? '🌍' : '🔒'}</span>
            <span>{isPublic ? 'Public ✓' : 'Private'}</span>
          </button>

          <button
            onClick={handlePublishSpotify}
            disabled={!hasAudio}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all ${
              spotifyStatus === 'published'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-400 text-white hover:bg-gray-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={!hasAudio ? 'Generate audio first' : 'Publish to Spotify'}
          >
            <span>🎵</span>
            <span>Spotify{spotifyStatus === 'published' ? ' ✓' : ''}</span>
          </button>

          <button
            onClick={handlePublishKidsApp}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all ${
              kidsAppStatus === 'published'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                : 'bg-gray-400 text-white hover:bg-gray-500'
            }`}
          >
            <span>📱</span>
            <span className="hidden sm:inline">Kids{kidsAppStatus === 'published' ? ' ✓' : ''}</span>
          </button>

          {/* Spacer to push delete to the right on larger screens */}
          <div className="flex-1 hidden sm:block"></div>

          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-md transition-all"
          >
            <span>🗑️</span>
          </button>
        </div>
      </div>

      {/* Publishing Status Card */}
      <PublishingStatusCard
        visibility={project.visibility}
        viewCount={project.view_count || 0}
        spotifyStatus={spotifyStatus}
        spotifyUrl={project.spotify_url}
        listenCount={project.spotify_listens || 0}
        kidsAppStatus={kidsAppStatus}
        childCount={project.kids_app_children || 0}
        readCount={project.kids_app_reads || 0}
      />

      {/* Story Scenes (existing code) */}
      {/* ... */}

      {/* Publish Modal */}
      <PublishModal
        isOpen={publishModalOpen.platform !== null}
        platform={publishModalOpen.platform}
        storyIds={[projectId]}
        onClose={() => setPublishModalOpen({ platform: null })}
        onSuccess={() => {
          // Refresh project data
          fetchProject();
        }}
      />
    </div>
  );
}
```

### New `PublishingStatusCard.tsx` Component

```typescript
'use client';

interface PublishingStatusCardProps {
  visibility: 'public' | 'private';
  viewCount: number;
  spotifyStatus: 'not-published' | 'publishing' | 'published' | 'failed';
  spotifyUrl?: string;
  listenCount?: number;
  kidsAppStatus: 'not-published' | 'publishing' | 'published';
  childCount?: number;
  readCount?: number;
}

export default function PublishingStatusCard({
  visibility,
  viewCount,
  spotifyStatus,
  spotifyUrl,
  listenCount = 0,
  kidsAppStatus,
  childCount = 0,
  readCount = 0,
}: PublishingStatusCardProps) {
  const isPublic = visibility === 'public';

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6 mb-6 space-y-3">
      <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
        <span>📊</span>
        <span>Publishing Status</span>
      </h3>

      {/* Web Status */}
      <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
        <span className={`text-2xl ${isPublic ? 'text-green-500' : 'text-gray-400'}`}>
          {isPublic ? '🌍' : '🔒'}
        </span>
        <div className="flex-1">
          {isPublic ? (
            <div>
              <span className="font-semibold text-green-700 text-sm">Public on web</span>
              {viewCount > 0 && (
                <span className="text-gray-600 text-xs ml-2">• {viewCount} views</span>
              )}
            </div>
          ) : (
            <span className="font-semibold text-gray-600 text-sm">Private</span>
          )}
        </div>
      </div>

      {/* Spotify Status */}
      <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
        <span className={`text-2xl ${
          spotifyStatus === 'published' ? 'text-green-500' :
          spotifyStatus === 'publishing' ? 'text-blue-500 animate-pulse' :
          spotifyStatus === 'failed' ? 'text-red-500' :
          'text-gray-400'
        }`}>
          🎵
        </span>
        <div className="flex-1">
          {spotifyStatus === 'published' ? (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-green-700 text-sm">Published to Spotify</span>
                {listenCount > 0 && (
                  <span className="text-gray-600 text-xs">• {listenCount} listens</span>
                )}
              </div>
              {spotifyUrl && (
                <a
                  href={spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-xs hover:underline mt-1 inline-block"
                >
                  View on Spotify →
                </a>
              )}
            </div>
          ) : spotifyStatus === 'publishing' ? (
            <div>
              <span className="font-semibold text-blue-600 text-sm">Publishing to Spotify...</span>
              <div className="mt-2 bg-gray-200 rounded-full h-2 w-full max-w-xs">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
              </div>
            </div>
          ) : spotifyStatus === 'failed' ? (
            <div>
              <span className="font-semibold text-red-600 text-sm">Publishing failed</span>
              <p className="text-gray-600 text-xs mt-1">Try publishing again or contact support</p>
            </div>
          ) : (
            <span className="font-semibold text-gray-600 text-sm">Not published to Spotify</span>
          )}
        </div>
      </div>

      {/* Kids App Status */}
      <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
        <span className={`text-2xl ${
          kidsAppStatus === 'published' ? 'text-green-500' :
          kidsAppStatus === 'publishing' ? 'text-blue-500 animate-pulse' :
          'text-gray-400'
        }`}>
          📱
        </span>
        <div className="flex-1">
          {kidsAppStatus === 'published' ? (
            <div>
              <span className="font-semibold text-green-700 text-sm">Published to Kids App</span>
              <div className="text-gray-600 text-xs mt-1">
                {childCount > 0 && (
                  <span>{childCount} {childCount === 1 ? 'child' : 'children'}</span>
                )}
                {readCount > 0 && (
                  <span> • Read {readCount} {readCount === 1 ? 'time' : 'times'}</span>
                )}
              </div>
            </div>
          ) : kidsAppStatus === 'publishing' ? (
            <div>
              <span className="font-semibold text-blue-600 text-sm">Publishing to Kids App...</span>
              <div className="mt-2 bg-gray-200 rounded-full h-2 w-full max-w-xs">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '40%'}}></div>
              </div>
            </div>
          ) : (
            <span className="font-semibold text-gray-600 text-sm">Not published to Kids App</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Implementation Checklist

- [ ] Update button sizes (`px-4 py-2`, `text-sm`)
- [ ] Add publishing action buttons (Spotify, Kids App)
- [ ] Add visibility toggle button
- [ ] Create `PublishingStatusCard` component
- [ ] Add status indicators with icons
- [ ] Implement publishing modal handlers
- [ ] Add responsive breakpoints for mobile
- [ ] Test all button states (disabled, loading, success)
- [ ] Add tooltips for disabled buttons
- [ ] Update API to return publishing status

---

## Estimated Time
**2-3 days** for full implementation including:
- Component updates
- New status card component
- Modal integration
- Responsive design
- Testing all states
