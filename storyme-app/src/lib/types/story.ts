// Core types for the POC

// Story tone options for AI caption generation
export type StoryTone =
  | 'playful'       // Fun, energetic, joyful
  | 'educational'   // Learning-focused, informative
  | 'adventure'     // Exciting, brave, heroic
  | 'gentle'        // Calm, soothing, peaceful
  | 'silly'         // Absurd, humorous, wacky
  | 'mystery'       // Curious, questioning, wondering
  | 'friendly'      // Warm, social, cooperative
  | 'brave';        // Courageous, overcoming fears

// AI expansion level for story enhancement
export type ExpansionLevel =
  | 'minimal'       // Keep original structure, only enhance captions (default)
  | 'smart'         // AI expands story based on age, adds scenes
  | 'rich';         // Full creative expansion with detailed narrative

// Story visibility/privacy level
export type StoryVisibility =
  | 'private'       // Only creator can see (default for safety)
  | 'public';       // Visible on landing page and public gallery

export interface CharacterDescription {
  hairColor?: string;
  skinTone?: string;
  clothing?: string;
  age?: string;
  otherFeatures?: string;
}

export interface Character {
  id: string;
  name: string;
  referenceImage: {
    url: string;
    fileName: string;
  };
  description: CharacterDescription;
  isPrimary: boolean; // Primary character uses reference image in generation
  order: number; // Display order
  isFromLibrary?: boolean; // Track if character was imported from library
}

export interface Scene {
  id: string;
  sceneNumber: number;
  description: string;
  characterNames?: string[]; // Extracted character names in this scene
}

// Enhanced scene after AI processing
export interface EnhancedScene {
  sceneNumber: number;
  title?: string;                // Scene title for preview (NEW)
  raw_description: string;       // Original user input
  enhanced_prompt: string;       // AI-enhanced for image generation
  caption: string;               // Age-appropriate caption for PDF
  characterNames: string[];      // Characters in this scene
  isNewCharacter?: boolean;      // Flag if AI added new minor character (NEW)
}

// Enhanced scene with generated image
export interface EnhancedSceneWithImage extends EnhancedScene {
  imageUrl?: string;
  generationPrompt?: string;
  generationTime?: number;
}

export interface CharacterRating {
  characterId: string;
  characterName: string;
  rating?: 'good' | 'bad';
}

export interface GeneratedImage {
  id: string;
  sceneId: string;
  sceneNumber: number;
  sceneDescription: string;
  imageUrl: string;
  prompt: string;
  generationTime: number; // in seconds
  status: 'pending' | 'generating' | 'completed' | 'failed';
  characterRatings?: CharacterRating[]; // Per-character consistency ratings
  error?: string;

  // Overall Scene Ratings (1-5 stars)
  overallRating?: number; // 1-5
  sceneMatchScore?: number; // 1-5
  userExpectationScore?: number; // 1-5
  ratingFeedback?: string;
  ratedAt?: string;
}

export interface StorySession {
  characters: Character[]; // Multiple characters support
  script: string;
  scenes: Scene[];
  generatedImages: GeneratedImage[];
  status: 'idle' | 'processing' | 'completed' | 'error';
  artStyle?: string; // Art style for image generation
  readingLevel?: number; // Reading level for scene enhancement
  storyTone?: StoryTone; // Story tone for scene enhancement
  expansionLevel?: ExpansionLevel; // AI expansion level (NEW)
  enhancedScenes?: EnhancedScene[]; // Preview before image generation (NEW)
  approvedForGeneration?: boolean; // User approved enhanced scenes (NEW)
}

// Project/Story metadata for saved stories
export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'draft' | 'processing' | 'completed' | 'error';

  // Privacy & Sharing (NEW)
  visibility: StoryVisibility; // 'private' (default) or 'public'
  featured: boolean; // Admin-curated featured stories
  viewCount: number; // Number of views
  likeCount: number; // Number of likes (future)
  shareCount: number; // Social shares count
  publishedAt?: string; // ISO timestamp when made public

  // Story content
  originalScript?: string;
  readingLevel?: number;
  storyTone?: StoryTone;
  expansionLevel?: ExpansionLevel;

  // Metadata
  createdAt: string;
  updatedAt: string;

  // Relations (optional)
  scenes?: ProjectScene[];
}

// Scene within a saved project
export interface ProjectScene {
  id: string;
  projectId: string;
  sceneNumber: number;
  description: string;
  caption?: string;
  imageUrl?: string;
  prompt?: string;
  createdAt: string;
}

export interface FalImageResponse {
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
  timings: {
    inference: number;
  };
  seed: number;
  has_nsfw_concepts: boolean[];
  prompt: string;
}
