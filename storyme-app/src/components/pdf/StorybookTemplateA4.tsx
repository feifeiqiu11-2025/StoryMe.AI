/**
 * A4 Storybook PDF Template - 8.3" x 11.7" Portrait (Standard A4)
 * Uses @react-pdf/renderer to create an A4-format children's book
 *
 * Page Size: 8.3" x 11.7" (595pt x 842pt) - Standard A4 Portrait
 * Optimized for direct printing on A4 paper without scaling
 *
 * Layout:
 * - Cover: 80% image + 20% author/copyright footer
 * - Scenes: 75% image + 25% bilingual captions (~211pt caption area)
 * - Fonts: 14-20px (optimized for bilingual text)
 * - Book-style page numbers: odd=left, even=right
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

// Define styles for A4 format PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 0,
  },
  // Cover page with AI image (80% image, 20% footer)
  coverImageContainer: {
    width: '100%',
    height: '80%',
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
    height: '20%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingTop: 20,
  },
  coverAuthor: {
    fontSize: 20,
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
  // Scene pages (75% image, 25% captions)
  scenePage: {
    flex: 1,
    flexDirection: 'column',
  },
  sceneImageContainer: {
    width: '100%',
    height: '75%',
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
    height: '25%',
    paddingTop: 8,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 20,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  sceneTextWrapper: {
    flex: 1,
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
});

interface StorybookTemplateA4Props {
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
function wrapChineseText(text: string, maxCharsPerLine: number = 30): string {
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
 * Smart font sizing for A4 format
 */
function getSmartFontSizeA4(text: string): { fontSize: number; lineHeight: number } {
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

export const StorybookTemplateA4: React.FC<StorybookTemplateA4Props> = ({
  title,
  description,
  author = 'My Family',
  coverImageUrl,
  scenes,
  createdDate,
}) => {
  console.log('📖 A4 Format PDF Template (8.3" x 11.7"):');
  console.log('  - coverImageUrl:', coverImageUrl);
  console.log('  - Will use:', coverImageUrl ? 'AI Cover (80% image)' : 'Fallback Cover');

  return (
    <Document>
      {/* Cover Page - A4 portrait (595pt x 842pt) */}
      {coverImageUrl ? (
        <Page size="A4" style={styles.page}>
          {/* 80% Image Section */}
          <View style={styles.coverImageContainer}>
            <Image src={coverImageUrl} style={styles.coverImage} />
          </View>

          {/* 20% Footer Section */}
          <View style={styles.coverFooter}>
            <Text style={styles.coverAuthor}>By {author}</Text>
            <Text style={styles.coverCopyright}>© 2025 KindleWood Studio</Text>
          </View>
        </Page>
      ) : (
        <Page size="A4" style={styles.page}>
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

      {/* Scene Pages - 75% image, 25% captions */}
      {scenes.map((scene, index) => {
        const caption = scene.caption || scene.description || '';
        const { fontSize, lineHeight } = getSmartFontSizeA4(caption);

        return (
          <Page key={index} size="A4" style={styles.page}>
            <View style={styles.scenePage}>
              {/* 75% Image Section */}
              <View style={styles.sceneImageContainer}>
                <Image src={scene.imageUrl} style={styles.sceneImage} />
              </View>

              {/* 25% Text Section */}
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
                      marginTop: 4,
                    }}>
                      {wrapChineseText(scene.caption_chinese)}
                    </Text>
                  )}
                </View>

                {/* Page number - book style: odd=left, even=right */}
                <Text style={{
                  position: 'absolute',
                  bottom: 8,
                  ...(scene.sceneNumber % 2 === 1 ? { left: 25 } : { right: 25 }),
                  fontSize: 10,
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

      {/* Back Cover */}
      <Page size="A4" style={{ ...styles.page, backgroundColor: '#F9FAFB' }}>
        <Image
          src="/images/pdf-back-cover.png"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </Page>
    </Document>
  );
};
