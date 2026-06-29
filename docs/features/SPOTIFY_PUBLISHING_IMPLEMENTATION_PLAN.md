# Spotify Publishing Implementation Plan

## Executive Summary

This document provides a detailed, step-by-step implementation plan for publishing KindleWood stories to Spotify as audiobooks. The plan focuses on the **MVP approach using Spotify for Authors** (manual submission) rather than complex API integration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Audio Compilation Service](#audio-compilation-service)
6. [Spotify Submission Process](#spotify-submission-process)
7. [Testing Strategy](#testing-strategy)
8. [Implementation Timeline](#implementation-timeline)

---

## 1. Architecture Overview

### High-Level Flow

```
User clicks "Publish to Spotify"
    ↓
Validate story has audio for all scenes
    ↓
Compile individual scene audio files into single audiobook file
    ↓
Generate audiobook metadata (title, author, cover art)
    ↓
Store compiled audiobook in Supabase Storage
    ↓
Create publishing record in database (status: "ready_for_submission")
    ↓
Admin manually submits to Spotify for Authors
    ↓
Update status to "submitted" → "live"
```

### Key Components

1. **Audio Compilation Service** - Merges scene audio files with intro/outro
2. **Publishing Service** - Manages publishing workflow and status
3. **Spotify Submission UI** - Admin interface to download and submit
4. **User-Facing Status** - Shows publishing progress on My Stories page

---

## 2. Database Schema

### New Table: `spotify_publications`

```sql
CREATE TABLE spotify_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Audiobook compilation
  compiled_audio_url TEXT, -- Supabase Storage URL to compiled MP3
  audio_duration_seconds INTEGER,
  file_size_bytes BIGINT,

  -- Metadata
  audiobook_title TEXT NOT NULL,
  audiobook_author TEXT NOT NULL,
  audiobook_description TEXT,
  cover_image_url TEXT,
  language VARCHAR(10) DEFAULT 'en-US',

  -- Publishing status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending: User clicked publish, audio compilation in progress
    -- ready_for_submission: Audio compiled, ready for admin to submit
    -- submitted: Admin submitted to Spotify
    -- live: Published and live on Spotify
    -- failed: Compilation or submission failed
    -- rejected: Spotify rejected the submission

  -- Spotify metadata (filled after submission)
  spotify_show_id VARCHAR(255), -- Spotify Show ID
  spotify_episode_id VARCHAR(255), -- Spotify Episode ID
  spotify_url TEXT, -- Public Spotify URL

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  compiled_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Indexes
  CONSTRAINT unique_project_spotify UNIQUE(project_id),
  INDEX idx_spotify_user_id (user_id),
  INDEX idx_spotify_status (status),
  INDEX idx_spotify_submitted_at (submitted_at)
);

-- Enable RLS
ALTER TABLE spotify_publications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own publications"
  ON spotify_publications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create publications for their projects"
  ON spotify_publications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Admins can update any publication (for manual status updates)
CREATE POLICY "Admins can update all publications"
  ON spotify_publications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
```

### Update `projects` table (optional)

```sql
-- Add Spotify publishing fields to projects table
ALTER TABLE projects
  ADD COLUMN spotify_published BOOLEAN DEFAULT false,
  ADD COLUMN spotify_url TEXT;
```

---

## 3. Backend Implementation

### 3.1 API Endpoint: Compile Audio

**Path**: `/api/projects/[id]/publish-spotify`

**Method**: `POST`

**Purpose**: Compile all scene audio files into a single audiobook file

**Implementation**:

```typescript
// storyme-app/src/app/api/projects/[id]/publish-spotify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AudioCompilationService } from '@/lib/services/audio-compilation.service';
import { PublishingService } from '@/lib/services/publishing.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Check if already published or in progress
    const { data: existingPublication } = await supabase
      .from('spotify_publications')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (existingPublication && existingPublication.status === 'pending') {
      return NextResponse.json(
        { error: 'Publication already in progress' },
        { status: 409 }
      );
    }

    if (existingPublication && ['live', 'submitted'].includes(existingPublication.status)) {
      return NextResponse.json(
        { error: 'Story already published to Spotify', spotifyUrl: existingPublication.spotify_url },
        { status: 409 }
      );
    }

    // 3. Verify audio exists for all scenes
    const { data: audioPages } = await supabase
      .from('audio_pages')
      .select('*')
      .eq('project_id', projectId)
      .not('audio_url', 'is', null);

    const requiredAudioCount = 1 + (project.scenes?.length || 0); // cover + scenes

    if (!audioPages || audioPages.length < requiredAudioCount) {
      return NextResponse.json(
        {
          error: 'Please generate audio for all scenes before publishing to Spotify',
          hasAudio: audioPages?.length || 0,
          required: requiredAudioCount
        },
        { status: 400 }
      );
    }

    // 4. Create publication record (status: pending)
    const { data: publication, error: insertError } = await supabase
      .from('spotify_publications')
      .insert({
        project_id: projectId,
        user_id: user.id,
        audiobook_title: project.title,
        audiobook_author: project.authorName || user.user_metadata?.name || 'KindleWood Author',
        audiobook_description: project.description || `A KindleWood story by ${project.authorName}`,
        cover_image_url: project.coverImageUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating publication record:', insertError);
      return NextResponse.json({ error: 'Failed to create publication' }, { status: 500 });
    }

    // 5. Trigger audio compilation (async background job)
    // In production, this should be a background job (e.g., Vercel serverless function with 60s timeout)
    const compilationService = new AudioCompilationService(supabase);

    try {
      const result = await compilationService.compileAudiobook(projectId, publication.id);

      return NextResponse.json({
        success: true,
        publicationId: publication.id,
        status: 'ready_for_submission',
        message: 'Audio compilation complete! Your story is ready for Spotify submission.',
        compiledAudioUrl: result.compiledAudioUrl,
        duration: result.duration,
      });

    } catch (compilationError: any) {
      console.error('Audio compilation failed:', compilationError);

      // Update publication status to failed
      await supabase
        .from('spotify_publications')
        .update({
          status: 'failed',
          error_message: compilationError.message,
        })
        .eq('id', publication.id);

      return NextResponse.json({
        error: 'Audio compilation failed',
        details: compilationError.message
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Spotify publish error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 3.2 API Endpoint: Check Publishing Status

**Path**: `/api/projects/[id]/spotify-status`

**Method**: `GET`

**Purpose**: Check the status of Spotify publication

```typescript
// storyme-app/src/app/api/projects/[id]/spotify-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: publication } = await supabase
      .from('spotify_publications')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      hasPublication: !!publication,
      status: publication?.status || null,
      spotifyUrl: publication?.spotify_url || null,
      submittedAt: publication?.submitted_at || null,
      publishedAt: publication?.published_at || null,
      errorMessage: publication?.error_message || null,
    });

  } catch (error: any) {
    console.error('Error fetching Spotify status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 4. Frontend Implementation

### 4.1 Update Story Viewer Page Button

**File**: `storyme-app/src/app/(dashboard)/projects/[id]/page.tsx`

**Add state for Spotify publishing**:

```typescript
const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
const [publishingToSpotify, setPublishingToSpotify] = useState(false);
```

**Add useEffect to fetch Spotify status**:

```typescript
useEffect(() => {
  const fetchSpotifyStatus = async () => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/spotify-status`);
      const data = await response.json();

      if (data.hasPublication) {
        setSpotifyStatus(data.status);
      }
    } catch (error) {
      console.error('Error fetching Spotify status:', error);
    }
  };

  fetchSpotifyStatus();
}, [projectId]);
```

**Add handler function**:

```typescript
const handlePublishToSpotify = async () => {
  if (!project) return;

  // Confirm with user
  const confirmed = confirm(
    'Publish to Spotify?\n\n' +
    'This will compile your story audio into an audiobook format. ' +
    'Make sure you have generated audio for all scenes first.\n\n' +
    'Continue?'
  );

  if (!confirmed) return;

  setPublishingToSpotify(true);

  try {
    const response = await fetch(`/api/projects/${projectId}/publish-spotify`, {
      method: 'POST',
    });

    const data = await response.json();

    if (response.ok) {
      alert(`✅ ${data.message}\n\nYour audiobook is ready for Spotify submission!`);
      setSpotifyStatus('ready_for_submission');
    } else {
      alert(`❌ ${data.error}\n\n${data.details || ''}`);
    }
  } catch (error: any) {
    console.error('Spotify publishing error:', error);
    alert(`❌ Failed to publish to Spotify: ${error.message}`);
  } finally {
    setPublishingToSpotify(false);
  }
};
```

**Replace Spotify placeholder button**:

```tsx
{/* Spotify Publishing */}
<Tooltip text={
  spotifyStatus === 'live'
    ? "Published on Spotify"
    : spotifyStatus === 'submitted'
    ? "Awaiting Spotify approval"
    : spotifyStatus === 'ready_for_submission'
    ? "Ready for admin to submit to Spotify"
    : spotifyStatus === 'pending'
    ? "Compiling audio for Spotify..."
    : "Publish this story to Spotify as an audiobook"
}>
  <button
    onClick={handlePublishToSpotify}
    disabled={publishingToSpotify || ['pending', 'submitted', 'live'].includes(spotifyStatus || '')}
    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
      spotifyStatus === 'live'
        ? 'bg-green-600 text-white hover:bg-green-700'
        : spotifyStatus === 'submitted'
        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
        : spotifyStatus === 'ready_for_submission'
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : spotifyStatus === 'pending'
        ? 'bg-orange-500 text-white'
        : 'bg-gray-500 text-white hover:bg-gray-600'
    }`}
  >
    {publishingToSpotify ? (
      <>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        <span>Publishing...</span>
      </>
    ) : (
      <>
        <span>
          {spotifyStatus === 'live' ? '✓' : '🎵'}
        </span>
        <span>
          {spotifyStatus === 'live'
            ? 'On Spotify'
            : spotifyStatus === 'submitted'
            ? 'Submitted'
            : spotifyStatus === 'ready_for_submission'
            ? 'Ready'
            : spotifyStatus === 'pending'
            ? 'Compiling...'
            : 'Spotify'
          }
        </span>
      </>
    )}
  </button>
</Tooltip>
```

