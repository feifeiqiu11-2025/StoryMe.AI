/**
 * API Route: Podcast RSS Feed
 * GET /api/podcast/feed.xml
 *
 * Generates RSS 2.0 podcast feed for Spotify automatic ingestion
 * This feed is polled by Spotify every 1-6 hours
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'; // Always generate fresh feed

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch all Spotify publications (status: published or live)
    // Order by published_at DESC to show newest episodes first
    const { data: publications, error: publicationsError } = await supabase
      .from('publications')
      .select('*')
      .eq('platform', 'spotify')
      .in('status', ['published', 'live'])
      .order('published_at', { ascending: false })
      .limit(100); // Spotify recommends max 100 episodes in feed

    if (publicationsError) {
      console.error('Error fetching publications:', publicationsError);
      return new NextResponse('Error fetching episodes', { status: 500 });
    }

    if (!publications) {
      // No episodes yet - return empty but valid RSS feed
      const emptyFeed = generatePodcastRSS([]);
      return new NextResponse(emptyFeed, {
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
        },
      });
    }

    // Generate RSS XML
    const rssXml = generatePodcastRSS(publications);

    return new NextResponse(rssXml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
      },
    });

  } catch (error: any) {
    console.error('RSS feed generation error:', error);
    return new NextResponse(`Error generating RSS feed: ${error.message}`, { status: 500 });
  }
}

/**
 * Generate podcast RSS XML from publications
 */
function generatePodcastRSS(publications: any[]): string {
  // Podcast metadata
  const podcastTitle = 'KindleWood Stories';
  const podcastDescription = 'AI-powered audiobook stories created by kids, for kids. Every child is an author at KindleWood! Listen to magical tales narrated by AI and illustrated with stunning artwork - all imagined by young creators.';
  const podcastAuthor = 'KindleWood Studio';
  const podcastEmail = 'feifei_qiu@hotmail.com';
  const podcastLink = process.env.NEXT_PUBLIC_APP_URL || 'https://kindlewood.com';
  const podcastImageUrl = `${podcastLink}/podcast-cover-art.jpg`;
  const podcastLanguage = 'en-us';

  // Build episode items
  const episodeItems = publications.map(pub => {
    const pubDate = new Date(pub.published_at).toUTCString();
    const episodeLink = `${podcastLink}/stories/${pub.project_id}`;

    return `
    <item>
      <title>${escapeXml(pub.title)}</title>
      <description>${escapeXml(pub.description || '')}</description>
      <link>${episodeLink}</link>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${pub.compiled_audio_url}" length="${pub.file_size_bytes}" type="audio/mpeg"/>
      <guid isPermaLink="false">${pub.guid}</guid>
      <itunes:author>${escapeXml(pub.author)}</itunes:author>
      <itunes:subtitle>${escapeXml(pub.title)}</itunes:subtitle>
      <itunes:summary>${escapeXml(pub.description || '')}</itunes:summary>
      <itunes:duration>${pub.audio_duration_seconds}</itunes:duration>
      ${pub.cover_image_url ? `<itunes:image href="${pub.cover_image_url}"/>` : ''}
      <itunes:explicit>no</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
    </item>`;
  }).join('\n');

  // Build complete RSS feed
  const currentDate = new Date().toUTCString();

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(podcastTitle)}</title>
    <link>${podcastLink}</link>
    <description>${escapeXml(podcastDescription)}</description>
    <language>${podcastLanguage}</language>
    <copyright>© ${new Date().getFullYear()} ${escapeXml(podcastAuthor)}</copyright>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <pubDate>${currentDate}</pubDate>
    <atom:link href="${podcastLink}/api/podcast/feed.xml" rel="self" type="application/rss+xml"/>

    <!-- iTunes Podcast Tags -->
    <itunes:author>${escapeXml(podcastAuthor)}</itunes:author>
    <itunes:summary>${escapeXml(podcastDescription)}</itunes:summary>
    <itunes:owner>
      <itunes:name>${escapeXml(podcastAuthor)}</itunes:name>
      <itunes:email>${podcastEmail}</itunes:email>
    </itunes:owner>
    <itunes:image href="${podcastImageUrl}"/>
    <itunes:category text="Kids &amp; Family">
      <itunes:category text="Stories for Kids"/>
    </itunes:category>
    <itunes:explicit>no</itunes:explicit>
    <itunes:type>episodic</itunes:type>
${episodeItems}
  </channel>
</rss>`;

  return rss;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
