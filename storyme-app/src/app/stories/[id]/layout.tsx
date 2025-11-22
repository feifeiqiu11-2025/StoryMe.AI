/**
 * Story Page Layout with Dynamic OG Meta Tags
 * Generates Open Graph metadata for rich social media link previews
 */

import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

interface LayoutProps {
  children: React.ReactNode;
  params: { id: string };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const storyId = params.id;

  try {
    const supabase = await createClient();

    // Fetch story data for meta tags
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        cover_image_url,
        visibility,
        scenes (
          scene_number,
          generated_images (
            image_url
          )
        )
      `)
      .eq('id', storyId)
      .eq('visibility', 'public')
      .single();

    if (error || !project) {
      return {
        title: 'Story Not Found | KindleWood',
        description: 'This story may have been removed or made private.',
      };
    }

    // Get cover image - use project cover or first scene image
    const coverImage = project.cover_image_url ||
      project.scenes?.sort((a: any, b: any) => a.scene_number - b.scene_number)?.[0]?.generated_images?.[0]?.image_url ||
      'https://kindlewoodstudio.ai/og-default.png';

    const title = project.title || 'Untitled Story';
    const description = project.description || `Read "${title}" - a story created with KindleWood`;
    const url = `https://kindlewoodstudio.ai/stories/${storyId}`;

    return {
      title: `${title} | KindleWood`,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: 'KindleWood',
        images: [
          {
            url: coverImage,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        locale: 'en_US',
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [coverImage],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Story | KindleWood',
      description: 'Read stories created with KindleWood',
    };
  }
}

export default function StoryLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