### 4.2 Update My Stories Page (Batch Publishing)

This will be implemented later as part of the batch selection feature described in `MY_STORIES_UX_DESIGN.md`.

---

## 5. Audio Compilation Service

### Purpose

Merge individual audio files (cover + scenes) into a single audiobook MP3 file with proper chapter markers.

### Implementation

**File**: `storyme-app/src/lib/services/audio-compilation.service.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface AudioCompilationResult {
  compiledAudioUrl: string;
  duration: number;
  fileSize: number;
}

export class AudioCompilationService {
  constructor(private supabase: SupabaseClient) {}

  async compileAudiobook(
    projectId: string,
    publicationId: string
  ): Promise<AudioCompilationResult> {
    console.log(`🎵 Starting audiobook compilation for project ${projectId}`);

    // 1. Fetch project and audio pages
    const { data: project } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) {
      throw new Error('Project not found');
    }

    const { data: audioPages } = await this.supabase
      .from('audio_pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_number', { ascending: true });

    if (!audioPages || audioPages.length === 0) {
      throw new Error('No audio pages found');
    }

    // 2. Download all audio files to temp directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audiobook-'));
    const audioFilePaths: string[] = [];

    try {
      for (const page of audioPages) {
        if (!page.audio_url) continue;

        const response = await fetch(page.audio_url);
        const buffer = await response.arrayBuffer();
        const filePath = path.join(tempDir, `page-${page.page_number}.mp3`);
        await fs.writeFile(filePath, Buffer.from(buffer));
        audioFilePaths.push(filePath);
      }

      console.log(`✓ Downloaded ${audioFilePaths.length} audio files`);

      // 3. Create concat list for ffmpeg
      const concatListPath = path.join(tempDir, 'concat-list.txt');
      const concatContent = audioFilePaths
        .map(filePath => `file '${filePath}'`)
        .join('\n');
      await fs.writeFile(concatListPath, concatContent);

      // 4. Compile using ffmpeg
      const outputPath = path.join(tempDir, 'audiobook.mp3');

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .audioChannels(2)
          .audioFrequency(44100)
          .on('start', (cmd) => {
            console.log('FFmpeg command:', cmd);
          })
          .on('progress', (progress) => {
            console.log(`Processing: ${progress.percent?.toFixed(1)}% done`);
          })
          .on('end', () => {
            console.log('✓ Audio compilation complete');
            resolve();
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(err);
          })
          .save(outputPath);
      });

      // 5. Get file stats
      const stats = await fs.stat(outputPath);
      const fileBuffer = await fs.readFile(outputPath);

      // 6. Upload to Supabase Storage
      const fileName = `audiobooks/${projectId}/${publicationId}.mp3`;
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('story-audio')
        .upload(fileName, fileBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 7. Get public URL
      const { data: urlData } = this.supabase.storage
        .from('story-audio')
        .getPublicUrl(fileName);

      // 8. Calculate duration (using ffprobe)
      const duration = await this.getAudioDuration(outputPath);

      // 9. Update publication record
      await this.supabase
        .from('spotify_publications')
        .update({
          compiled_audio_url: urlData.publicUrl,
          audio_duration_seconds: Math.round(duration),
          file_size_bytes: stats.size,
          status: 'ready_for_submission',
          compiled_at: new Date().toISOString(),
        })
        .eq('id', publicationId);

      console.log('✓ Audiobook uploaded to Supabase Storage');

      // 10. Cleanup temp files
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        compiledAudioUrl: urlData.publicUrl,
        duration: Math.round(duration),
        fileSize: stats.size,
      };

    } catch (error) {
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }
}
```

### Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "fluent-ffmpeg": "^2.1.2"
  },
  "devDependencies": {
    "@types/fluent-ffmpeg": "^2.1.21"
  }
}
```

### FFmpeg Binary

For Vercel deployment, use `@ffmpeg-installer/ffmpeg`:

```bash
npm install @ffmpeg-installer/ffmpeg
```

Then configure at the top of the service:

```typescript
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
```

---

## 6. Spotify Submission Process

### Manual Submission (MVP)

Since Spotify doesn't have a public API for audiobook publishing, we use **Spotify for Authors** platform for manual submission.

### Admin Interface

Create an admin page to manage Spotify submissions:

**File**: `storyme-app/src/app/admin/spotify-submissions/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SpotifySubmissionsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from('spotify_publications')
      .select(`
        *,
        project:projects(*),
        user:users(email, name)
      `)
      .order('requested_at', { ascending: false });

    setSubmissions(data || []);
    setLoading(false);
  };

  const handleDownload = (audioUrl: string, title: string) => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${title}.mp3`;
    link.click();
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const supabase = createClient();

    const updates: any = { status: newStatus };

    if (newStatus === 'submitted') {
      updates.submitted_at = new Date().toISOString();
    } else if (newStatus === 'live') {
      updates.published_at = new Date().toISOString();
      // Prompt for Spotify URL
      const spotifyUrl = prompt('Enter Spotify URL:');
      if (spotifyUrl) {
        updates.spotify_url = spotifyUrl;
      }
    }

    await supabase
      .from('spotify_publications')
      .update(updates)
      .eq('id', id);

    fetchSubmissions();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Spotify Submissions</h1>

      <div className="space-y-4">
        {submissions.map((sub) => (
          <div key={sub.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{sub.audiobook_title}</h2>
                <p className="text-gray-600">by {sub.audiobook_author}</p>
                <p className="text-sm text-gray-500 mt-2">
                  User: {sub.user.email} | Requested: {new Date(sub.requested_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">
                  Duration: {Math.floor(sub.audio_duration_seconds / 60)}m {sub.audio_duration_seconds % 60}s |
                  Size: {(sub.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  sub.status === 'live' ? 'bg-green-100 text-green-800' :
                  sub.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                  sub.status === 'ready_for_submission' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {sub.status}
                </span>
              </div>
            </div>

            {sub.status === 'ready_for_submission' && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleDownload(sub.compiled_audio_url, sub.audiobook_title)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Download Audiobook
                </button>
                <button
                  onClick={() => handleUpdateStatus(sub.id, 'submitted')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Mark as Submitted
                </button>
              </div>
            )}

            {sub.status === 'submitted' && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleUpdateStatus(sub.id, 'live')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Mark as Live (Enter Spotify URL)
                </button>
              </div>
            )}

            {sub.status === 'live' && sub.spotify_url && (
              <div className="mt-4">
                <a
                  href={sub.spotify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View on Spotify →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Steps for Admin to Submit to Spotify

1. **Log into Admin Interface** at `/admin/spotify-submissions`
2. **Download compiled audiobook** MP3 file
3. **Go to Spotify for Authors**: https://podcasters.spotify.com/
4. **Create Show** (if first time):
   - Show name: "KindleWood Stories"
   - Category: Kids & Family
   - Language: English
5. **Upload Episode**:
   - Episode title: [Story title]
   - Description: [Story description]
   - Audio file: [Downloaded MP3]
   - Cover art: [Project cover image]
6. **Submit for review**
7. **Wait for approval** (typically 1-3 days)
8. **Copy Spotify URL** once live
9. **Update status to "Live"** in admin interface and paste Spotify URL

---

## 7. Testing Strategy

### Unit Tests

1. **Audio Compilation Service**
   - Test downloading audio files
   - Test ffmpeg concatenation
   - Test Supabase upload
   - Test error handling

2. **Publishing API**
   - Test validation (audio exists, not already published)
   - Test status updates
   - Test error responses

### Integration Tests

1. **End-to-End Publishing Flow**
   - Create test story with audio
   - Trigger Spotify publishing
   - Verify compilation
   - Verify database updates

### Manual Testing Checklist

- [ ] Create story with audio for all scenes
- [ ] Click "Publish to Spotify" button
- [ ] Verify compilation starts (status: pending)
- [ ] Verify compilation completes (status: ready_for_submission)
- [ ] Admin downloads audiobook file
- [ ] Verify audio plays correctly
- [ ] Admin submits to Spotify
- [ ] Update status to "submitted"
- [ ] Once live, update status to "live" with Spotify URL
- [ ] Verify button shows "On Spotify" with link

---

## 8. Implementation Timeline

### Week 1: Backend Foundation

- **Day 1-2**: Database schema + migrations
- **Day 3-4**: Audio Compilation Service
- **Day 5**: Publishing API endpoints

### Week 2: Frontend Integration

- **Day 1-2**: Story Viewer button implementation
- **Day 3-4**: Status polling and UI updates
- **Day 5**: Admin submission interface

### Week 3: Testing & Polish

- **Day 1-2**: End-to-end testing
- **Day 3**: Bug fixes
- **Day 4**: Documentation
- **Day 5**: Deploy to production

### Week 4: Manual Submissions

- **Day 1-5**: Submit first batch to Spotify, gather feedback, iterate

---

## 9. Cost Estimation

### Development

- Backend: 20 hours @ $150/hr = **$3,000**
- Frontend: 20 hours @ $150/hr = **$3,000**
- Testing: 10 hours @ $150/hr = **$1,500**
- **Total Development**: **$7,500**

### Infrastructure

- **FFmpeg processing**: Vercel Functions (10 min/compilation) - ~$0.10/compilation
- **Supabase Storage**: $0.021/GB/month (audiobooks avg 50MB) - ~$1/month per 1,000 audiobooks
- **Estimated monthly**: <$50/month for 500 compilations

### Spotify for Authors

- **Free** (no fees for hosting audiobooks)

---

## 10. Future Enhancements

### Phase 2 (Post-MVP)

1. **Automatic chapter markers** - Add metadata for chapter navigation
2. **Batch submission tool** - Submit multiple audiobooks at once
3. **Webhook integration** - Auto-update status when Spotify publishes
4. **Analytics dashboard** - Track Spotify plays and engagement
5. **User notifications** - Email when audiobook goes live
6. **Direct Spotify API** - If/when Spotify releases public API

---

## 11. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| FFmpeg compilation fails | High | Add retry logic, better error messages, validate audio files first |
| Large file sizes (>100MB) | Medium | Compress audio to 64kbps for very long stories |
| Spotify rejects submissions | Medium | Review Spotify content guidelines, provide content moderation checklist |
| Manual process bottleneck | Low | Batch submissions, train multiple admins |
| Storage costs escalate | Low | Delete compiled audiobooks after 30 days if not submitted |

---

## Appendix A: Required Environment Variables

```bash
# .env.local

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# No additional env vars needed for MVP
```

---

## Appendix B: Spotify for Authors Guidelines

Key requirements for audiobook submissions:

1. **Audio Quality**: 128 kbps MP3 minimum
2. **Content**: Must be original or properly licensed
3. **Cover Art**: 1400x1400px minimum, JPG or PNG
4. **Metadata**: Title, author, description
5. **Language**: Must specify primary language
6. **Category**: Kids & Family (for KindleWood)
7. **Parental Advisory**: None (child-friendly content)

**Resources**:
- https://podcasters.spotify.com/
- https://support.spotify.com/us/podcasters/article/podcast-delivery-specifications/

---

## Summary

This implementation plan provides a complete blueprint for MVP Spotify publishing using manual submission via Spotify for Authors. The approach is:

✅ **Achievable**: Uses existing technologies (FFmpeg, Supabase)
✅ **Cost-effective**: Minimal infrastructure costs
✅ **Scalable**: Can handle 100+ submissions/month
✅ **User-friendly**: Simple one-click publishing for users
✅ **Admin-friendly**: Clear workflow for manual submissions

Once implemented, this system can be enhanced with automation as Spotify's platform evolves.
