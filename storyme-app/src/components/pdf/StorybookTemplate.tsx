/**
 * Main Storybook PDF Template
 * Uses @react-pdf/renderer to create a beautiful children's book layout
 *
 * Page Size: A5 (420pt x 595pt) - Portrait Format
 * This is optimized for booklet-style printing on Letter/A4 paper:
 * - Layout: 65% image + 35% text caption with smart font sizing
 * - Booklet printing: Perfect for folding Letter/A4 paper in half
 * - Home printing: Maximizes paper usage, no wasted space
 * - Image: Uses 'contain' to prevent cropping/squishing
 * - Smart font sizing: Automatically adjusts for long captions
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
    height: '70%',  // Increased from 65% to reduce image cropping
    backgroundColor: '#F3F4F6',
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
    height: '30%',  // Reduced from 35% to give more room to image
    paddingTop: 15,
    paddingBottom: 20,
    paddingLeft: 25,
    paddingRight: 25,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    overflow: 'hidden',  // Prevent content from overflowing
  },
  sceneTextWrapper: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sceneNumber: {
    fontSize: 9,
    fontFamily: 'Noto Sans SC',
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
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

interface CharacterForPDF {
  name: string;
  originalCreationUrl?: string;
  storyVersionUrl?: string;
}

interface StorybookTemplateProps {
  title: string;
  description?: string;
  author?: string;
  coverImageUrl?: string;
  scenes: Array<{
    sceneNumber: number;
    caption?: string;          // Age-appropriate caption (English)
    caption_chinese?: string;  // Chinese translation (backward compat)
    caption_secondary?: string; // Generic secondary language caption (Korean, Chinese, etc.)
    description?: string;      // Fallback for backward compatibility
    imageUrl: string;
  }>;
  characters?: CharacterForPDF[];
  createdDate?: string;
}

/**
 * Chunk an array into groups of a specified size
 */
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
 * Helper function to wrap Chinese text at characters per line
 * Only applies to Chinese text, English text keeps natural wrapping
 */
