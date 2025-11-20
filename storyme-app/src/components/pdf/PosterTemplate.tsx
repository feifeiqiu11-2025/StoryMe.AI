/**
 * Poster PDF Template
 * Uses @react-pdf/renderer for reliable PDF generation
 */

import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts for Chinese support
Font.register({
  family: 'NotoSansSC',
  src: 'https://fonts.gstatic.com/s/notosanssc/v26/k3kXo84MPvpLmixcA63oeALhLOCT-xWNm8Hqd37g1OkDRZe7lR4sg1IzSy-MNbE9VNkn.119.woff2',
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  container: {
    flex: 1,
  },
  // Header
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B5FFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 5,
  },
  tagline: {
    fontSize: 10,
    color: '#888888',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  // Sections
  section: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  studioSection: {
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3B5FFF',
    marginBottom: 8,
  },
  studioTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeYellow: {
    backgroundColor: '#F59E0B',
    color: '#FFFFFF',
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginTop: 8,
  },
  // Features list
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 9,
    color: '#374151',
    marginRight: 12,
    marginBottom: 4,
  },
  featureTag: {
    backgroundColor: '#E0E7FF',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  featureTagText: {
    fontSize: 8,
    color: '#4338CA',
  },
  // Story grid
  storiesContainer: {
    marginBottom: 15,
  },
  storiesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  storyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  storyCard: {
    width: '15%',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  storyImage: {
    width: '100%',
    aspectRatio: 1,
  },
  storyLabel: {
    fontSize: 6,
    textAlign: 'center',
    paddingVertical: 3,
    color: '#374151',
  },
  // QR Section
  qrContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  qrBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  qrPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#E5E7EB',
    marginBottom: 5,
  },
  qrLabel: {
    fontSize: 8,
    color: '#374151',
    fontWeight: 'bold',
  },
  qrSublabel: {
    fontSize: 6,
    color: '#6B7280',
  },
  // Pricing footer
  pricingContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  pricingTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pricingItem: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  pricingLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
  },
  pricingValue: {
    fontSize: 7,
    color: '#6B7280',
  },
  pricingNote: {
    fontSize: 6,
    color: '#9CA3AF',
  },
  // Row layouts
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlight: {
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
});

// Story cover URLs
const STORY_COVERS = {
  astronaut: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762485155281.png',
  chef: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762997800987.png',
  doctor: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762998310307.png',
  firefighter: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/ce3fd991-04fc-4842-bfe1-6eaeceb9e59f/covers/1763144123894.png',
  artist: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/d7ca9615-06fc-449a-bd45-cb5006971619/covers/1763110054393.png',
  pilot: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1763149800245.png',
};

interface PosterTemplateProps {
  language: 'english' | 'chinese';
  logoUrl?: string;
}

