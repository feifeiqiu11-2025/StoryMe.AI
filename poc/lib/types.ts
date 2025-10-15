// Core types for the POC

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
}

export interface Scene {
  id: string;
  sceneNumber: number;
  description: string;
  characterNames?: string[]; // Extracted character names in this scene
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
}

export interface StorySession {
  characters: Character[]; // Multiple characters support
  script: string;
  scenes: Scene[];
  generatedImages: GeneratedImage[];
  status: 'idle' | 'processing' | 'completed' | 'error';
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