function wrapChineseText(text: string, maxCharsPerLine: number = 18): string {
  if (!containsCJK(text)) {
    // English text - return as is, natural wrapping will work
    return text;
  }

  // Chinese text - hard wrap at specified characters per line
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

/**
 * Smart font sizing based on caption length
 * Returns font size and line height for optimal readability
 */
function getSmartFontSize(text: string): { fontSize: number; lineHeight: number } {
  const length = text.length;

  if (length <= 80) {
    return { fontSize: 20, lineHeight: 1.5 };
  } else if (length <= 120) {
    return { fontSize: 18, lineHeight: 1.4 };
  } else if (length <= 160) {
    return { fontSize: 16, lineHeight: 1.4 };
  } else {
    return { fontSize: 14, lineHeight: 1.3 };
  }
}


export const StorybookTemplate: React.FC<StorybookTemplateProps> = ({
  title,
  description,
  author,
  coverImageUrl,
  scenes,
  characters,
  createdDate,
}) => {
  // Filter characters that have at least one image
  const displayCharacters = (characters || []).filter(
    c => c.originalCreationUrl || c.storyVersionUrl
  );
  const characterPages = chunkArray(displayCharacters, 2);

  // Debug logging
  console.log('📖 PDF Template Received:');
  console.log('  - coverImageUrl:', coverImageUrl);
  console.log('  - Will use:', coverImageUrl ? 'AI Cover' : 'Fallback Cover');
  console.log('  - Characters:', displayCharacters.length);
  console.log('  - Scenes data:', scenes.map(s => ({
    sceneNumber: s.sceneNumber,
    hasCaption: !!s.caption,
    hasCaptionChinese: !!s.caption_chinese,
    hasCaptionSecondary: !!s.caption_secondary,
    caption_secondary: s.caption_secondary || s.caption_chinese
  })));

  return (
    <Document>
      {/* Cover Page - AI Generated or Fallback */}
      {/* Using A5 format (420pt x 595pt) - optimized for booklet printing */}
      {coverImageUrl ? (
        <Page size={{ width: 420, height: 595 }} style={styles.page}>
          {/* 80% Image Section */}
          <View style={{
            width: '100%',
            height: '80%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}>
            <Image
              src={coverImageUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </View>

          {/* 20% Footer Section */}
          <View style={{
            height: '20%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            paddingTop: 15,
          }}>
            {author && (
              <Text style={{
                fontSize: 14,
                fontFamily: 'Noto Sans SC',
                color: '#1F2937',
                fontWeight: 'bold',
                marginBottom: 6,
              }}>
                By {author}
              </Text>
            )}
            <Text style={{
              fontSize: 10,
              fontFamily: 'Noto Sans SC',
              color: '#6B7280',
            }}>
              © 2026 KindleWood Studio
            </Text>
          </View>
        </Page>
      ) : (
        <Page size={{ width: 420, height: 595 }} style={styles.page}>
          <View style={styles.coverPage}>
            <View style={styles.coverDecorationTop} />
            <Text style={styles.coverTitle}>{title}</Text>
            {description && (
              <Text style={styles.coverSubtitle}>{description}</Text>
            )}
            <Text style={styles.coverTagline}>A StoryMe Adventure</Text>
            <View style={styles.coverDecorationBottom} />
            {author && <Text style={styles.coverAuthor}>By {author}</Text>}
            {createdDate && (
              <Text style={styles.coverDate}>{createdDate}</Text>
            )}
          </View>
        </Page>
      )}

      {/* Character Designer Pages - after cover, before scenes */}
      {characterPages.map((pageChars, pageIndex) => (
        <Page key={`char-page-${pageIndex}`} size={{ width: 420, height: 595 }} style={styles.page}>
          <View style={{ flex: 1, padding: 25, paddingTop: 30 }}>
            {/* Page Title - only on first designer page */}
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

            {/* Character blocks - 2 per page */}
            {pageChars.map((char, charIndex) => {
              const hasBothImages = !!char.originalCreationUrl && !!char.storyVersionUrl;
              const singleImageUrl = char.originalCreationUrl || char.storyVersionUrl;

              return (
                <View key={charIndex} style={{
                  flex: 1,
                  marginBottom: charIndex === 0 && pageChars.length > 1 ? 10 : 0,
                  alignItems: 'center',
                }}>
                  {/* Column headers */}
                  {hasBothImages ? (
                    <View style={{ flexDirection: 'row', width: '100%', marginBottom: 6 }}>
                      <Text style={{
                        flex: 1,
                        fontSize: 8,
                        fontFamily: 'Noto Sans SC',
                        color: '#6B7280',
                        textAlign: 'center',
                      }}>
                        Original Creation
                      </Text>
                      <Text style={{
                        flex: 1,
                        fontSize: 8,
                        fontFamily: 'Noto Sans SC',
                        color: '#6B7280',
                        textAlign: 'center',
                      }}>
                        In the Story
                      </Text>
                    </View>
                  ) : (
                    <Text style={{
                      fontSize: 8,
                      fontFamily: 'Noto Sans SC',
                      color: '#6B7280',
                      textAlign: 'center',
                      marginBottom: 6,
                    }}>
                      {char.originalCreationUrl ? 'Original Creation' : 'In the Story'}
                    </Text>
                  )}

                  {/* Images */}
                  {hasBothImages ? (
                    <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                      <View style={{
                        flex: 1,
                        height: 180,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: '#F9FAFB',
                      }}>
                        <Image
                          src={char.originalCreationUrl!}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </View>
                      <View style={{
                        flex: 1,
                        height: 180,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: '#F9FAFB',
                      }}>
                        <Image
                          src={char.storyVersionUrl!}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={{
                      width: '60%',
                      height: 180,
                      borderRadius: 8,
                      overflow: 'hidden',
                      backgroundColor: '#F9FAFB',
                    }}>
                      <Image
                        src={singleImageUrl!}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </View>
                  )}

                  {/* Caption */}
                  <Text style={{
                    fontSize: 11,
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

      {/* Scene Pages */}
      {scenes.map((scene, index) => {
        const caption = scene.caption || scene.description || '';
        const { fontSize, lineHeight } = getSmartFontSize(caption);

        return (
          <Page key={index} size={{ width: 420, height: 595 }} style={styles.page}>
            <View style={styles.scenePage}>
              {/* Image Section - 65% with contain to prevent squishing */}
              <View style={styles.sceneImageContainer}>
                <Image
                  src={scene.imageUrl}
                  style={styles.sceneImage}
                />
              </View>

              {/* Text Section - 35% with smart font sizing */}
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
                        marginTop: 8,
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
                  ...(scene.sceneNumber % 2 === 1 ? { left: 25 } : { right: 25 }),
                  fontSize: 9,
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

      {/* Back Cover - Pre-rendered Marketing Page */}
      <Page size={{ width: 420, height: 595 }} style={styles.page}>
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
