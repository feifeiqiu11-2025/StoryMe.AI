/**
 * Type Converters
 * Convert between database models (snake_case) and DTOs (camelCase)
 */

import type {
  CharacterLibrary,
  Project,
  ProjectCharacter,
  Scene,
  GeneratedImage,
  ProjectWithCharacters,
  ProjectWithScenes,
  SceneWithImages,
} from './models';

import type {
  CharacterDTO,
  CharacterDescriptionDTO,
  CreateCharacterDTO,
  UpdateCharacterDTO,
  ProjectDTO,
  ProjectWithCharactersDTO,
  ProjectWithScenesDTO,
  ProjectCharacterDTO,
  SceneDTO,
  SceneWithImagesDTO,
  GeneratedImageDTO,
  CreateSceneDTO,
} from './dtos';

// ============================================
// CHARACTER CONVERTERS
// ============================================

export function characterToDTO(character: CharacterLibrary): CharacterDTO {
  return {
    id: character.id,
    userId: character.user_id,
    name: character.name,
    isFavorite: character.is_favorite,
    usageCount: character.usage_count,
    referenceImage: {
      url: character.reference_image_url || '',
      fileName: character.reference_image_filename || '',
    },
    description: {
      hairColor: character.hair_color,
      skinTone: character.skin_tone,
      clothing: character.clothing,
      age: character.age,
      otherFeatures: character.other_features,
    },
    personalityTraits: character.personality_traits,
    loraUrl: character.lora_url,
    loraTrainedAt: character.lora_trained_at,
    artStylePreference: character.art_style_preference,
    createdAt: character.created_at,
    updatedAt: character.updated_at,
  };
}

export function characterFromDTO(dto: CreateCharacterDTO, userId: string): Partial<CharacterLibrary> {
  return {
    user_id: userId,
    name: dto.name,
    reference_image_url: dto.referenceImageUrl,
    reference_image_filename: dto.referenceImageFileName,
    hair_color: dto.hairColor,
    skin_tone: dto.skinTone,
    clothing: dto.clothing,
    age: dto.age,
    other_features: dto.otherFeatures,
    is_favorite: false,
    usage_count: 0,
  };
}

export function characterUpdateFromDTO(dto: UpdateCharacterDTO): Partial<CharacterLibrary> {
  const updates: Partial<CharacterLibrary> = {};

  if (dto.name !== undefined) updates.name = dto.name;
  if (dto.referenceImageUrl !== undefined) updates.reference_image_url = dto.referenceImageUrl;
  if (dto.referenceImageFileName !== undefined) updates.reference_image_filename = dto.referenceImageFileName;
  if (dto.hairColor !== undefined) updates.hair_color = dto.hairColor;
  if (dto.skinTone !== undefined) updates.skin_tone = dto.skinTone;
  if (dto.clothing !== undefined) updates.clothing = dto.clothing;
  if (dto.age !== undefined) updates.age = dto.age;
  if (dto.otherFeatures !== undefined) updates.other_features = dto.otherFeatures;
  if (dto.isFavorite !== undefined) updates.is_favorite = dto.isFavorite;

  return updates;
}

// ============================================
// PROJECT CONVERTERS
// ============================================

export function projectToDTO(project: Project): ProjectDTO {
  return {
    id: project.id,
    userId: project.user_id,
    title: project.title,
    description: project.description,
    status: project.status,
    originalScript: project.original_script,
    simplifiedScript: project.simplified_script,
    readingLevel: project.reading_level,
    videoUrl: project.video_url,
    transcription: project.transcription,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    authorName: (project as any).author_name,
    authorAge: (project as any).author_age,
    coverImageUrl: (project as any).cover_image_url,
    visibility: project.visibility,
    featured: project.featured,
    viewCount: project.view_count,
    shareCount: project.share_count,
  };
}

export function projectWithCharactersToDTO(project: ProjectWithCharacters): ProjectWithCharactersDTO {
  return {
    ...projectToDTO(project),
    characters: (project.characters || []).map(pc => ({
      id: pc.id,
      projectId: pc.project_id,
      characterLibraryId: pc.character_library_id,
      character: characterToDTO(pc.character),
      isPrimary: pc.is_primary,
      orderIndex: pc.order_index,
      role: pc.role,
      overrideClothing: pc.override_clothing,
      overrideAge: pc.override_age,
      overrideDescription: pc.override_description,
      createdAt: pc.created_at,
    })),
  };
}

