# KindleWood Kids App - Integration Guide

## Overview
This guide provides all the necessary information for integrating the KindleWood Kids app with the KindleWood Studio backend and web components.

---

## 1. Privacy & Legal Pages

### Production URLs
Base URL: `https://story-me-ai.vercel.app`

- **Privacy Policy**: `/privacy`
  - Full URL: `https://story-me-ai.vercel.app/privacy`
  - Use for: Privacy policy links in app settings, onboarding, app stores

- **Terms of Service**: `/terms`
  - Full URL: `https://story-me-ai.vercel.app/terms`
  - Use for: Terms acceptance during sign-up, app store requirements

- **Consent Page**: `/consent`
  - Full URL: `https://story-me-ai.vercel.app/consent`
  - Use for: COPPA compliance, parental consent flows

### Implementation Recommendation
Open these URLs in an in-app WebView or system browser depending on your platform's best practices.

---

## 2. API Endpoints for Story Consumption

### Base URL
- Development: `http://localhost:3000/api`
- Production: `https://story-me-ai.vercel.app/api`

### Authentication
All public story endpoints do **NOT** require authentication. However, for child-specific features (profiles, progress tracking), you'll need to implement Supabase authentication.

### Available Endpoints

#### GET `/api/stories/public`
Fetch list of public stories with pagination and filtering.

