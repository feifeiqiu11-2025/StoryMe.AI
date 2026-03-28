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

// Register Korean fonts for PDF rendering
Font.register({
  family: 'Noto Sans KR',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.1.1/files/noto-sans-kr-korean-400-normal.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.1.1/files/noto-sans-kr-korean-700-normal.woff2',
      fontWeight: 700,
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
  // Scene pages (75% image, 25% captions - optimized for less cropping)
  scenePage: {
    flex: 1,
    flexDirection: 'column',
  },
  sceneImageContainer: {
    width: '100%',
    height: '75%',  // Increased from 70% to further reduce image cropping
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
    paddingLeft: 15,
    paddingRight: 15,
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

interface CharacterForPDF {
  name: string;
  originalCreationUrl?: string;
  storyVersionUrl?: string;
}

interface StorybookTemplateLargeProps {
  title: string;
  description?: string;
  author?: string;
  coverImageUrl?: string;
  scenes: Array<{
    sceneNumber: number;
    caption?: string;
    caption_chinese?: string;
    caption_secondary?: string;
    description?: string;
    imageUrl: string;
  }>;
  characters?: CharacterForPDF[];
  createdDate?: string;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Helper function to detect if text contains CJK characters (Chinese or Korean)
 */
function containsCJK(text: string): boolean {
  return /[\u4e00-\u9fa5\uAC00-\uD7AF]/.test(text);
}

/**
 * Helper function to detect if text contains Korean characters
 */
function containsKorean(text: string): boolean {
  return /[\uAC00-\uD7AF]/.test(text);
}

/**
 * Helper function to wrap Chinese text
 */
function wrapChineseText(text: string, maxCharsPerLine: number = 25): string {
  if (!containsCJK(text)) {
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


export const StorybookTemplateLarge: React.FC<StorybookTemplateLargeProps> = ({
  title,
  description,
  author,
  coverImageUrl,
  scenes,
  characters,
  createdDate,
}) => {
  const displayCharacters = (characters || []).filter(
    c => c.originalCreationUrl || c.storyVersionUrl
  );
  const characterPages = chunkArray(displayCharacters, 2);

  console.log('📖 Large Format PDF Template (7" x 8.5"):');
  console.log('  - coverImageUrl:', coverImageUrl);
  console.log('  - Characters:', displayCharacters.length);
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
            {author && <Text style={styles.coverAuthor}>By {author}</Text>}
            <Text style={styles.coverCopyright}>© 2026 KindleWood Studio</Text>
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
            {author && <Text style={styles.coverAuthorFallback}>By {author}</Text>}
          </View>
        </Page>
      )}

      {/* Character Designer Pages */}
      {characterPages.map((pageChars, pageIndex) => (
        <Page key={`char-page-${pageIndex}`} size={{ width: 504, height: 612 }} style={styles.page}>
          <View style={{ flex: 1, padding: 25, paddingTop: 30 }}>
            {pageIndex === 0 && (
              <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  fontFamily: 'Noto Sans SC',
                  color: '#4F46E5',
                  textAlign: 'center',
                  marginBottom: 4,
                }}>
                  Meet the Character Designers
                </Text>
                <View style={{ width: 80, height: 2, backgroundColor: '#E5E7EB', marginTop: 6 }} />
              </View>
            )}

            {pageChars.map((char, charIndex) => {
              const hasBothImages = !!char.originalCreationUrl && !!char.storyVersionUrl;
              const singleImageUrl = char.originalCreationUrl || char.storyVersionUrl;

              return (
                <View key={charIndex} style={{
                  flex: 1,
                  marginBottom: charIndex === 0 && pageChars.length > 1 ? 10 : 0,
                  alignItems: 'center',
                }}>
                  {hasBothImages ? (
                    <View style={{ flexDirection: 'row', width: '100%', marginBottom: 6 }}>
                      <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Noto Sans SC', color: '#6B7280', textAlign: 'center' }}>
                        Original Creation
                      </Text>
                      <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Noto Sans SC', color: '#6B7280', textAlign: 'center' }}>
                        In the Story
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 9, fontFamily: 'Noto Sans SC', color: '#6B7280', textAlign: 'center', marginBottom: 6 }}>
                      {char.originalCreationUrl ? 'Original Creation' : 'In the Story'}
                    </Text>
                  )}

                  {hasBothImages ? (
                    <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
                      <View style={{ flex: 1, height: 190, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F9FAFB' }}>
                        <Image src={char.originalCreationUrl!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </View>
                      <View style={{ flex: 1, height: 190, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F9FAFB' }}>
                        <Image src={char.storyVersionUrl!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </View>
                    </View>
                  ) : (
                    <View style={{ width: '60%', height: 190, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F9FAFB' }}>
                      <Image src={singleImageUrl!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </View>
                  )}

                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Noto Sans SC',
                    color: '#1F2937',
                    textAlign: 'center',
                    marginTop: 8,
                    fontWeight: 'bold',
                  }}>
                    &ldquo;{char.name}&rdquo; — Designed by __________
                  </Text>
                </View>
              );
            })}
          </View>
        </Page>
      ))}

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

                  {/* Secondary Language Caption (Bilingual Support - Chinese/Korean) */}
                  {(scene.caption_secondary || scene.caption_chinese) && (() => {
                    const secondaryText = scene.caption_secondary || scene.caption_chinese || '';
                    const secondaryFontFamily = containsKorean(secondaryText) ? 'Noto Sans KR' : 'Noto Sans SC';
                    return (
                      <Text style={{
                        fontSize: fontSize - 2,
                        lineHeight: lineHeight,
                        fontFamily: secondaryFontFamily,
                        color: '#6B7280',
                        textAlign: 'center',
                        marginTop: 4,
                      }}>
                        {wrapChineseText(secondaryText)}
                      </Text>
                    );
                  })()}
                </View>

                {/* Page number - book style: odd=left, even=right */}
                <Text style={{
                  position: 'absolute',
                  bottom: 8,
                  ...(scene.sceneNumber % 2 === 1 ? { left: 15 } : { right: 15 }),
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

      {/* Back Cover */}
      <Page size={{ width: 504, height: 612 }} style={{ ...styles.page, backgroundColor: '#F9FAFB' }}>
        <Image
          src="/images/pdf-back-cover.png"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',  // Use contain to prevent cropping
          }}
        />
      </Page>
    </Document>
  );
};