export function PosterTemplate({ language, logoUrl }: PosterTemplateProps) {
  const isEnglish = language === 'english';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerContainer}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <Text style={styles.title}>KindleWood Kids</Text>
          </View>
          <Text style={styles.subtitle}>
            {isEnglish ? 'Free Reading & Learning App for Children' : '免费儿童阅读 & 学习 App'}
          </Text>
          <Text style={styles.tagline}>
            {isEnglish
              ? 'Where Imagination Grows into Learning — Read, Listen, and Learn Anywhere'
              : '让想象在学习中成长 — 随时随地阅读、聆听、学习'}
          </Text>

          {/* Kids App Section */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.sectionTitle}>
                {isEnglish ? '📱 Scan to Download' : '📱 扫码下载'}
              </Text>
              <Text style={styles.badge}>
                {isEnglish ? 'FREE 6 months' : '半年免费'}
              </Text>
            </View>
            <Text style={{ fontSize: 9, color: '#374151', marginBottom: 6 }}>
              {isEnglish ? 'New stories every day:' : '每天都有全新故事更新：'}
            </Text>
            <View style={styles.featureRow}>
              <View style={styles.featureTag}><Text style={styles.featureTagText}>Cool Jobs</Text></View>
              <View style={styles.featureTag}><Text style={styles.featureTagText}>Sports</Text></View>
              <View style={styles.featureTag}><Text style={styles.featureTagText}>Adventure</Text></View>
              <View style={styles.featureTag}><Text style={styles.featureTagText}>{isEnglish ? 'Chinese Stories' : '中文故事'}</Text></View>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureItem}>{isEnglish ? '🎧 Listen to stories' : '🎧 听故事'}</Text>
              <Text style={styles.featureItem}>{isEnglish ? '📖 Learn new facts' : '📖 学知识'}</Text>
              <Text style={styles.featureItem}>{isEnglish ? '🔤 Tap-to-read words' : '🔤 点读学单词'}</Text>
              <Text style={styles.featureItem}>{isEnglish ? '🎯 Read 5 → Get 🧁' : '🎯 读5篇换🧁'}</Text>
            </View>
          </View>

          {/* Studio Section */}
          <View style={styles.studioSection}>
            <Text style={styles.highlight}>
              {isEnglish ? '✨ Turn Your Child into a Storyteller!' : '✨ 想让孩子成为 Storyteller？'}
            </Text>
            <Text style={styles.studioTitle}>🎨 KindleWood Studio</Text>
            <Text style={{ fontSize: 9, color: '#374151', marginBottom: 8 }}>
              {isEnglish
                ? "Kids don't just read stories — they CREATE their own stories"
                : '孩子不只"读故事"，还能"创造自己的故事"'}
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#374151', marginBottom: 4 }}>
                  {isEnglish ? 'You can:' : '你可以：'}
                </Text>
                <Text style={styles.featureItem}>{isEnglish ? '✏️ Create custom storybooks' : '✏️ 自由创作故事书'}</Text>
                <Text style={styles.featureItem}>{isEnglish ? '🤖 Add AI narration' : '🤖 用 AI Audio 讲故事'}</Text>
                <Text style={styles.featureItem}>{isEnglish ? '🎙️ Record your own voice' : '🎙️ 录制孩子/父母声音'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#374151', marginBottom: 4 }}>
                  {isEnglish ? '🎧 Highlights:' : '🎧 亮点功能：'}
                </Text>
                <Text style={styles.featureItem}>{isEnglish ? '📣 One-tap publish to Spotify' : '📣 一键发布到 Spotify'}</Text>
                <Text style={styles.featureItem}>{isEnglish ? '📱 Sync to Kids App' : '📱 同步到 Kids App'}</Text>
              </View>
            </View>
            <Text style={styles.badgeYellow}>
              {isEnglish ? '🎁 2 Free Stories per user' : '🎁 每人免费创作 2 本故事'}
            </Text>
          </View>

          {/* Story Cards */}
          <View style={styles.storiesContainer}>
            <Text style={styles.storiesTitle}>
              {isEnglish ? '📚 Popular Stories' : '📚 热门故事'}
            </Text>
            <View style={styles.storyGrid}>
              <View style={styles.storyCard}>
                <Image src={STORY_COVERS.astronaut} style={styles.storyImage} />
                <Text style={styles.storyLabel}>{isEnglish ? 'Astronaut' : '宇航员'}</Text>
              </View>
              <View style={styles.storyCard}>
                <Image src={STORY_COVERS.chef} style={styles.storyImage} />
                <Text style={styles.storyLabel}>{isEnglish ? 'Chef' : '厨师'}</Text>
              </View>
              <View style={styles.storyCard}>
                <Image src={STORY_COVERS.doctor} style={styles.storyImage} />
                <Text style={styles.storyLabel}>{isEnglish ? 'Doctor' : '医生'}</Text>
              </View>
              <View style={styles.storyCard}>
                <Image src={STORY_COVERS.firefighter} style={styles.storyImage} />
                <Text style={styles.storyLabel}>{isEnglish ? 'Firefighter' : '消防员'}</Text>
              </View>
              <View style={styles.storyCard}>
                <Image src={STORY_COVERS.artist} style={styles.storyImage} />
                <Text style={styles.storyLabel}>{isEnglish ? 'Artist' : '艺术家'}</Text>
              </View>
              <View style={styles.storyCard}>
                <Image src={STORY_COVERS.pilot} style={styles.storyImage} />
                <Text style={styles.storyLabel}>{isEnglish ? 'Pilot' : '飞行员'}</Text>
              </View>
            </View>
          </View>

          {/* QR Codes */}
          <View style={styles.qrContainer}>
            <View style={styles.qrBox}>
              <View style={styles.qrPlaceholder} />
              <Text style={styles.qrLabel}>App Store</Text>
            </View>
            <View style={styles.qrBox}>
              <View style={styles.qrPlaceholder} />
              <Text style={styles.qrLabel}>Studio</Text>
              <Text style={styles.qrSublabel}>kindlewoodstudio.ai</Text>
            </View>
            <View style={styles.qrBox}>
              <View style={styles.qrPlaceholder} />
              <Text style={styles.qrLabel}>{isEnglish ? 'Community' : '扫码入群'}</Text>
            </View>
          </View>

          {/* Pricing Footer */}
          <View style={styles.pricingContainer}>
            <Text style={styles.pricingTitle}>
              {isEnglish ? '🔥 Pricing' : '🔥 价格说明'}
            </Text>
            <View style={styles.pricingRow}>
              <View style={styles.pricingItem}>
                <Text style={styles.pricingLabel}>📱 Kids App</Text>
                <Text style={styles.pricingValue}>
                  {isEnglish ? 'Completely free for 6 months' : '半年内完全免费'}
                </Text>
                <Text style={styles.pricingNote}>
                  {isEnglish ? 'No subscription · No tricks' : '无订阅 · 无套路'}
                </Text>
              </View>
              <View style={styles.pricingItem}>
                <Text style={styles.pricingLabel}>🖥 Studio</Text>
                <Text style={styles.pricingValue}>
                  {isEnglish ? '2 free stories' : '免费创作 2 本'}
                </Text>
                <Text style={styles.pricingNote}>
                  {isEnglish ? 'Pay-as-you-go after' : '超出按需付费'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