**Query Parameters:**
- `limit` (optional): Number of stories to return (1-100, default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `featured` (optional): Filter for featured stories (boolean)
- `sortBy` (optional): Sort order - `'recent'` or `'popular'` (default: recent)

**Example Request:**
```
GET /api/stories/public?limit=10&offset=0&featured=true&sortBy=recent
```

**Response:**
```json
{
  "success": true,
  "projects": [
    {
      "id": "uuid",
      "title": "Story Title",
      "description": "Story description",
      "coverImageUrl": "https://...",
      "authorName": "Child's Name",
      "authorAge": 7,
      "viewCount": 42,
      "featured": true,
      "scenes": [
        {
          "id": "uuid",
          "sceneNumber": 1,
          "description": "Scene description",
          "caption": "Scene text content",
          "imageUrl": "https://..."
        }
      ]
    }
  ],
  "count": 10,
  "offset": 0,
  "limit": 10
}
```

#### GET `/api/stories/public/[id]`
Fetch single story details. **Auto-increments view count** on each request.

**Example Request:**
```
GET /api/stories/public/abc-123-def
```

**Response:**
```json
{
  "success": true,
  "story": {
    "id": "abc-123-def",
    "title": "Story Title",
    "description": "Full description",
    "readingLevel": "beginner",
    "storyTone": "adventure",
    "coverImageUrl": "https://...",
    "authorName": "Emma",
    "authorAge": 8,
    "viewCount": 43,
    "scenes": [
      {
        "id": "scene-1",
        "sceneNumber": 1,
        "caption": "Text for this scene",
        "imageUrl": "https://...",
        "audioUrl": "https://..." // if available
      }
    ]
  }
}
```

#### POST `/api/stories/public/[id]`
Increment story metrics (views, shares).

**Request Body:**
```json
{
  "action": "view" | "share",
  "platform": "ios" | "android" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "View count incremented"
}
```

---

## 3. StoryCard Component Integration

### TypeScript Interfaces

```typescript
export interface StoryCardData {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  authorName?: string;
  authorAge?: number;
  viewCount?: number;
  featured?: boolean;
  visibility?: 'public' | 'private';
  sceneCount?: number;
  createdAt?: string;
  scenes?: Array<{
    imageUrl?: string | null;
    images?: Array<{ imageUrl?: string }>;
  }>;
}

export interface StoryCardProps {
  story: StoryCardData;
  onClick: () => void;
  variant?: 'community' | 'myStories';
  showPrivacyBadge?: boolean;
  showViewCount?: boolean;
  showFeaturedBadge?: boolean;
  showAuthor?: boolean;
  showSceneCount?: boolean;
  showDate?: boolean;
  onPrivacyToggle?: (storyId: string, currentVisibility: 'public' | 'private') => void;
  onDelete?: (storyId: string) => void;
  isUpdatingPrivacy?: boolean;
}
```

### Implementation Example (React Native)

```tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';

interface StoryCardData {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  authorName?: string;
  authorAge?: number;
  viewCount?: number;
  featured?: boolean;
  sceneCount?: number;
}

interface StoryCardProps {
  story: StoryCardData;
  onPress: () => void;
  showFeaturedBadge?: boolean;
  showAuthor?: boolean;
  showViewCount?: boolean;
}

export const StoryCard: React.FC<StoryCardProps> = ({
  story,
  onPress,
  showFeaturedBadge = true,
  showAuthor = true,
  showViewCount = true
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.card}
    >
      {/* Cover Image */}
      <Image
        source={{ uri: story.coverImageUrl || '/placeholder.jpg' }}
        style={styles.coverImage}
        resizeMode="cover"
      />

      {/* Featured Badge */}
      {showFeaturedBadge && story.featured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>⭐ Featured</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {story.title}
        </Text>

        {story.description && (
          <Text style={styles.description} numberOfLines={2}>
            {story.description}
          </Text>
        )}

        {/* Author Info */}
        {showAuthor && story.authorName && (
          <Text style={styles.author}>
            By {story.authorName}
            {story.authorAge && `, age ${story.authorAge}`}
          </Text>
        )}

        {/* View Count */}
        {showViewCount && story.viewCount !== undefined && (
          <Text style={styles.viewCount}>
            👁️ {story.viewCount} views
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverImage: {
    width: '100%',
    height: 200,
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  featuredText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  author: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  viewCount: {
    fontSize: 12,
    color: '#6B7280',
  },
});
```

### Usage Example

```tsx
import { StoryCard } from './components/StoryCard';

function CommunityStoriesScreen() {
  const [stories, setStories] = useState<StoryCardData[]>([]);

  useEffect(() => {
    // Fetch stories
    fetch('https://story-me-ai.vercel.app/api/stories/public?limit=20&featured=true')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStories(data.projects);
        }
      });
  }, []);

  const handleStoryPress = (storyId: string) => {
    // Navigate to story reading screen
    navigation.navigate('StoryReader', { storyId });
  };

  return (
    <ScrollView>
      {stories.map(story => (
        <StoryCard
          key={story.id}
          story={story}
          onPress={() => handleStoryPress(story.id)}
          showFeaturedBadge={true}
          showAuthor={true}
          showViewCount={true}
        />
      ))}
    </ScrollView>
  );
}
```

---

## 4. Database Schema Overview

### Key Tables

**projects** (Stories)
- `id` (uuid, primary key)
- `user_id` (uuid, references users)
- `title` (text)
- `description` (text)
- `cover_image_url` (text)
- `visibility` ('public' | 'private')
- `featured` (boolean)
- `view_count` (integer)
- `share_count` (integer)
- `reading_level` (text)
- `story_tone` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**scenes** (Story Pages/Scenes)
- `id` (uuid, primary key)
- `project_id` (uuid, references projects)
- `scene_number` (integer)
- `description` (text)
- `caption` (text) - The actual story text for this scene
- `audio_url` (text) - URL to audio narration file
- `created_at` (timestamp)

**generated_images** (Scene Images)
- `id` (uuid, primary key)
- `scene_id` (uuid, references scenes)
- `image_url` (text)
- `prompt` (text)
- `created_at` (timestamp)

**users** (Parent/Teacher Accounts)
- `id` (uuid, primary key)
- `email` (text)
- `subscription_tier` ('free' | 'premium' | 'team')
- `images_generated_count` (integer)
- `images_limit` (integer)
- `trial_ends_at` (timestamp)

---

## 5. Key Implementation Notes

### Authentication & Profiles

**Parent/Teacher Login:**
- Use Supabase Auth for authentication
- Share session between Studio and Kids app using Supabase client
- Store parent/teacher user_id for linking child profiles

**Child Profiles:**
- Create a new `child_profiles` table:
  ```sql
  CREATE TABLE child_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    age INTEGER,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- Allow multiple child profiles per parent account
- Track reading progress per child profile

### Image Caching Strategy

**Recommendations:**
- Use a robust image caching library (e.g., React Native Fast Image, SDWebImage for iOS, Glide for Android)
- Implement progressive loading with low-resolution placeholders
- Cache cover images and scene images for offline reading
- Preload next scene images while user reads current scene

**Storage Considerations:**
- Images are hosted on Supabase Storage or CDN
- Average story: 5-10 scenes with 1-3 images each
- Estimate 500KB-2MB per image
- Total story size: ~10-20MB

### Offline Functionality

**Recommended Approach:**
1. **Download for Offline Reading**
   - Download all scene images, audio files, and text content
   - Store in local app cache/storage
   - Mark stories as "Downloaded" in UI

2. **Sync Strategy**
   - Sync reading progress when back online
   - Update view counts and completion metrics
   - Download new content in background

3. **Storage Management**
   - Allow users to manage downloaded stories
   - Auto-cleanup least recently read stories if storage full
   - Show storage usage in settings

### Audio Narration

**File Format:**
- MP3 or AAC format
- Bitrate: 64-128 kbps (optimize for file size)
- Sample rate: 44.1 kHz

**Implementation:**
- Scene-level audio stored in `scenes.audio_url`
- Support both AI-generated voices and custom parent/teacher recordings
- Auto-play option with scene transitions
- Background audio playback support

**Audio Player Features:**
- Play/Pause controls
- Seek bar for longer narrations
- Volume control
- Speed adjustment (0.75x, 1x, 1.25x, 1.5x)

### Vocabulary Building

**Data Model:**
```typescript
interface VocabularyWord {
  id: string;
  childProfileId: string;
  word: string;
  language: 'en' | 'zh';
  definition: string;
  pronunciation: string; // IPA or pinyin
  audioUrl: string; // Pronunciation audio
  exampleSentence: string;
  storyId: string; // Where word was encountered
  sceneId: string;
  addedAt: Date;
  reviewedCount: number;
  lastReviewedAt: Date;
  mastered: boolean;
}
```

**Implementation:**
- Create `vocabulary_words` table in database
- When child taps a word, save it to their vocabulary list
- Provide word pronunciation audio (use TTS API)
- Show definitions in both English and Chinese
- Track review frequency and mastery level

**Features:**
- Vocabulary list view per child profile
- Review/practice mode with flashcards
- Mark words as "mastered"
- Export vocabulary list for parents/teachers

### Interactive Reading Features

**Word Tap Interaction:**
```typescript
interface WordInteraction {
  word: string;
  language: 'en' | 'zh';
  showDefinition: boolean;
  playPronunciation: () => void;
  addToVocabulary: () => void;
  showExamples: () => void;
}
```

**Implementation Example:**
```tsx
// Make story text tappable word-by-word
<Text>
  {caption.split(' ').map((word, index) => (
    <Text
      key={index}
      onPress={() => handleWordTap(word)}
      style={styles.tappableWord}
    >
      {word}{' '}
    </Text>
  ))}
</Text>
```

**Word Tap Actions:**
1. Show popup with pronunciation button
2. Display definition in current language
3. Option to hear word pronounced
4. Add to vocabulary list
5. Show example usage in context

### Quizzes & Comprehension

**Quiz Data Model:**
```typescript
interface StoryQuiz {
  id: string;
  storyId: string;
  questions: QuizQuestion[];
}

interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'sequencing';
  question: string;
  questionAudio?: string;
  options: string[];
  correctAnswer: string | number;
  explanation?: string;
  sceneReference?: string; // Which scene this relates to
}

