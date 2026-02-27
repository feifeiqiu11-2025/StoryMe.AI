/**
 * YouTube Playlist API Route
 * Fetches video metadata from a YouTube playlist via YouTube Data API v3.
 * Keeps API key server-side and caches results to minimize quota usage.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  position: number;
}

interface CacheEntry {
  videos: YouTubeVideo[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

// Allowed playlists to prevent arbitrary API usage
const ALLOWED_PLAYLISTS = new Set([
  'PLyDpAVbXE4SUAEuc2SnXwhsbUMg9j3dy9', // KindleWood Stories (landing page)
  'PLyDpAVbXE4SWPWFFiQUdo8FyMAhi90fA5', // Product Demos (landing page)
  'PLyDpAVbXE4SWLTi-PwRaH5pcbSHtVi7yu', // Behind the Scenes (founder journal)
  'PLyDpAVbXE4SWavZNKd0RNlhDuEJqpBkY0', // Testimonial Videos (landing page)
]);

async function fetchPlaylistFromYouTube(playlistId: string): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY not configured');
  }

  const videos: YouTubeVideo[] = [];
  let nextPageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId,
      maxResults: '50',
      key: apiKey,
    });
    if (nextPageToken) {
      params.set('pageToken', nextPageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `YouTube API error ${response.status}: ${error?.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    for (const item of data.items || []) {
      const snippet = item.snippet;
      // Skip private/deleted videos
      if (snippet.title === 'Private video' || snippet.title === 'Deleted video') {
        continue;
      }

      const thumbnails = snippet.thumbnails || {};
      const thumbnailUrl =
        thumbnails.maxres?.url ||
        thumbnails.standard?.url ||
        thumbnails.high?.url ||
        thumbnails.medium?.url ||
        thumbnails.default?.url ||
        '';

      videos.push({
        videoId: snippet.resourceId?.videoId || '',
        title: snippet.title || '',
        description: snippet.description || '',
        thumbnailUrl,
        position: snippet.position ?? videos.length,
      });
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return videos.sort((a, b) => a.position - b.position);
}

export async function GET(request: NextRequest) {
  const playlistId = request.nextUrl.searchParams.get('playlistId');

  if (!playlistId) {
    return NextResponse.json(
      { success: false, error: 'playlistId query parameter is required' },
      { status: 400 }
    );
  }

  if (!ALLOWED_PLAYLISTS.has(playlistId)) {
    return NextResponse.json(
      { success: false, error: 'Playlist not allowed' },
      { status: 403 }
    );
  }

  // Check cache
  const cached = cache.get(playlistId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, videos: cached.videos });
  }

  try {
    const videos = await fetchPlaylistFromYouTube(playlistId);

    // Update cache
    cache.set(playlistId, { videos, timestamp: Date.now() });

    return NextResponse.json({ success: true, videos });
  } catch (error) {
    console.error('YouTube playlist fetch error:', error);

    // If cache exists but is stale, return stale data rather than failing
    if (cached) {
      return NextResponse.json({ success: true, videos: cached.videos });
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch playlist',
      },
      { status: 500 }
    );
  }
}
