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
  raw_description: string;      // Original user input
  enhanced_prompt: string;       // AI-enhanced for image generation
  caption: string;               // Age-appropriate caption for PDF
  characterNames: string[];      // Characters in this scene
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