interface QuizResult {
  id: string;
  childProfileId: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
  answers: {
    questionId: string;
    userAnswer: string | number;
    correct: boolean;
  }[];
}
```

**Quiz Types:**
1. **Comprehension Questions**: After reading
2. **Vocabulary Quizzes**: Based on encountered words
3. **Sequencing**: Put scenes in order
4. **Character/Plot Questions**: Understanding story elements

### Role-Play Learning (Coming Soon)

**Planned Features:**
- Voice recording for character dialogue
- Speech-to-text evaluation
- Pronunciation scoring
- Character role assignment
- Performance playback

**Data Model (Placeholder):**
```typescript
interface RolePlaySession {
  id: string;
  storyId: string;
  childProfileId: string;
  characterRole: string;
  recordings: {
    sceneId: string;
    audioUrl: string;
    transcript: string;
    pronunciationScore?: number;
  }[];
  completedAt: Date;
}
```

---

## 6. Error Handling

### API Error Responses

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}
```

**Common Error Codes:**
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `404` - Story not found
- `429` - Rate limit exceeded
- `500` - Server error

**Error Handling Example:**
```typescript
async function fetchStory(storyId: string) {
  try {
    const response = await fetch(
      `https://story-me-ai.vercel.app/api/stories/public/${storyId}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Story not found');
      } else if (response.status === 429) {
        throw new Error('Too many requests. Please try again later.');
      } else {
        throw new Error('Failed to load story');
      }
    }

    const data = await response.json();
    return data.story;
  } catch (error) {
    console.error('Error fetching story:', error);
    // Show user-friendly error message
    showErrorAlert('Unable to load story. Please check your connection.');
    throw error;
  }
}
```

---

## 7. Performance Recommendations

### Image Optimization
- Use WebP format where supported (50-75% smaller than JPG)
- Implement lazy loading for story lists
- Preload next scene while reading current scene
- Use thumbnail versions for story cards (200x300px)

### Network Optimization
- Implement request caching with Cache-Control headers
- Use pagination for story lists (20 stories per page)
- Batch API requests when possible
- Implement retry logic with exponential backoff

### Memory Management
- Release image memory when navigating away from story
- Limit number of cached stories (e.g., 10-20 stories max)
- Clear vocabulary audio cache periodically
- Monitor app memory usage and show warnings

---

## 8. Analytics & Tracking (Optional)

### Recommended Events to Track

**Story Engagement:**
- Story viewed (with story_id, child_profile_id)
- Story completed (finished reading all scenes)
- Scene viewed (track time spent per scene)
- Story shared (track platform)
- Story favorited/bookmarked

**Learning Metrics:**
- Words tapped for pronunciation
- Words added to vocabulary
- Vocabulary words reviewed
- Quiz completed (with score)
- Quiz question answered (correct/incorrect)

**App Usage:**
- Session duration
- Stories read per session
- Offline reading frequency
- Audio narration usage rate

**Implementation Example (Firebase Analytics):**
```typescript
import analytics from '@react-native-firebase/analytics';

