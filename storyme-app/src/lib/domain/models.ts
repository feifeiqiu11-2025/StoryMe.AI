/**
 * Unified Domain Models
 * Single source of truth for all data types
 * Matches database schema (snake_case) with TypeScript interfaces
 */

// Re-export artist types
export * from '../types/artist';

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

  // Animated Preview (AI-generated story version)
  animated_preview_url?: string;

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

  // Subject classification — determines how the character is treated by image gen
  // and the story bible. Values seen in the codebase: 'human' | 'animal' | 'creature' |
  // 'object' | 'scenery' | 'scene'. 'scenery' (and 'scene') marks a location-capable
  // character that the bible can use as a backing for a story_locations row.
  subject_type?: string;

  // Advanced Features
  lora_url?: string;
  lora_trained_at?: string;
  art_style_preference?: 'cartoon' | 'watercolor' | 'realistic';

  // Designer Info
  designer_name?: string;
  designer_age?: number;

  // Artist Community Features (NEW)
  source_type?: 'user' | 'artist_community';
  artist_id?: string;
  artwork_id?: string;
  is_public?: boolean;
  usage_count_total?: number;

  created_at: string;
  updated_at: string;
}

// ============================================
// PROJECT MODELS
// ============================================

export type ProjectType = 'picture_book' | 'chapter_book';

export interface Project {
  id: string;
  user_id: string;

  // Project flavor — see migration 20260508. Existing rows default to
  // 'picture_book' so legacy queries are unaffected.
  project_type?: ProjectType;

  title?: string;
  description?: string;
  status: 'draft' | 'processing' | 'completed' | 'error';

  // Story Content
  original_script?: string;
  simplified_script?: string;
  reading_level?: number; // 3-8 years old (updated from enum to number)

  // Story Enhancement Settings
  story_tone?: 'playful' | 'educational' | 'adventure' | 'gentle' | 'silly' | 'mystery' | 'friendly' | 'brave';

  // Author Info
  author_name?: string;
  author_age?: number;

  // Cover Image
  cover_image_url?: string;

  // Media
  video_url?: string;
  transcription?: string;

  // Privacy & Sharing
  visibility?: 'private' | 'unlisted' | 'public';
  share_token?: string | null;
  featured?: boolean;
  view_count?: number;
  share_count?: number;

  // Import tracking (for PDF imports)
  source_type?: 'created' | 'imported_pdf';
  import_metadata?: {
    original_filename?: string;
    extraction_time?: number;
    total_pages?: number;
    gemini_model_used?: string;
  };

  // Bilingual / Multi-language
  secondary_language?: string;    // 'zh', 'ko', etc. — chosen secondary language for this project

  // Editor document state. Repurposed by 20260508: for chapter_book projects
  // this holds the Tiptap ProseMirror doc JSON. Unused for picture_book.
  canvas_state?: Record<string, any>;

  // Draft state (UI-specific data not in structured columns)
  draft_metadata?: Record<string, any>;

  // Story bible flag: TRUE when this project was enhanced via the story-bible
  // pipeline (pronoun resolution + location clustering). FALSE = legacy path.
  uses_story_bible?: boolean;

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

  // Scene Enhancement (AI-generated)
  raw_description?: string;      // Original user input
  enhanced_prompt?: string;       // AI-enhanced for image generation
  caption?: string;               // Age-appropriate caption for PDF
  caption_chinese?: string;       // Chinese translation (kept for mobile app backward compat)
  caption_secondary?: string;     // Generic secondary language caption

  // Characters in this scene
  character_ids?: string[];

  // Scene metadata
  location_type?: string;
  location_description?: string;
  time_of_day?: 'morning' | 'afternoon' | 'evening' | 'night';

  // Story bible: pointer to the resolved location for this scene.
  // NULL on legacy (pre-bible) scenes — image gen falls back to location_description.
  location_id?: string;

  // Story bible: pronoun-resolved character UUIDs present in this scene.
  // Empty array on legacy scenes — image gen falls back to character_ids.
  resolved_character_ids?: string[];

  // TRUE when the user edited scene characters/location after the prompt was generated,
  // so enhanced_prompt + caption should be refreshed before the next image regeneration.
  prompt_stale?: boolean;

  created_at: string;
}

// ============================================
// STORY LOCATION MODELS (story bible)
// ============================================

export interface StoryLocation {
  id: string;
  project_id: string;

  name: string;               // short, human-readable ("the old pine forest")
  description: string;        // locked visual description used for prompt + ref image
  reference_image_url?: string;

  // When set, the location is backed by a library character (subject_type='scene').
  // Image gen reuses that character's reference image instead of generating a fresh one.
  backing_character_id?: string;

  first_scene_index?: number; // ordering hint for UI

  created_at: string;
  updated_at: string;
  deleted_at?: string;
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

// ============================================
// AUDIO MODELS (for Reading Mode)
// ============================================

export interface StoryAudioPage {
  id: string;
  project_id: string;
  page_number: number;
  page_type: 'cover' | 'scene';
  scene_id?: string;

  // Audio data
  text_content: string;
  audio_url?: string;
  audio_filename?: string;
  audio_duration_seconds?: number;

  // Generation metadata
  voice_id?: string;
  tone?: string;
  generation_status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message?: string;

  created_at: string;
  updated_at: string;
}

export type StoryAudioPageInput = Omit<StoryAudioPage, 'id' | 'created_at' | 'updated_at'>;

export interface CharacterTag {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  created_at: string;
}

export interface StoryTag {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  display_order: number;
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
  project_tags?: Array<{
    tag_id: string;
    story_tags: StoryTag;
  }>;
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

export type StoryLocationInput = Omit<
  StoryLocation,
  'id' | 'created_at' | 'updated_at' | 'deleted_at'
>;
