/**
 * Comic Book PDF Template — 2 scenes per page
 * Uses @react-pdf/renderer
 *
 * Page Size: A5 (420pt x 595pt) — same as classic
 * Layout: Each page has 2 scenes stacked vertically
 * Each scene: ~48% of page height (image + caption)
 * Cover, character designer pages, and back cover remain unchanged
 */

import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts (same as classic template)
Font.register({
  family: 'Noto Sans SC',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@4.5.11/files/noto-sans-sc-chinese-simplified-400-normal.woff', fontWeight: 400, format: 'woff' as any },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@4.5.11/files/noto-sans-sc-chinese-simplified-700-normal.woff', fontWeight: 700, format: 'woff' as any },
  ],
});

Font.register({
  family: 'Noto Sans KR',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.1.1/files/noto-sans-kr-korean-400-normal.woff', fontWeight: 400, format: 'woff' as any },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.1.1/files/noto-sans-kr-korean-700-normal.woff', fontWeight: 700, format: 'woff' as any },
  ],
});

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function containsCJK(text: string): boolean {
  return /[\u4e00-\u9fa5\uAC00-\uD7AF]/.test(text);
}

function containsKorean(text: string): boolean {
  return /[\uAC00-\uD7AF]/.test(text);
}

function wrapChineseText(text: string, maxCharsPerLine: number = 15): string {
  if (!containsCJK(text)) return text;
  const lines: string[] = [];
  let currentLine = '';
  for (let i = 0; i < text.length; i++) {
    currentLine += text[i];
    if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = '';
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  return lines.join('\n');
}

/** Fixed font size for comic layout */
function getComicFontSize(): { fontSize: number; lineHeight: number } {
  return { fontSize: 12, lineHeight: 1.3 };
}

interface CharacterForPDF {
  name: string;
  designerName?: string;
  originalCreationUrl?: string;
  storyVersionUrl?: string;
}

interface StorybookTemplateComicProps {
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
  pageSize?: { width: number; height: number };
}

export const StorybookTemplateComic: React.FC<StorybookTemplateComicProps> = ({
  title,
  description,
  author,
  coverImageUrl,
  scenes,
  characters,
  createdDate,
  pageSize = { width: 420, height: 595 },
}) => {
  const displayCharacters = (characters || []).filter(
    c => c.originalCreationUrl || c.storyVersionUrl
  );
  const characterPages = chunkArray(displayCharacters, 2);
  const scenePages = chunkArray(scenes, 2);

  return (
    <Document>
      {/* Cover Page — same as classic */}
      {coverImageUrl ? (
        <Page size={pageSize} style={{ flexDirection: 'column', backgroundColor: '#ffffff', padding: 0 }}>
          <View style={{ width: '100%', height: '80%', overflow: 'hidden' }}>
            <Image src={coverImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </View>
          <View style={{ height: '20%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', paddingTop: 15 }}>
            {author && (
              <Text style={{ fontSize: 14, fontFamily: 'Noto Sans SC', color: '#1F2937', fontWeight: 'bold', marginBottom: 6 }}>
                By {author}
              </Text>
            )}
            <Text style={{ fontSize: 10, fontFamily: 'Noto Sans SC', color: '#6B7280' }}>
              © 2026 KindleWood Studio
            </Text>
          </View>
        </Page>
      ) : (
        <Page size={pageSize} style={{ flexDirection: 'column', backgroundColor: '#ffffff', padding: 0 }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4F46E5', padding: 60 }}>
            <View style={{ width: '60%', height: 3, backgroundColor: '#FFD700', marginBottom: 40 }} />
            <Text style={{ fontSize: 36, fontWeight: 'bold', fontFamily: 'Noto Sans SC', color: '#ffffff', textAlign: 'center', marginBottom: 30 }}>{title}</Text>
            {description && <Text style={{ fontSize: 20, fontFamily: 'Noto Sans SC', color: '#E0E7FF', textAlign: 'center', marginBottom: 60, maxWidth: '80%' }}>{description}</Text>}
            <Text style={{ fontSize: 16, fontFamily: 'Noto Sans SC', color: '#C7D2FE', textAlign: 'center', fontStyle: 'italic', marginBottom: 30 }}>A StoryMe Adventure</Text>
            <View style={{ width: '60%', height: 3, backgroundColor: '#FFD700', marginTop: 40 }} />
            {author && <Text style={{ fontSize: 24, fontFamily: 'Noto Sans SC', color: '#ffffff', textAlign: 'center', marginTop: 20, fontWeight: 'bold' }}>By {author}</Text>}
            {createdDate && <Text style={{ fontSize: 12, fontFamily: 'Noto Sans SC', color: '#C7D2FE', textAlign: 'center', marginTop: 40 }}>{createdDate}</Text>}
          </View>
        </Page>
      )}

      {/* Character Designer Pages — same as classic */}
      {characterPages.map((pageChars, pageIndex) => (
        <Page key={`char-page-${pageIndex}`} size={pageSize} style={{ flexDirection: 'column', backgroundColor: '#ffffff', padding: 0 }}>
          <View style={{ flex: 1, padding: 25, paddingTop: 30 }}>
            {pageIndex === 0 && (
              <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', fontFamily: 'Noto Sans SC', color: '#4F46E5', textAlign: 'center', marginBottom: 4 }}>
                  Meet the Character Designers
                </Text>
                <View style={{ width: 80, height: 2, backgroundColor: '#E5E7EB', marginTop: 6 }} />
              </View>
            )}
            {pageChars.map((char, charIndex) => {
              const hasBothImages = !!char.originalCreationUrl && !!char.storyVersionUrl;
              const singleImageUrl = char.originalCreationUrl || char.storyVersionUrl;
              return (
                <View key={charIndex} style={{ flex: 1, marginBottom: charIndex === 0 && pageChars.length > 1 ? 10 : 0, alignItems: 'center' }}>
                  {hasBothImages ? (
                    <View style={{ flexDirection: 'row', width: '100%', marginBottom: 6 }}>
                      <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Noto Sans SC', color: '#6B7280', textAlign: 'center' }}>Original Creation</Text>
                      <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Noto Sans SC', color: '#6B7280', textAlign: 'center' }}>In the Story</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 8, fontFamily: 'Noto Sans SC', color: '#6B7280', textAlign: 'center', marginBottom: 6 }}>
                      {char.originalCreationUrl ? 'Original Creation' : 'In the Story'}
                    </Text>
                  )}
                  {hasBothImages ? (
                    <View style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
                      <View style={{ flex: 1, height: 180, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F9FAFB' }}>
                        <Image src={char.originalCreationUrl!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </View>
                      <View style={{ flex: 1, height: 180, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F9FAFB' }}>
                        <Image src={char.storyVersionUrl!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </View>
                    </View>
                  ) : (
                    <View style={{ width: '60%', height: 180, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F9FAFB' }}>
                      <Image src={singleImageUrl!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </View>
                  )}
                  <Text style={{ fontSize: 11, fontFamily: 'Noto Sans SC', color: '#1F2937', textAlign: 'center', marginTop: 8, fontWeight: 'bold' }}>
                    &ldquo;{char.name}&rdquo; — Designed by {char.designerName || '__________'}
                  </Text>
                </View>
              );
            })}
          </View>
        </Page>
      ))}

      {/* Scene Pages — 2 scenes per page, zigzag layout */}
      {scenePages.map((pageScenes, pageIndex) => {
        const { fontSize, lineHeight } = getComicFontSize();

        const renderCaption = (scene: typeof scenes[0]) => {
          const caption = scene.caption || scene.description || '';
          const secondaryText = scene.caption_secondary || scene.caption_chinese || '';
          const secondaryFontFamily = containsKorean(secondaryText) ? 'Noto Sans KR' : 'Noto Sans SC';

          return (
            <View style={{
              flex: 35,
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 12,
              paddingRight: 12,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
            }}>
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
              {secondaryText && (
                <Text style={{
                  fontSize,
                  lineHeight,
                  fontFamily: secondaryFontFamily,
                  color: '#6B7280',
                  textAlign: 'center',
                  marginTop: 4,
                }}>
                  {wrapChineseText(secondaryText)}
                </Text>
              )}
            </View>
          );
        };

        const renderImage = (scene: typeof scenes[0]) => (
          <View style={{ flex: 65, backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
            <Image src={scene.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </View>
        );

        return (
          <Page key={`scene-page-${pageIndex}`} size={pageSize} style={{ flexDirection: 'column', backgroundColor: '#ffffff', padding: 0 }}>
            <View style={{ flex: 1, flexDirection: 'column' }}>
              {/* Top scene: image LEFT, caption RIGHT */}
              <View style={{
                flex: 1,
                flexDirection: 'row',
                borderBottom: pageScenes.length > 1 ? '1.5pt solid #E5E7EB' : 'none',
              }}>
                {renderImage(pageScenes[0])}
                {renderCaption(pageScenes[0])}
              </View>

              {/* Bottom scene: caption LEFT, image RIGHT (swapped) */}
              {pageScenes.length > 1 ? (
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  {renderCaption(pageScenes[1])}
                  {renderImage(pageScenes[1])}
                </View>
              ) : (
                <View style={{ flex: 1, backgroundColor: '#FAFAFA' }} />
              )}
            </View>
          </Page>
        );
      })}

      {/* Back Cover */}
      <Page size={pageSize} style={{ flexDirection: 'column', backgroundColor: '#ffffff', padding: 0 }}>
        <Image src="/images/pdf-back-cover.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Page>
    </Document>
  );
};