export function projectWithScenesToDTO(project: ProjectWithScenes): ProjectWithScenesDTO {
  // Extract tags from the project_tags join table
  const tags = (project.project_tags || [])
    .map(pt => pt.story_tags)
    .filter(Boolean);

  return {
    ...projectToDTO(project),
    scenes: (project.scenes || []).map(sceneWithImagesToDTO),
    tags,
  };
}

// ============================================
// SCENE CONVERTERS
// ============================================

export function sceneToDTO(scene: Scene): SceneDTO {
  return {
    id: scene.id,
    projectId: scene.project_id,
    sceneNumber: scene.scene_number,
    description: scene.description,
    simplifiedText: scene.simplified_text,
    rawDescription: scene.raw_description,
    enhancedPrompt: scene.enhanced_prompt,
    caption: scene.caption,
    captionChinese: scene.caption_chinese,
    characterIds: scene.character_ids,
    locationType: scene.location_type,
    locationDescription: scene.location_description,
    timeOfDay: scene.time_of_day,
    createdAt: scene.created_at,
  };
}

export function sceneWithImagesToDTO(scene: SceneWithImages): SceneWithImagesDTO {
  return {
    ...sceneToDTO(scene),
    images: (scene.images || []).map(generatedImageToDTO),
  };
}

export function sceneFromDTO(dto: CreateSceneDTO): Partial<Scene> {
  return {
    project_id: dto.projectId,
    scene_number: dto.sceneNumber,
    description: dto.description,
    character_ids: dto.characterIds,
  };
}

// ============================================
// IMAGE CONVERTERS
// ============================================

export function generatedImageToDTO(image: GeneratedImage): GeneratedImageDTO {
  return {
    id: image.id,
    sceneId: image.scene_id,
    projectId: image.project_id,
    imageUrl: image.image_url,
    imageFilename: image.image_filename,
    thumbnailUrl: image.thumbnail_url,
    prompt: image.prompt,
    negativePrompt: image.negative_prompt,
    generationTime: image.generation_time,
    falRequestId: image.fal_request_id,
    modelUsed: image.model_used,
    status: image.status,
    errorMessage: image.error_message,
    costUsd: image.cost_usd,
    createdAt: image.created_at,
  };
}

export function generatedImageFromDTO(dto: Partial<GeneratedImageDTO>): Partial<GeneratedImage> {
  return {
    scene_id: dto.sceneId,
    project_id: dto.projectId,
    image_url: dto.imageUrl,
    image_filename: dto.imageFilename,
    thumbnail_url: dto.thumbnailUrl,
    prompt: dto.prompt,
    negative_prompt: dto.negativePrompt,
    generation_time: dto.generationTime,
    fal_request_id: dto.falRequestId,
    model_used: dto.modelUsed,
    status: dto.status,
    error_message: dto.errorMessage,
    cost_usd: dto.costUsd,
  };
}

// ============================================
// HELPER CONVERTERS
// ============================================

/**
 * Convert legacy Character type from story.ts to CharacterDTO
 * For backward compatibility during migration
 */
export interface LegacyCharacter {
  id: string;
  name: string;
  referenceImage: {
    url: string;
    fileName: string;
  };
  description: {
    hairColor?: string;
    skinTone?: string;
    clothing?: string;
    age?: string;
    otherFeatures?: string;
  };
  isPrimary: boolean;
  order: number;
}

export function legacyCharacterToDTO(legacy: LegacyCharacter): Partial<CharacterDTO> {
  return {
    id: legacy.id,
    name: legacy.name,
    referenceImage: legacy.referenceImage,
    description: {
      hairColor: legacy.description.hairColor,
      skinTone: legacy.description.skinTone,
      clothing: legacy.description.clothing,
      age: legacy.description.age,
      otherFeatures: legacy.description.otherFeatures,
    },
    isFavorite: false,
    usageCount: 0,
  };
}

export function characterDTOToLegacy(dto: CharacterDTO): LegacyCharacter {
  return {
    id: dto.id,
    name: dto.name,
    referenceImage: dto.referenceImage,
    description: {
      hairColor: dto.description.hairColor,
      skinTone: dto.description.skinTone,
      clothing: dto.description.clothing,
      age: dto.description.age,
      otherFeatures: dto.description.otherFeatures,
    },
    isPrimary: false,
    order: 0,
  };
}
