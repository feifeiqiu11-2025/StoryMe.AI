/**
 * Main Storybook PDF Template
 * Uses @react-pdf/renderer to create a beautiful children's book layout
 */

import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';

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
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
    letterSpacing: 2,
  },
  coverSubtitle: {
    fontSize: 18,
    color: '#E0E7FF',
    textAlign: 'center',
    marginBottom: 60,
    maxWidth: '80%',
  },
  coverTagline: {
    fontSize: 16,
    color: '#C7D2FE',
    textAlign: 'center',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  coverAuthor: {
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: 'bold',
  },
  coverDate: {
    fontSize: 12,
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
    height: '65%',
    backgroundColor: '#F3F4F6',
  },
  sceneImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  sceneTextContainer: {
    height: '35%',
    padding: 30,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  sceneText: {
    fontSize: 22,
    lineHeight: 2.0,
    color: '#374151',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  sceneNumber: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    fontSize: 10,
    color: '#9CA3AF',
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
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 50,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  backCoverMessage: {
    fontSize: 16,
    color: '#E9D5FF',
    textAlign: 'center',
    marginBottom: 10,
  },
  backCoverAuthor: {
    fontSize: 28,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 50,
    fontWeight: 'bold',
  },
  backCoverLogo: {
    fontSize: 14,
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
    description: string;
    imageUrl: string;
  }>;
  createdDate?: string;
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
      {coverImageUrl ? (
        <Page size="A4" style={styles.page}>
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
          {/* Author overlay at bottom only */}
          <View style={{
            position: 'absolute',
            bottom: 20,
            width: '100%',
            alignItems: 'center',
          }}>
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: 15,
              borderRadius: 10,
            }}>
              <Text style={{
                fontSize: 24,
                color: '#4B5563',
                textAlign: 'center',
              }}>
                By {author}
              </Text>
              {createdDate && (
                <Text style={{
                  fontSize: 14,
                  color: '#6B7280',
                  textAlign: 'center',
                  marginTop: 5,
                }}>
                  {createdDate}
                </Text>
              )}
            </View>
          </View>
        </Page>
      ) : (
        <Page size="A4" style={styles.page}>
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
        <Page key={index} size="A4" style={styles.page}>
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
                {scene.description}
              </Text>
              <Text style={styles.sceneNumber}>
                {scene.sceneNumber}
              </Text>
            </View>
          </View>
        </Page>
      ))}

    </Document>
  );
};
