/**
 * Main Storybook PDF Template
 * Uses @react-pdf/renderer to create a beautiful children's book layout
 *
 * Page Size: 8" x 10" (576pt x 720pt) - Portrait Format
 * This is the standard size for children's picture books with text:
 * - Layout: 70% image (full width, no borders) + 30% text caption
 * - Professional printing: Standard portrait book size
 * - Home printing: Can print on 8.5" x 11" paper with small margins
 * - Image focus: Full-bleed images maximize visual impact
 */

import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Register Chinese fonts for PDF rendering with proper format
// Using direct CDN links with proper CORS support
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

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 0,
  },
  coverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    padding: 60,
  },
  coverTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans SC',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
    letterSpacing: 1,
  },
  coverSubtitle: {
    fontSize: 20,
    fontFamily: 'Noto Sans SC',
    color: '#E0E7FF',
    textAlign: 'center',
    marginBottom: 60,
    maxWidth: '80%',
  },
  coverTagline: {
    fontSize: 16,
    fontFamily: 'Noto Sans SC',
    color: '#C7D2FE',
    textAlign: 'center',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  coverAuthor: {
    fontSize: 24,
    fontFamily: 'Noto Sans SC',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: 'bold',
  },
  coverDate: {
    fontSize: 12,
    fontFamily: 'Noto Sans SC',
    color: '#C7D2FE',
    textAlign: 'center',
    marginTop: 40,
  },
  coverDecorationTop: {
    width: '60%',
    height: 3,
    backgroundColor: '#FFD700',
    marginBottom: 40,
  },
  coverDecorationBottom: {
    width: '60%',
    height: 3,
    backgroundColor: '#FFD700',
    marginTop: 40,
  },
  scenePage: {
    flex: 1,
    flexDirection: 'column',
  },
  sceneImageContainer: {
    width: '100%',
    height: '68%',
    backgroundColor: '#F3F4F6',
  },
  sceneImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  sceneTextContainer: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 30,
    paddingLeft: 30,
    paddingRight: 30,
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  sceneText: {
    fontSize: 24,
    fontFamily: 'Noto Sans SC',
    lineHeight: 1.6,
    color: '#1F2937',
    textAlign: 'center',
    fontWeight: 'bold',
    flex: 1,
  },
  sceneNumber: {
    fontSize: 10,
    fontFamily: 'Noto Sans SC',
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 10,
  },
  backCoverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    padding: 60,
  },
  backCoverDecoration: {
    width: '70%',
    height: 4,
    backgroundColor: '#FFD700',
    marginBottom: 50,
  },
  backCoverText: {
    fontSize: 56,
    fontFamily: 'Noto Sans SC',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 50,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  backCoverMessage: {
    fontSize: 16,
    fontFamily: 'Noto Sans SC',
    color: '#E9D5FF',
    textAlign: 'center',
    marginBottom: 10,
  },
  backCoverAuthor: {
    fontSize: 28,
    fontFamily: 'Noto Sans SC',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 50,
    fontWeight: 'bold',
  },
  backCoverLogo: {
    fontSize: 14,
    fontFamily: 'Noto Sans SC',
    color: '#E9D5FF',
    textAlign: 'center',
    marginTop: 50,
  },
  backCoverDecorationBottom: {
    width: '70%',
    height: 4,
    backgroundColor: '#FFD700',
    marginTop: 50,
  },
});

interface StorybookTemplateProps {
  title: string;
  description?: string;
  author?: string;
  coverImageUrl?: string;
  scenes: Array<{
    sceneNumber: number;
    caption?: string;       // Age-appropriate caption (NEW)
    description?: string;   // Fallback for backward compatibility
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
 * Helper function to wrap Chinese text at 20 characters per line
 * Only applies to Chinese text, English text keeps natural wrapping
 */
function wrapChineseText(text: string): string {
  if (!containsChinese(text)) {
    // English text - return as is, natural wrapping will work
    return text;
  }

  // Chinese text - hard wrap at 20 characters per line
  const maxCharsPerLine = 20;
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < text.length; i++) {
    currentLine += text[i];

    if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = '';
    }
  }

  // Add remaining text
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

export const StorybookTemplate: React.FC<StorybookTemplateProps> = ({
  title,
  description,
  author = 'My Family',
  coverImageUrl,
  scenes,
  createdDate,
}) => {
  // Debug logging
  console.log('📖 PDF Template Received:');
  console.log('  - coverImageUrl:', coverImageUrl);
  console.log('  - Will use:', coverImageUrl ? 'AI Cover' : 'Fallback Cover');

  return (
    <Document>
      {/* Cover Page - AI Generated or Fallback */}
      {/* Using 8x10 inch portrait format - standard for children's picture books */}
      {coverImageUrl ? (
        <Page size={{ width: 576, height: 720 }} style={styles.page}>
          {/* AI-generated background image */}
          <View style={{ position: 'absolute', width: '100%', height: '100%' }}>
            <Image
              src={coverImageUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center'
              }}
            />
          </View>
          {/* Author & Copyright at bottom 10% of page */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            height: '10%',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              paddingVertical: 8,
              paddingHorizontal: 20,
              borderRadius: 8,
            }}>
              <Text style={{
                fontSize: 14,
                fontFamily: 'Noto Sans SC',
                color: '#4B5563',
                textAlign: 'center',
              }}>
                By {author}
              </Text>
              <Text style={{
                fontSize: 10,
                fontFamily: 'Noto Sans SC',
                color: '#6B7280',
                textAlign: 'center',
                marginTop: 4,
              }}>
                © 2025 KindleWood Studio
              </Text>
            </View>
          </View>
        </Page>
      ) : (
        <Page size={{ width: 576, height: 720 }} style={styles.page}>
          <View style={styles.coverPage}>
            <View style={styles.coverDecorationTop} />
            <Text style={styles.coverTitle}>{title}</Text>
            {description && (
              <Text style={styles.coverSubtitle}>{description}</Text>
            )}
            <Text style={styles.coverTagline}>A StoryMe Adventure</Text>
            <View style={styles.coverDecorationBottom} />
            <Text style={styles.coverAuthor}>By {author}</Text>
            {createdDate && (
              <Text style={styles.coverDate}>{createdDate}</Text>
            )}
          </View>
        </Page>
      )}

      {/* Scene Pages */}
      {scenes.map((scene, index) => (
        <Page key={index} size={{ width: 576, height: 720 }} style={styles.page}>
          <View style={styles.scenePage}>
            {/* Image Section */}
            <View style={styles.sceneImageContainer}>
              <Image
                src={scene.imageUrl}
                style={styles.sceneImage}
              />
            </View>

            {/* Text Section */}
            <View style={styles.sceneTextContainer}>
              <Text style={styles.sceneText}>
                {wrapChineseText(scene.caption || scene.description || '')}
              </Text>
              <Text style={styles.sceneNumber}>
                {scene.sceneNumber}
              </Text>
            </View>
          </View>
        </Page>
      ))}

      {/* Back Cover - Pre-rendered Marketing Page */}
      <Page size={{ width: 576, height: 720 }} style={styles.page}>
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
