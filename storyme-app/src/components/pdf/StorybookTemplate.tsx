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
    backgroundColor: '#4F46E5', // Gradient approximation with solid color
    padding: 60,
  },
  coverTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 40,
  },
  coverAuthor: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
  },
  scenePage: {
    flex: 1,
    flexDirection: 'column',
  },
  sceneImageContainer: {
    width: '100%',
    height: '70%',
    backgroundColor: '#F3F4F6',
  },
  sceneImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  sceneTextContainer: {
    height: '30%',
    padding: 30,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  sceneText: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#374151',
    textAlign: 'center',
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
  backCoverText: {
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  backCoverLogo: {
    fontSize: 32,
    color: '#ffffff',
    marginTop: 40,
  },
});

interface StorybookTemplateProps {
  title: string;
  description?: string;
  author?: string;
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
  scenes,
  createdDate,
}) => {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.coverTitle}>{title}</Text>
          {description && (
            <Text style={styles.coverSubtitle}>{description}</Text>
          )}
          <Text style={styles.coverAuthor}>By {author}</Text>
          {createdDate && (
            <Text style={[styles.coverAuthor, { marginTop: 20, fontSize: 12 }]}>
              {createdDate}
            </Text>
          )}
        </View>
      </Page>

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

      {/* Back Cover */}
      <Page size="A4" style={styles.page}>
        <View style={styles.backCoverPage}>
          <Text style={styles.backCoverText}>
            The End
          </Text>
          <Text style={[styles.coverSubtitle, { fontSize: 16 }]}>
            Created with love for our little storyteller
          </Text>
          <Text style={styles.backCoverLogo}>
            ✨ StoryMe ✨
          </Text>
        </View>
      </Page>
    </Document>
  );
};
