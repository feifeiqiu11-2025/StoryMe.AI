/**
 * Data Transfer Objects (DTOs)
 * Frontend-friendly camelCase versions of database models
 * Used for API responses and UI components
 */

// ============================================
// CHARACTER DTOs
// ============================================

export interface CharacterDescriptionDTO {
  hairColor?: string;
  skinTone?: string;
  clothing?: string;
  age?: string;
  otherFeatures?: string;
}

export interface CharacterDTO {
  id: string;
  userId: string;
  name: string;
  isFavorite: boolean;
  usageCount: number;

  // Reference Image
  referenceImage: {
    url: string;
    fileName: string;
  };

  // Description
  description: CharacterDescriptionDTO;
  personalityTraits?: string[];

  // Advanced
  loraUrl?: string;
  loraTrainedAt?: string;
  artStylePreference?: 'cartoon' | 'watercolor' | 'realistic';

  createdAt: string;
  updatedAt: string;
}

export interface CreateCharacterDTO {
  name: string;
  referenceImageUrl?: string;
  referenceImageFileName?: string;
  hairColor?: string;
  skinTone?: string;
  clothing?: string;
  age?: string;
  otherFeatures?: string;
}

export interface UpdateCharacterDTO {
  name?: string;
  referenceImageUrl?: string;
  referenceImageFileName?: string;
  hairColor?: string;
  skinTone?: string;
  clothing?: string;
  age?: string;
  otherFeatures?: string;
  isFavorite?: boolean;
}

// ============================================
// PROJECT DTOs
// ============================================

export interface ProjectDTO {
  id: string;
  userId: string;
  title?: string;
  description?: string;
  status: 'draft' | 'processing' | 'completed' | 'error';
  originalScript?: string;
  simplifiedScript?: string;
  readingLevel?: 'pre-k' | 'kindergarten' | 'grade-1';
  videoUrl?: string;
  transcription?: string;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  authorAge?: number;
  coverImageUrl?: string;
  visibility?: 'private' | 'public';
  featured?: boolean;
  viewCount?: number;
  shareCount?: number;
}

export interface CreateProjectDTO {
  title?: string;
  description?: string;
  originalScript: string;
  characterIds: string[]; // Character library IDs to link
}

export interface UpdateProjectDTO {
  title?: string;
  description?: string;
  status?: 'draft' | 'processing' | 'completed' | 'error';
  originalScript?: string;
  simplifiedScript?: string;
}

export interface ProjectWithCharactersDTO extends ProjectDTO {
  characters: ProjectCharacterDTO[];
}

export interface ProjectWithScenesDTO extends ProjectDTO {
  scenes: SceneWithImagesDTO[];
}

export interface ProjectFullDTO extends ProjectDTO {
  characters: ProjectCharacterDTO[];
  scenes: SceneWithImagesDTO[];
}

// ============================================
// PROJECT CHARACTER DTOs
// ============================================

export interface ProjectCharacterDTO {
  id: string;
  projectId: string;
  characterLibraryId: string;
  character: CharacterDTO;
  isPrimary: boolean;
  orderIndex?: number;
  role?: 'protagonist' | 'friend' | 'helper' | 'antagonist';
  overrideClothing?: string;
  overrideAge?: string;
  overrideDescription?: string;
  createdAt: string;
}

// ============================================
// SCENE DTOs
// ============================================

export interface SceneDTO {
  id: string;
  projectId: string;
  sceneNumber: number;
  description: string;
  simplifiedText?: string;
  characterIds?: string[];
  characterNames?: string[]; // Helper for display
  locationType?: string;
  locationDescription?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  createdAt: string;
}

export interface CreateSceneDTO {
  projectId: string;
  sceneNumber: number;
  description: string;
  characterIds?: string[];
}

export interface SceneWithImagesDTO extends SceneDTO {
  images: GeneratedImageDTO[];
}

// ============================================
// IMAGE DTOs
// ============================================

export interface GeneratedImageDTO {
  id: string;
  sceneId: string;
  projectId: string;
  imageUrl: string;
  imageFilename?: string;
  thumbnailUrl?: string;
  prompt?: string;
  negativePrompt?: string;
  generationTime?: number;
  falRequestId?: string;
  modelUsed?: string;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
  costUsd?: number;
  createdAt: string;
}

export interface CreateGeneratedImageDTO {
  sceneId: string;
  projectId: string;
  imageUrl: string;
  prompt?: string;
  generationTime?: number;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}

export interface CharacterRatingDTO {
  characterId: string;
  characterName: string;
  rating?: 'good' | 'poor';
}

// ============================================
// STORYBOOK DTOs
// ============================================

export interface StorybookDTO {
  id: string;
  projectId: string;
  userId: string;
  title?: string;
  authorName?: string;
  dedication?: string;
  pdfUrl?: string;
  coverImageUrl?: string;
  pageCount?: number;
  readingLevel?: string;
  artStyle?: string;
  isPublic: boolean;
  shareToken?: string;
  viewCount: number;
  createdAt: string;
}

// ============================================
// API RESPONSE DTOs
// ============================================

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  error: string;
  details?: unknown;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// IMAGE GENERATION DTOs
// ============================================

export interface GenerateImagesRequestDTO {
  projectId: string;
  characters: CharacterDTO[];
  script: string;
  artStyle?: string;
}

export interface GenerateImagesResponseDTO {
  success: boolean;
  generatedImages: GeneratedImageDTO[];
  errors?: string[];
  totalScenes: number;
  successfulScenes: number;
}

export interface GenerationProgressDTO {
  current: number;
  total: number;
  message: string;
  sceneNumber?: number;
}
