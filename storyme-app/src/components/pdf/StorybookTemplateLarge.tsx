/**
 * Large Storybook PDF Template - 7" x 8.5" Portrait (Legal Booklet)
 * Uses @react-pdf/renderer to create a large-format children's book
 *
 * Page Size: 7" x 8.5" (504pt x 612pt) - Portrait Format
 * Optimized for booklet-style printing on 8.5" x 14" (Legal) paper folded in half
 *
 * Layout:
 * - Cover: 85% image + 15% author/copyright footer
 * - Scenes: 65% image + 35% bilingual captions
 * - Fonts: 14-20px (optimized for bilingual text)
 * - Perfect for display or reading aloud to groups
 */

import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Register Chinese fonts for PDF rendering
Font.register({
  family: 'Noto Sans SC',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@4.5.11/files/noto-sans-sc-chinese-simplified-400-normal.woff',
      fontWeight: 400,
      format: 'woff' as any,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@4.5.11/files/noto-sans-sc-chinese-simplified-700-normal.woff',
      fontWeight: 700,
      format: 'woff' as any,
    },
  ],
});

// Define styles for large format PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 0,
  },
  // Cover page with AI image (85% image, 15% footer)
  coverImageContainer: {
    width: '100%',
    height: '85%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverFooter: {
    height: '15%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingTop: 20,
  },
  coverAuthor: {
    fontSize: 18,
    fontFamily: 'Noto Sans SC',
    color: '#1F2937',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  coverCopyright: {
    fontSize: 12,
    fontFamily: 'Noto Sans SC',
    color: '#6B7280',
  },
  // Fallback cover page (no AI image)
  coverPageFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    padding: 80,
  },
  coverTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans SC',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 1.5,
  },
  coverSubtitle: {
    fontSize: 24,
    fontFamily: 'Noto Sans SC',
    color: '#E0E7FF',
    textAlign: 'center',
    marginBottom: 60,
  },
  coverAuthorFallback: {
    fontSize: 28,
    fontFamily: 'Noto Sans SC',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 30,
    fontWeight: 'bold',
  },
  coverDecoration: {
    width: '60%',
    height: 4,
    backgroundColor: '#FFD700',
    marginVertical: 40,
  },
  // Scene pages (65% image, 35% captions - more space for bilingual text)
  scenePage: {
    flex: 1,
    flexDirection: 'column',
  },
  sceneImageContainer: {
    width: '100%',
    height: '65%',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sceneImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  sceneTextContainer: {
    position: 'relative',
    height: '35%',
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 35,
    paddingRight: 35,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  sceneTextWrapper: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Community page
  communityPage: {
    backgroundColor: '#F9FAFB',
    padding: 30,
    display: 'flex',
    flexDirection: 'column',
  },
  communityTitle: {
    fontSize: 24,
    fontFamily: 'Noto Sans SC',
    color: '#1F2937',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  communityGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  storyCard: {
    width: '31%',
    marginBottom: 15,
  },
  storyCardImage: {
    width: '100%',
    height: 120,
    objectFit: 'contain',
    marginBottom: 6,
  },
  storyCardTitle: {
    fontSize: 11,
    fontFamily: 'Noto Sans SC',
    color: '#1F2937',
    fontWeight: 'bold',
    marginBottom: 3,
    textAlign: 'center',
  },
  storyCardAuthor: {
    fontSize: 8,
    fontFamily: 'Noto Sans SC',
    color: '#6B7280',
    textAlign: 'center',
  },
  communityWebsite: {
    fontSize: 14,
    fontFamily: 'Noto Sans SC',
    color: '#7C3AED',
    textAlign: 'center',
    fontWeight: 'bold',
    marginTop: 10,
  },
});

interface StorybookTemplateLargeProps {
  title: string;
  description?: string;
  author?: string;
  coverImageUrl?: string;
  scenes: Array<{
    sceneNumber: number;
    caption?: string;
    caption_chinese?: string;
    description?: string;
    imageUrl: string;
  }>;
  createdDate?: string;
}

/**
 * Helper function to detect if text contains Chinese characters
 */
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * Helper function to wrap Chinese text
 */
function wrapChineseText(text: string, maxCharsPerLine: number = 25): string {
  if (!containsChinese(text)) {
    return text;
  }

  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < text.length; i++) {
    currentLine += text[i];
    if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = '';
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Smart font sizing for large format - optimized for 35% caption area
 */
function getSmartFontSizeLarge(text: string): { fontSize: number; lineHeight: number } {
  const length = text.length;

  if (length <= 80) {
    return { fontSize: 20, lineHeight: 1.4 };
  } else if (length <= 120) {
    return { fontSize: 18, lineHeight: 1.4 };
  } else if (length <= 160) {
    return { fontSize: 16, lineHeight: 1.3 };
  } else if (length <= 200) {
    return { fontSize: 15, lineHeight: 1.3 };
  } else {
    return { fontSize: 14, lineHeight: 1.3 };
  }
}

/**
 * Featured community stories for PDF showcase
 */
const FEATURED_COMMUNITY_STORIES = [
  {
    title: "Take care of our new cat friend",
    author: "By Connor, age 5",
    imageUrl: "https://v3b.fal.media/files/b/panda/76J905JG57Wn6xhz1u1Ec_b2b068c54a274ed09fc48ec2e17bc9be.jpg"
  },
  {
    title: "Connor's First Taekwondo Class",
    author: "By Connor",
    imageUrl: "https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762485155281.png"
  },
  {
    title: "Carter's Brave Soccer Day",
    author: "By Carter",
    imageUrl: "https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762997800987.png"
  },
  {
    title: "Teachers",
    author: "By KindleWood Studio",
    imageUrl: "https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1763149800245.png"
  },
  {
    title: "Learn about Hospital",
    author: "By KindleWood Studio",
    imageUrl: "https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762998310307.png"
  },
  {
    title: "Firefighters",
    author: "By Phoebe, age 6",
    imageUrl: "https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/ce3fd991-04fc-4842-bfe1-6eaeceb9e59f/covers/1763144123894.png"
  },
  {
    title: "Emma's Hawaiian Treasure Hunt",
    author: "By Emma, age 4",
    imageUrl: "https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/d7ca9615-06fc-449a-bd45-cb5006971619/covers/1763110054393.png"
  },
  {
    title: "劳动最快乐",
    author: "By Connor + KindleWood Studio",
    imageUrl: "https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762138402160.png"
  },
  {
    title: "Follow Connor to build his forever home",
    author: "By Connor & Carter",
    imageUrl: "https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762648994419.png"
  },
];

export const StorybookTemplateLarge: React.FC<StorybookTemplateLargeProps> = ({
  title,
  description,
  author = 'My Family',
  coverImageUrl,
  scenes,
  createdDate,
}) => {
  console.log('📖 Large Format PDF Template (7" x 8.5"):');
  console.log('  - coverImageUrl:', coverImageUrl);
  console.log('  - Will use:', coverImageUrl ? 'AI Cover (85% image)' : 'Fallback Cover');

  return (
    <Document>
      {/* Cover Page - 7" x 8.5" portrait (504pt x 612pt) */}
      {coverImageUrl ? (
        <Page size={{ width: 504, height: 612 }} style={styles.page}>
          {/* 85% Image Section */}
          <View style={styles.coverImageContainer}>
            <Image src={coverImageUrl} style={styles.coverImage} />
          </View>

          {/* 15% Footer Section */}
          <View style={styles.coverFooter}>
            <Text style={styles.coverAuthor}>By {author}</Text>
            <Text style={styles.coverCopyright}>© 2025 KindleWood Studio</Text>
          </View>
        </Page>
      ) : (
        <Page size={{ width: 504, height: 612 }} style={styles.page}>
          <View style={styles.coverPageFallback}>
            <View style={styles.coverDecoration} />
            <Text style={styles.coverTitle}>{title}</Text>
            {description && (
              <Text style={styles.coverSubtitle}>{description}</Text>
            )}
            <View style={styles.coverDecoration} />
            <Text style={styles.coverAuthorFallback}>By {author}</Text>
          </View>
        </Page>
      )}

      {/* Scene Pages - 70% image, 30% captions */}
      {scenes.map((scene, index) => {
        const caption = scene.caption || scene.description || '';
        const { fontSize, lineHeight } = getSmartFontSizeLarge(caption);

        return (
          <Page key={index} size={{ width: 504, height: 612 }} style={styles.page}>
            <View style={styles.scenePage}>
              {/* 70% Image Section */}
              <View style={styles.sceneImageContainer}>
                <Image src={scene.imageUrl} style={styles.sceneImage} />
              </View>

              {/* 30% Text Section */}
              <View style={styles.sceneTextContainer}>
                <View style={styles.sceneTextWrapper}>
                  {/* English Caption */}
                  <Text style={{
                    fontSize,
                    lineHeight,
                    fontFamily: 'Noto Sans SC',
                    color: '#1F2937',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}>
                    {wrapChineseText(caption)}
                  </Text>

                  {/* Chinese Caption - Bilingual Support */}
                  {scene.caption_chinese && (
                    <Text style={{
                      fontSize: fontSize - 2,
                      lineHeight: lineHeight,
                      fontFamily: 'Noto Sans SC',
                      color: '#6B7280',
                      textAlign: 'center',
                      marginTop: 12,
                    }}>
                      {wrapChineseText(scene.caption_chinese)}
                    </Text>
                  )}
                </View>

                {/* Page number */}
                <Text style={{
                  position: 'absolute',
                  bottom: 15,
                  right: 40,
                  fontSize: 12,
                  fontFamily: 'Noto Sans SC',
                  color: '#9CA3AF',
                }}>
                  {scene.sceneNumber}
                </Text>
              </View>
            </View>
          </Page>
        );
      })}

      {/* Community Stories Showcase Page */}
      <Page size={{ width: 504, height: 612 }} style={styles.communityPage}>
        <Text style={styles.communityTitle}>
          Discover More Stories from KindleWood Community
        </Text>

        <View style={styles.communityGrid}>
          {FEATURED_COMMUNITY_STORIES.map((story, index) => (
            <View key={index} style={styles.storyCard}>
              <Image src={story.imageUrl} style={styles.storyCardImage} />
              <Text style={styles.storyCardTitle}>{story.title}</Text>
              <Text style={styles.storyCardAuthor}>{story.author}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.communityWebsite}>
          https://www.kindlewoodstudio.ai/stories
        </Text>
      </Page>

      {/* Back Cover */}
      <Page size={{ width: 504, height: 612 }} style={styles.page}>
        <Image
          src="/images/pdf-back-cover.png"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </Page>
    </Document>
  );
};
