/**
 * Little Artists Feature Types
 * Types for young artists and their character artwork contributions
 */

// ============================================
// LITTLE ARTIST PROFILE
// ============================================

export type ArtistStatus = 'draft' | 'pending_review' | 'published' | 'archived';

export interface LittleArtist {
  id: string;

  // Artist Info
  name: string;
  age?: number;
  bio?: string;
  profile_photo_url?: string;

  // Parent/Guardian
  parent_user_id: string;
  parent_consent_given: boolean;
  parent_consent_date?: string;
  parent_consent_text?: string;

  // Status & Moderation
  status: ArtistStatus;
  featured: boolean;
  display_order: number;

  // Admin Moderation
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  notification_sent_at?: string;

  // Stats
  artworks_count: number;
  character_usage_count: number;

  // Metadata
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// ============================================
// ARTIST ARTWORK
// ============================================

export type ArtworkStatus = 'draft' | 'processing' | 'published' | 'archived';
export type TransformationStyle = 'sketch-to-character' | 'cartoon' | 'watercolor' | 'realistic';

export interface ArtistArtwork {
  id: string;
  artist_id: string;

  // Artwork Images
  original_sketch_url: string;
  original_sketch_filename?: string;
  animated_version_url?: string;
  animated_version_filename?: string;

  // Link to Character Library
  character_library_id?: string;

  // Artwork Info
  title?: string;
  description?: string;
  character_name?: string;

  // Style Selection
  transformation_style: TransformationStyle;

  // Status
  status: ArtworkStatus;
  featured: boolean;
  display_order: number;

  // Generation Metadata
  ai_prompt_used?: string;
  generation_time_ms?: number;
  fal_request_id?: string;
  cost_usd?: number;
  error_message?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// ============================================
// COMBINED TYPES FOR UI
// ============================================

/**
 * Artist profile with populated artworks
 */
export interface ArtistWithArtworks extends LittleArtist {
  artworks: ArtistArtwork[];
}

/**
 * Artwork with artist attribution for display
 */
export interface ArtworkWithArtist extends ArtistArtwork {
  artist: Pick<LittleArtist, 'id' | 'name' | 'age'>;
}

// ============================================
// FORM DATA TYPES
// ============================================

/**
 * Data for creating a new artist profile
 */
export interface CreateArtistInput {
  name: string;
  age?: number;
  bio?: string;
  profile_photo_url?: string;
}

/**
 * Data for updating artist profile
 */
export interface UpdateArtistInput {
  name?: string;
  age?: number;
  bio?: string;
  profile_photo_url?: string;
  status?: ArtistStatus;
  featured?: boolean;
  display_order?: number;
}

/**
 * Data for creating artwork
 */
export interface CreateArtworkInput {
  artist_id: string;
  original_sketch_url: string;
  original_sketch_filename?: string;
  character_name?: string;
  transformation_style: TransformationStyle;
  title?: string;
  description?: string;
  share_to_library?: boolean; // Whether to add to character library
}

/**
 * Data for updating artwork
 */
export interface UpdateArtworkInput {
  title?: string;
  description?: string;
  character_name?: string;
  status?: ArtworkStatus;
  featured?: boolean;
  animated_version_url?: string;
  animated_version_filename?: string;
  character_library_id?: string;
}

/**
 * Parental consent form data
 */
export interface ArtistConsentInput {
  artist_id: string;
  consent_given: boolean;
  consent_text: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Response from sketch transformation API
 */
export interface SketchTransformResult {
  success: boolean;
  artwork?: ArtistArtwork;
  imageUrl?: string;
  generationTime?: number;
  error?: string;
}

/**
 * Response from artist list API
 */
export interface ArtistListResponse {
  artists: LittleArtist[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Response from artwork list API
 */
export interface ArtworkListResponse {
  artworks: ArtistArtwork[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// STYLE OPTIONS WITH METADATA
// ============================================

export interface StyleOption {
  value: TransformationStyle;
  label: string;
  description: string;
  emoji: string;
  examplePrompt: string;
}

export const TRANSFORMATION_STYLES: StyleOption[] = [
  {
    value: 'sketch-to-character',
    label: 'Sketch to Character',
    description: 'Preserves your drawing style with vibrant colors',
    emoji: '✏️',
    examplePrompt: 'children\'s book character, maintain original sketch style, clean lines, vibrant colors',
  },
  {
    value: 'cartoon',
    label: 'Cartoon Style',
    description: 'Colorful, animated look with bold colors',
    emoji: '🎨',
    examplePrompt: 'cartoon character, animated style, bold colors, smooth gradients',
  },
  {
    value: 'watercolor',
    label: 'Watercolor',
    description: 'Soft, painted style with artistic brush strokes',
    emoji: '🖌️',
    examplePrompt: 'watercolor painting, soft colors, artistic brush strokes',
  },
  {
    value: 'realistic',
    label: 'Realistic',
    description: 'Photo-like rendering with detailed features',
    emoji: '📷',
    examplePrompt: 'realistic illustration, detailed, photographic quality',
  },
];