// Track story view
await analytics().logEvent('story_viewed', {
  story_id: storyId,
  story_title: storyTitle,
  child_profile_id: childProfileId,
  child_age: childAge,
});

// Track vocabulary interaction
await analytics().logEvent('word_tapped', {
  word: word,
  language: language,
  story_id: storyId,
  child_profile_id: childProfileId,
});

// Track quiz completion
await analytics().logEvent('quiz_completed', {
  quiz_id: quizId,
  story_id: storyId,
  score: score,
  total_questions: totalQuestions,
  child_profile_id: childProfileId,
});
```

---

## 9. Testing Recommendations

### Test Scenarios

**Story Loading:**
- Load public stories list with various filters
- Load single story details
- Handle network errors gracefully
- Test pagination and infinite scroll
- Verify featured stories display correctly

**Offline Mode:**
- Download story for offline reading
- Read downloaded story without internet
- Verify all images and audio load
- Test sync when back online

**Vocabulary Building:**
- Tap words in both English and Chinese stories
- Save words to vocabulary list
- Review vocabulary flashcards
- Export vocabulary list

**Audio Narration:**
- Play scene narration
- Pause/resume playback
- Skip to next scene during playback
- Test background audio (iOS/Android specific)

**Child Profiles:**
- Create multiple child profiles
- Switch between profiles
- Track reading progress per child
- Verify data isolation between profiles

### Test Data

**Sample Story IDs (once deployed):**
- Use `/api/stories/public?limit=5&featured=true` to get test stories
- Create test stories in Studio for QA purposes

---

## 10. Deployment Checklist

### Before App Store Submission

- [ ] Privacy policy link working in app
- [ ] Terms of service link working in app
- [ ] COPPA compliance consent flow implemented
- [ ] Parent authentication required for account features
- [ ] Age gate implemented (ensure app is used by children with parent permission)
- [ ] Data encryption for child profiles and reading data
- [ ] Offline mode tested thoroughly
- [ ] Audio playback tested on all supported devices
- [ ] Memory usage optimized (no leaks)
- [ ] Crash reporting configured
- [ ] Analytics tracking implemented
- [ ] App store screenshots and descriptions prepared
- [ ] Review API rate limits and implement caching

### iOS Specific
- [ ] Background audio capability configured
- [ ] Parental controls support
- [ ] VoiceOver accessibility support
- [ ] Dynamic Type support

### Android Specific
- [ ] Offline storage permissions requested
- [ ] Audio focus handling
- [ ] TalkBack accessibility support
- [ ] Adaptive icon implemented

---

## 11. Contact & Support

### Technical Questions
- Repository: [Link to GitHub repo if available]
- API documentation: See this guide
- Backend team: [Contact info]

### Feature Requests & Bugs
- Feature requests for Kids app: [Issue tracker or email]
- Bug reports: [Issue tracker or email]

### Production API Monitoring
- Monitor endpoint availability
- Track error rates
- Report API issues to backend team

---

## 12. Future Enhancements

### Planned Features (Roadmap)
- **Multi-language Support**: Spanish, French, German story translations
- **Role-Play Mode**: Interactive voice acting and pronunciation practice
- **Reading Challenges**: Weekly challenges and achievements
- **Parent Dashboard**: Detailed analytics on child's reading progress
- **Social Features**: Story sharing with other children (moderated)
- **Custom Illustrations**: Children can draw their own scene images
- **Print Book Orders**: Physical book printing integration

### API Changes to Watch For
- New fields added to story responses (backward compatible)
- Enhanced filtering options for story lists
- Real-time story updates via WebSocket (future consideration)
- GraphQL API (possible future migration)

---

## Appendix A: Complete API Reference

### GET /api/stories/public

**Description**: Retrieve paginated list of public stories

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | number | No | 20 | Number of stories (1-100) |
| offset | number | No | 0 | Pagination offset |
| featured | boolean | No | false | Filter featured stories |
| sortBy | string | No | 'recent' | Sort order ('recent' or 'popular') |

**Response Schema:**
```typescript
{
  success: boolean;
  projects: Array<{
    id: string;
    title: string;
    description: string | null;
    coverImageUrl: string | null;
    authorName: string | null;
    authorAge: number | null;
    viewCount: number;
    featured: boolean;
    scenes: Array<{
      id: string;
      sceneNumber: number;
      description: string;
      caption: string;
      imageUrl: string;
    }>;
  }>;
  count: number;
  offset: number;
  limit: number;
}
```

### GET /api/stories/public/[id]

**Description**: Retrieve single story with all scenes. Auto-increments view count.

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Story UUID |

**Response Schema:**
```typescript
{
  success: boolean;
  story: {
    id: string;
    title: string;
    description: string;
    readingLevel: string;
    storyTone: string;
    coverImageUrl: string | null;
    authorName: string | null;
    authorAge: number | null;
    viewCount: number;
    scenes: Array<{
      id: string;
      sceneNumber: number;
      caption: string;
      imageUrl: string;
      audioUrl?: string; // if available
    }>;
  };
}
```

### POST /api/stories/public/[id]

**Description**: Increment story metrics (views or shares)

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Story UUID |

**Request Body:**
```typescript
{
  action: 'view' | 'share';
  platform?: string; // Optional: 'ios', 'android', 'web'
}
```

**Response Schema:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

## Appendix B: Sample Supabase Client Setup

### Installation
```bash
npm install @supabase/supabase-js
# or
yarn add @supabase/supabase-js
```

### Configuration
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Authentication Example
```typescript
// Sign in parent/teacher
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'parent@example.com',
  password: 'password123'
});

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Sign out
await supabase.auth.signOut();
```

### Query Stories Directly (Alternative to REST API)
```typescript
// Fetch public stories
const { data: stories, error } = await supabase
  .from('projects')
  .select(`
    id,
    title,
    description,
    cover_image_url,
    view_count,
    featured,
    scenes (
      id,
      scene_number,
      caption,
      generated_images (
        image_url
      )
    )
  `)
  .eq('visibility', 'public')
  .order('created_at', { ascending: false })
  .limit(20);
```

---

**Last Updated**: 2025-10-26
**Version**: 1.0.0
**Maintainer**: KindleWood Studio Backend Team
