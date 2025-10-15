/**
 * Unified Domain Models
 * Single source of truth for all data types
 * Matches database schema (snake_case) with TypeScript interfaces
 */

// ============================================
// USER MODELS
// ============================================

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  subscription_tier: 'free' | 'premium';
  created_at: string;
  updated_at: string;
}

// ============================================
// CHARACTER MODELS
// ============================================

export interface ReferenceImage {
  url: string;
  pose?: string;
  embedding?: Record<string, unknown>;
}

export interface CharacterLibrary {
  id: string;
  user_id: string;

  // Basic Info
  name: string;
  is_favorite: boolean;
  usage_count: number;

  // Reference Images
  reference_image_url?: string;
  reference_image_filename?: string;

  // Description Fields
  hair_color?: string;
  skin_tone?: string;
  clothing?: string;
  age?: string;
  other_features?: string;
  personality_traits?: string[];

  // AI Generated Data
  ai_description?: string;
  character_embedding?: Record<string, unknown>;
  reference_images?: ReferenceImage[];

  // Advanced Features
  lora_url?: string;
  lora_trained_at?: string;
  art_style_preference?: 'cartoon' | 'watercolor' | 'realistic';

  created_at: string;
  updated_at: string;
}

// ============================================
// PROJECT MODELS
// ============================================

export interface Project {
  id: string;
  user_id: string;

  title?: string;
  description?: string;
  status: 'draft' | 'processing' | 'completed' | 'error';

  // Story Content
  original_script?: string;
  simplified_script?: string;
  reading_level?: 'pre-k' | 'kindergarten' | 'grade-1';

  // Media
  video_url?: string;
  transcription?: string;

  created_at: string;
  updated_at: string;
}

export interface ProjectCharacter {
  id: string;
  project_id: string;
  character_library_id: string;

  // Project-specific settings
  is_primary: boolean;
  order_index?: number;
  role?: 'protagonist' | 'friend' | 'helper' | 'antagonist';

  // Override settings
  override_clothing?: string;
  override_age?: string;
  override_description?: string;

  created_at: string;
}

// ============================================
// SCENE MODELS
// ============================================

export interface Scene {
  id: string;
  project_id: string;

  scene_number: number;
  description: string;
  simplified_text?: string;

  // Characters in this scene
  character_ids?: string[];

  // Scene metadata
  location_type?: string;
  location_description?: string;
  time_of_day?: 'morning' | 'afternoon' | 'evening' | 'night';

  created_at: string;
}

// ============================================
// IMAGE MODELS
// ============================================

export interface GeneratedImage {
  id: string;
  scene_id: string;
  project_id: string;

  // Image Data
  image_url: string;
  image_filename?: string;
  thumbnail_url?: string;

  // Generation Metadata
  prompt?: string;
  negative_prompt?: string;
  generation_time?: number;
  fal_request_id?: string;
  model_used?: string;

  // Status
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;

  // Cost Tracking
  cost_usd?: number;

  // Overall Scene Ratings (1-5 stars)
  overall_rating?: number; // 1-5
  scene_match_score?: number; // 1-5
  user_expectation_score?: number; // 1-5
  rating_feedback?: string;
  rated_at?: string;

  created_at: string;
}

export interface CharacterRating {
  id: string;
  generated_image_id: string;
  character_library_id: string;

  rating: 'good' | 'poor';
  user_id: string;

  created_at: string;
}

// ============================================
// STORYBOOK MODELS
// ============================================

export interface Storybook {
  id: string;
  project_id: string;
  user_id: string;

  // Book Info
  title?: string;
  author_name?: string;
  dedication?: string;

  // Files
  pdf_url?: string;
  cover_image_url?: string;

  // Metadata
  page_count?: number;
  reading_level?: string;
  art_style?: string;

  // Sharing
  is_public: boolean;
  share_token?: string;
  view_count: number;

  created_at: string;
}

export interface CharacterTag {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  created_at: string;
}

// ============================================
// COMPOSITE MODELS (with relations)
// ============================================

export interface CharacterWithTags extends CharacterLibrary {
  tags?: CharacterTag[];
}

export interface ProjectWithCharacters extends Project {
  characters?: (ProjectCharacter & { character: CharacterLibrary })[];
}

export interface ProjectWithScenes extends Project {
  scenes?: SceneWithImages[];
}

export interface SceneWithImages extends Scene {
  images?: GeneratedImage[];
}

export interface ProjectFull extends Project {
  characters?: (ProjectCharacter & { character: CharacterLibrary })[];
  scenes?: SceneWithImages[];
}

// ============================================
// INPUT TYPES (for creating/updating records)
// ============================================

export type CharacterLibraryInput = Omit<
  CharacterLibrary,
  'id' | 'user_id' | 'usage_count' | 'created_at' | 'updated_at'
>;

export type ProjectInput = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export type SceneInput = Omit<Scene, 'id' | 'created_at'>;

export type GeneratedImageInput = Omit<GeneratedImage, 'id' | 'created_at'>;

export type ProjectCharacterInput = Omit<ProjectCharacter, 'id' | 'created_at'>;
