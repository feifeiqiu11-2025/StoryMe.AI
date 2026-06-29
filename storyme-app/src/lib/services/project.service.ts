/**
 * Project Service
 * Business logic for story project management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectRepository } from '../repositories/project.repository';
import { SceneRepository } from '../repositories/scene.repository';
import { CharacterRepository } from '../repositories/character.repository';
import { StoryLocationRepository } from '../repositories/story-location.repository';
import { StorageService } from './storage.service';
import type { SecondaryLanguage } from '../config/languages';
import type { Project, ProjectCharacter, Scene, StoryLocation } from '../domain/models';
import type { StoryBibleResult } from '../ai/scene-enhancer';
import type {
  CreateProjectDTO,
  ProjectDTO,
  ProjectWithCharactersDTO,
  ProjectWithScenesDTO,
  ProjectFullDTO,
  SceneDTO,
} from '../domain/dtos';
import {
  projectToDTO,
  projectWithCharactersToDTO,
  projectWithScenesToDTO,
  projectFullToDTO,
} from '../domain/converters';

export class ProjectService {
  private projectRepo: ProjectRepository;
  private sceneRepo: SceneRepository;
  private characterRepo: CharacterRepository;
  private storyLocationRepo: StoryLocationRepository;
  private storageService: StorageService;

  constructor(supabase: SupabaseClient) {
    this.projectRepo = new ProjectRepository(supabase);
    this.sceneRepo = new SceneRepository(supabase);
    this.characterRepo = new CharacterRepository(supabase);
    this.storyLocationRepo = new StoryLocationRepository(supabase);
    this.storageService = new StorageService(supabase);
  }

  /**
   * Persist a story bible for a project: inserts story_locations, returns maps
   * used by the scene-save loop to resolve per-scene location_id and
   * resolved_character_ids from the LLM's name-based output.
   *
   * Call AFTER linkCharactersToProject so character_library_id rows exist; this
   * reads character names from character_library to map names → UUIDs.
   */
  private async persistStoryBible(
    projectId: string,
    bible: StoryBibleResult,
    characterIds: string[]
  ): Promise<{
    tempIdToLocationId: Map<string, string>;
    sceneNumberToBibleScene: Map<number, StoryBibleResult['scenes'][number]>;
    nameToCharacterId: Map<string, string>;
  }> {
    const supabase = this.projectRepo['supabase'];

    // Build name → character_library_id map (case-insensitive) from the characters linked to this project
    const { data: charRows } = await supabase
      .from('character_library')
      .select('id, name')
      .in('id', characterIds);

    const nameToCharacterId = new Map<string, string>();
    for (const row of charRows || []) {
      if (row?.name && row?.id) {
        nameToCharacterId.set(String(row.name).toLowerCase(), row.id);
      }
    }

    // Insert story_locations, resolving backing_character_name → backing_character_id.
    // reference_image_url is populated by the Phase 3 background generator when present;
    // null-or-undefined otherwise, in which case image gen falls back to locked prose + backing char.
    const locationRows = bible.locations.map(loc => ({
      name: loc.name,
      description: loc.description,
      reference_image_url: loc.reference_image_url ?? undefined,
      backing_character_id: loc.backing_character_name
        ? nameToCharacterId.get(String(loc.backing_character_name).toLowerCase())
        : undefined,
      first_scene_index: loc.first_scene_index,
    })) as Array<Omit<StoryLocation, 'id' | 'project_id' | 'created_at' | 'updated_at' | 'deleted_at'>>;

    const inserted = await this.storyLocationRepo.createBatch(projectId, locationRows);

    // Map temp_id → real UUID by index (createBatch preserves input order)
    const tempIdToLocationId = new Map<string, string>();
    bible.locations.forEach((loc, idx) => {
      const row = inserted[idx];
      if (row) tempIdToLocationId.set(loc.temp_id, row.id);
    });

    const sceneNumberToBibleScene = new Map<number, StoryBibleResult['scenes'][number]>();
    for (const s of bible.scenes) {
      if (typeof s.sceneNumber === 'number') sceneNumberToBibleScene.set(s.sceneNumber, s);
    }

    return { tempIdToLocationId, sceneNumberToBibleScene, nameToCharacterId };
  }

  /**
   * Resolve per-scene bible fields (location_id + resolved_character_ids) for a
   * given sceneNumber using the maps returned by persistStoryBible. Returns an
   * empty object when the bible has no data for this scene — caller spreads
   * the result into the scene insert payload.
   */
  private resolveSceneBibleFields(
    sceneNumber: number,
    maps: {
      tempIdToLocationId: Map<string, string>;
      sceneNumberToBibleScene: Map<number, StoryBibleResult['scenes'][number]>;
      nameToCharacterId: Map<string, string>;
    }
  ): { location_id?: string; resolved_character_ids?: string[] } {
    const bibleScene = maps.sceneNumberToBibleScene.get(sceneNumber);
    if (!bibleScene) return {};

    const location_id = bibleScene.location_temp_id
      ? maps.tempIdToLocationId.get(bibleScene.location_temp_id)
      : undefined;

    const resolved_character_ids = (bibleScene.resolved_character_names || [])
      .map(name => maps.nameToCharacterId.get(String(name).toLowerCase()))
      .filter((id): id is string => typeof id === 'string');

    return {
      ...(location_id ? { location_id } : {}),
      ...(resolved_character_ids.length > 0 ? { resolved_character_ids } : {}),
    };
  }

  /**
   * Create a new story project
   */
  async createProject(userId: string, data: CreateProjectDTO): Promise<ProjectDTO> {
    // Validate input
    if (!data.originalScript || data.originalScript.trim().length < 10) {
      throw new Error('Script must be at least 10 characters long');
    }

    // Character-optional: factual / world-exploration books may have zero
    // characters. Coerce to an array so the linking/usage loops below no-op.
    data.characterIds = data.characterIds ?? [];

    if (data.characterIds.length > 5) {
      throw new Error('Maximum 5 characters allowed');
    }

    // Verify all characters exist and belong to the user
    for (const charId of data.characterIds) {
      const character = await this.characterRepo.findById(charId);
      if (!character) {
        throw new Error(`Character ${charId} not found`);
      }
      if (character.user_id !== userId) {
        throw new Error(`Character ${charId} does not belong to you`);
      }
    }

    // Create project
    const project = await this.projectRepo.create({
      user_id: userId,
      title: data.title,
      description: data.description,
      original_script: data.originalScript,
      status: 'draft',
    });

    // Link characters to project
    await this.linkCharactersToProject(project.id, data.characterIds);

    // Increment character usage counts
    for (const charId of data.characterIds) {
      await this.characterRepo.incrementUsageCount(charId);
    }

    return projectToDTO(project);
  }

  /**
   * Link characters to a project
   */
  private async linkCharactersToProject(
    projectId: string,
    characterIds: string[]
  ): Promise<void> {
    const supabase = this.projectRepo['supabase']; // Access protected property

    const projectCharacters: Partial<ProjectCharacter>[] = characterIds.map((charId, index) => ({
      project_id: projectId,
      character_library_id: charId,
      is_primary: index === 0, // First character is primary
      order_index: index + 1,
    }));

    const { error } = await supabase
      .from('project_characters')
      .insert(projectCharacters);

    if (error) {
      throw new Error(`Failed to link characters: ${error.message}`);
    }
  }

  /**
   * Save scenes for a project
   */
  async saveScenes(
    projectId: string,
    scenes: Array<{ sceneNumber: number; description: string; characterIds?: string[] }>
  ): Promise<SceneDTO[]> {
    // Verify project exists
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Delete existing scenes
    await this.sceneRepo.deleteByProjectId(projectId);

    // Create new scenes
    const sceneRecords = scenes.map(scene => ({
      project_id: projectId,
      scene_number: scene.sceneNumber,
      description: scene.description,
      character_ids: scene.characterIds,
    }));

    const createdScenes = await this.sceneRepo.createMany(sceneRecords);

    return createdScenes.map(scene => ({
      id: scene.id,
      projectId: scene.project_id,
      sceneNumber: scene.scene_number,
      description: scene.description,
      characterIds: scene.character_ids,
      createdAt: scene.created_at,
    }));
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string, userId: string): Promise<ProjectDTO | null> {
    const project = await this.projectRepo.findById(projectId);

    if (!project) {
      return null;
    }

    // Verify ownership
    if (project.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }

    return projectToDTO(project);
  }

  /**
   * Get project with characters
   */
  async getProjectWithCharacters(
    projectId: string,
    userId: string
  ): Promise<ProjectWithCharactersDTO | null> {
    const project = await this.projectRepo.findByIdWithCharacters(projectId);

    if (!project) {
      return null;
    }

    // Verify ownership
    if (project.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }

    return projectWithCharactersToDTO(project);
  }

  /**
   * Get project with scenes and images
   */
  async getProjectWithScenes(
    projectId: string,
    userId: string
  ): Promise<ProjectWithScenesDTO | null> {
    const project = await this.projectRepo.findByIdWithScenes(projectId);

    if (!project) {
      return null;
    }

    // Verify ownership
    if (project.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }

    return projectWithScenesToDTO(project);
  }

  /**
   * Get project with scenes, images, and characters
   */
  async getProjectFull(
    projectId: string,
    userId: string
  ): Promise<ProjectFullDTO | null> {
    const project = await this.projectRepo.findByIdFull(projectId);

    if (!project) {
      return null;
    }

    // Verify ownership
    if (project.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }

    return projectFullToDTO(project);
  }

  /**
   * Get all projects for a user (with optional pagination)
   */
  async getUserProjects(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ projects: ProjectWithScenesDTO[]; total: number }> {
    const result = await this.projectRepo.findByUserIdWithScenes(userId, options);
    return {
      projects: result.projects.map(projectWithScenesToDTO),
      total: result.total,
    };
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    userId: string,
    updates: Partial<Project>
  ): Promise<ProjectDTO> {
    // Verify ownership
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    if (project.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }

    const updated = await this.projectRepo.update(projectId, updates);
    return projectToDTO(updated);
  }

  /**
   * Update project status
   */
  async updateProjectStatus(
    projectId: string,
    userId: string,
    status: 'draft' | 'processing' | 'completed' | 'error'
  ): Promise<ProjectDTO> {
    return this.updateProject(projectId, userId, { status });
  }

  /**
   * Rebuild a `draft_metadata` JSON blob for a previously-completed project, so the
   * /create page's resume-draft flow can re-hydrate state from a single field.
   *
   * Used by the admin "Edit story" action: when an admin reverts a completed story
   * back to draft, the story has no draft_metadata (cleared on the original
   * draft → completed transition). The relational data (project_characters,
   * scenes, generated_images, story_locations) holds everything needed; this
   * method transforms it into the shape the resume effect already understands.
   *
   * The resume code path is intentionally left untouched.
   */
  async buildDraftMetadataFromCompletedProject(
    projectId: string,
    userId: string
  ): Promise<Record<string, any>> {
    const supabase = this.projectRepo['supabase'];

    const fullProject = await this.getProjectFull(projectId, userId);
    if (!fullProject) throw new Error('Project not found');

    // Some project columns aren't surfaced on ProjectDTO (story_tone, content_language) —
    // read the raw row for those fields.
    const { data: rawProject } = await supabase
      .from('projects')
      .select('story_tone, content_language')
      .eq('id', projectId)
      .single();

    // Load story_locations (bible) and generated_images on scenes (already joined via getProjectFull).
    const { data: storyLocations } = await supabase
      .from('story_locations')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('first_scene_index', { ascending: true, nullsFirst: false });

    // character_library.id → name lookup, used for resolving bible character UUIDs back to names.
    const characterIdToName = new Map<string, string>();
    for (const pc of fullProject.characters || []) {
      if (pc.character?.id && pc.character?.name) {
        characterIdToName.set(pc.character.id, pc.character.name);
      }
    }

    // Client-side Character[] shape (matches @/lib/types/story Character).
    const characters = (fullProject.characters || []).map(pc => ({
      id: pc.character.id,
      name: pc.character.name,
      referenceImage: pc.character.referenceImage,
      animatedPreviewUrl: pc.character.animatedPreviewUrl,
      description: pc.character.description,
      isPrimary: pc.isPrimary,
      order: pc.orderIndex || 0,
      isFromLibrary: true,
    }));

    // Helper: derive character names for a scene from resolved_character_ids → names,
    // falling back to character_ids when bible-resolved data isn't present.
    const namesForScene = (scene: any): string[] => {
      const ids: string[] =
        (Array.isArray(scene.resolvedCharacterIds) && scene.resolvedCharacterIds.length > 0
          ? scene.resolvedCharacterIds
          : Array.isArray(scene.characterIds) ? scene.characterIds : []) as string[];
      return ids
        .map(id => characterIdToName.get(id))
        .filter((n): n is string => typeof n === 'string');
    };

    const scenesSorted = (fullProject.scenes || []).slice().sort((a, b) => a.sceneNumber - b.sceneNumber);

    // EnhancedScene[] shape (the create page state). Scene 0 is the cover.
    const enhancedScenes = scenesSorted.map(scene => {
      const isCover = scene.sceneNumber === 0;
      return {
        sceneNumber: scene.sceneNumber,
        raw_description: scene.rawDescription || '',
        enhanced_prompt: scene.enhancedPrompt || '',
        caption: scene.caption || '',
        caption_chinese: scene.captionChinese,
        caption_secondary: scene.captionSecondary,
        characterNames: namesForScene(scene),
        ...(isCover ? {
          isCover: true,
          storyTitle: fullProject.title,
          storyDescription: fullProject.description,
        } : {}),
      };
    });

    // imageGenerationStatus[] shape — flatten scene → first image.
    const imageGenerationStatus = scenesSorted.flatMap(scene => {
      const firstImage = (scene.images && scene.images[0]) || null;
      if (!firstImage) return [];
      return [{
        id: firstImage.id,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneDescription: scene.caption || scene.description || '',
        imageUrl: firstImage.imageUrl,
        prompt: firstImage.prompt,
        generationTime: firstImage.generationTime,
        status: firstImage.status,
      }];
    });

    // Cover image synthesis. Covers live on `project.cover_image_url` and are NOT stored
    // as `scene_number = 0` in the scenes table. If no cover scene exists but the project
    // has a cover URL, prepend a synthetic cover entry to enhancedScenes + imageGenerationStatus
    // so the resume flow shows the cover in the review UI.
    const hasCoverScene = enhancedScenes.some(s => s.sceneNumber === 0);
    if (!hasCoverScene && fullProject.coverImageUrl) {
      enhancedScenes.unshift({
        sceneNumber: 0,
        isCover: true,
        storyTitle: fullProject.title,
        storyDescription: fullProject.description,
        raw_description: '',
        enhanced_prompt: '',
        caption: '',
        characterNames: characters.map(c => c.name),
      } as any);
      imageGenerationStatus.unshift({
        id: `cover-${projectId}`,
        sceneId: `cover-${projectId}`,
        sceneNumber: 0,
        sceneDescription: fullProject.title || '',
        imageUrl: fullProject.coverImageUrl,
        prompt: '',
        generationTime: 0,
        status: 'completed',
      } as any);
    }

    // storyBible reconstruction. Use story_locations.id directly as temp_id — the save
    // path's persistStoryBible uses index-based mapping so the value just needs to be
    // consistent between locations[] and scenes[].location_temp_id (both point to
    // the same DB UUID here).
    let storyBible: any = null;
    if (storyLocations && storyLocations.length > 0) {
      const locations = storyLocations.map(loc => ({
        temp_id: loc.id,
        name: loc.name,
        description: loc.description,
        backing_character_name: loc.backing_character_id
          ? (characterIdToName.get(loc.backing_character_id) ?? null)
          : null,
        first_scene_index: loc.first_scene_index ?? 0,
        reference_image_url: loc.reference_image_url ?? null,
      }));

      const bibleScenes = scenesSorted.map(scene => ({
        sceneNumber: scene.sceneNumber,
        raw_description: scene.rawDescription || '',
        enhanced_prompt: scene.enhancedPrompt || '',
        caption: scene.caption || '',
        characterNames: namesForScene(scene),
        location_temp_id: scene.locationId ?? null,
        resolved_character_names: namesForScene(scene),
      }));

      storyBible = { locations, scenes: bibleScenes };
    }

    // Settings: pull from project columns where present, defaults for the rest.
    return {
      characters,
      enhancedScenes,
      imageGenerationStatus,
      storyBible,
      // Preserved from project columns
      storyTone: rawProject?.story_tone ?? undefined,
      contentLanguage: rawProject?.content_language ?? 'en',
      secondaryLanguage: fullProject.secondaryLanguage ?? null,
      // Defaults for fields not stored on completed projects
      clothingConsistency: 'consistent',
      expansionLevel: 'as_written',
      artStyle: 'pixar',
      // imageProvider intentionally omitted here so the create page falls back to its own default
      selectedTemplate: null,
      authorName: fullProject.authorName,
      authorAge: fullProject.authorAge,
      // Marker for debugging — lets us tell rebuilt drafts from real ones during incident response.
      _rebuiltFromCompleted: true,
      _rebuiltAt: new Date().toISOString(),
    };
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    const supabase = this.projectRepo['supabase'];

    // Verify ownership
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    if (project.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }

    // Delete associated images from storage
    try {
      await this.storageService.deleteProjectImages(projectId);
    } catch (error) {
      console.error('Failed to delete project images:', error);
      // Continue with deletion even if storage cleanup fails
    }

    // Delete reading_sessions first (not cascaded)
    const { error: sessionError } = await supabase
      .from('reading_sessions')
      .delete()
      .eq('project_id', projectId);

    if (sessionError) {
      console.error('Failed to delete reading sessions:', sessionError);
      // Continue with deletion
    }

    // Delete project (cascades to scenes, images, etc.)
    await this.projectRepo.delete(projectId);
  }

  /**
   * Get project statistics
   */
  async getProjectStats(userId: string): Promise<{
    total: number;
    drafts: number;
    processing: number;
    completed: number;
    errors: number;
  }> {
    const [total, drafts, processing, completed, errors] = await Promise.all([
      this.projectRepo.countByStatus(userId),
      this.projectRepo.countByStatus(userId, 'draft'),
      this.projectRepo.countByStatus(userId, 'processing'),
      this.projectRepo.countByStatus(userId, 'completed'),
      this.projectRepo.countByStatus(userId, 'error'),
    ]);

    return { total, drafts, processing, completed, errors };
  }

  /**
   * Save or update a draft story
   * Stores structured data in scenes/images tables and UI state in draft_metadata JSONB
   */
  async saveDraft(
    userId: string,
    data: {
      projectId?: string; // If provided, update existing draft
      title?: string;
      description?: string;
      authorName?: string;
      authorAge?: number;
      coverImageUrl?: string;
      originalScript?: string;
      readingLevel?: number;
      storyTone?: string;
      language?: 'en' | 'zh';
      secondaryLanguage?: SecondaryLanguage | null;
      characterIds?: string[];
      scenes?: Array<{
        sceneNumber: number;
        description: string;
        raw_description?: string;
        enhanced_prompt?: string;
        caption?: string;
        caption_chinese?: string;
        caption_secondary?: string;
        imageUrl?: string | null;
        prompt?: string;
        generationTime?: number;
      }>;
      draftMetadata: Record<string, any>;
      storyBible?: StoryBibleResult | null;
    }
  ): Promise<{ projectId: string; project: ProjectDTO }> {
    const usesStoryBible = !!(data.storyBible && data.storyBible.scenes?.length);
    const supabase = this.projectRepo['supabase'];

    let projectId: string;

    // Shared INSERT payload for the two create paths (a brand-new draft, or the
    // first save of a client-generated id). The UPDATE path is handled inline
    // below because it preserves a few existing-row values.
    const buildCreateData = (id?: string) => ({
      ...(id ? { id } : {}),
      user_id: userId,
      title: data.title || 'Untitled Draft',
      description: data.description,
      author_name: data.authorName,
      author_age: data.authorAge,
      cover_image_url: data.coverImageUrl,
      original_script: data.originalScript,
      reading_level: data.readingLevel,
      story_tone: data.storyTone,
      content_language: data.language || 'en',
      secondary_language: data.secondaryLanguage || null,
      visibility: 'private', // Drafts always private
      status: 'draft',
      draft_metadata: data.draftMetadata,
      uses_story_bible: usesStoryBible,
    });

    if (data.projectId) {
      const existing = await this.projectRepo.findById(data.projectId);

      if (existing) {
        // Update existing draft.
        if (existing.user_id !== userId) throw new Error('Unauthorized: Draft does not belong to you');
        if (existing.status !== 'draft') throw new Error('Cannot update a non-draft project');

        await this.projectRepo.update(data.projectId, {
          title: data.title || existing.title,
          description: data.description,
          author_name: data.authorName,
          author_age: data.authorAge,
          cover_image_url: data.coverImageUrl,
          original_script: data.originalScript,
          reading_level: data.readingLevel,
          story_tone: data.storyTone,
          content_language: data.language || 'en',
          secondary_language: data.secondaryLanguage ?? existing.secondary_language,
          visibility: 'private', // Drafts always private
          draft_metadata: data.draftMetadata,
          // Only flip the bible flag ON when fresh bible data is supplied; preserve existing value otherwise.
          ...(usesStoryBible ? { uses_story_bible: true } : {}),
        } as any);

        projectId = data.projectId;

        // Delete existing scenes (cascade deletes images) for clean recreate
        await supabase.from('scenes').delete().eq('project_id', projectId);

        // Delete existing character links for clean recreate
        await supabase.from('project_characters').delete().eq('project_id', projectId);

        // Clean recreate of story_locations when bible data is being resubmitted
        if (usesStoryBible) {
          await this.storyLocationRepo.deleteByProjectId(projectId);
        }
      } else {
        // First save of a client-generated id → insert WITH that id. A retry or
        // the next save will then find it and take the update path, so a draft
        // can never 404. (NLW-1)
        const project = await this.projectRepo.create(buildCreateData(data.projectId) as any);
        projectId = project.id;
      }
    } else {
      // Legacy path: no id supplied — let the DB mint one.
      const project = await this.projectRepo.create(buildCreateData() as any);
      projectId = project.id;
    }

    // Link characters if provided
    if (data.characterIds && data.characterIds.length > 0) {
      await this.linkCharactersToProject(projectId, data.characterIds);
    }

    // Persist story bible (locations) BEFORE the scene loop so each scene row can
    // be written with its resolved location_id + resolved_character_ids in one insert.
    let bibleMaps: Awaited<ReturnType<typeof this.persistStoryBible>> | null = null;
    if (usesStoryBible && data.storyBible && data.characterIds && data.characterIds.length > 0) {
      try {
        bibleMaps = await this.persistStoryBible(projectId, data.storyBible, data.characterIds);
      } catch (bibleErr) {
        // Non-fatal: log and continue with legacy scene writes. Story still saves.
        console.error('[saveDraft] Failed to persist story bible, continuing without:', bibleErr);
        bibleMaps = null;
      }
    }

    // Save scenes + images if provided
    if (data.scenes && data.scenes.length > 0) {
      // Determine secondary language for dual-write logic
      const secLang = data.secondaryLanguage || null;

      for (const sceneData of data.scenes) {
        // Resolve the secondary caption: prefer explicit caption_secondary, fall back to caption_chinese
        const secondaryCaption = sceneData.caption_secondary || sceneData.caption_chinese || null;

        const bibleFields = bibleMaps
          ? this.resolveSceneBibleFields(sceneData.sceneNumber, bibleMaps)
          : {};

        const { data: scene, error: sceneError } = await supabase
          .from('scenes')
          .insert({
            project_id: projectId,
            scene_number: sceneData.sceneNumber,
            description: sceneData.description,
            raw_description: sceneData.raw_description,
            enhanced_prompt: sceneData.enhanced_prompt,
            caption: sceneData.caption,
            // Always write to generic column
            caption_secondary: secondaryCaption,
            // Dual-write to legacy Chinese column when language is 'zh' (backward compat for mobile app)
            caption_chinese: secLang === 'zh' ? secondaryCaption : (sceneData.caption_chinese || null),
            character_ids: data.characterIds || [],
            ...bibleFields,
          })
          .select()
          .single();

        if (sceneError) {
          console.error(`Failed to save draft scene ${sceneData.sceneNumber}:`, sceneError);
          continue; // Don't fail entire draft save for one scene
        }

        // Save generated image if scene has one
        if (sceneData.imageUrl) {
          const { error: imageError } = await supabase
            .from('generated_images')
            .insert({
              scene_id: scene.id,
              project_id: projectId,
              image_url: sceneData.imageUrl,
              prompt: sceneData.prompt || '',
              generation_time: sceneData.generationTime || 0,
              status: 'completed',
            });

          if (imageError) {
            console.error(`Failed to save draft image for scene ${sceneData.sceneNumber}:`, imageError);
          }
        }
      }
    }

    // Fetch the updated project
    const updatedProject = await this.projectRepo.findById(projectId);
    if (!updatedProject) throw new Error('Failed to fetch saved draft');

    return { projectId, project: projectToDTO(updatedProject) };
  }

  /**
   * Save a completed story with all scenes and generated images
   * This is called after image generation is complete
   *
   * If projectId is provided, transitions an existing draft to completed status.
   * Otherwise creates a new completed project.
   */
  async saveCompletedStory(
    userId: string,
    data: {
      projectId?: string; // Optional: draft→completed transition
      title: string;
      description?: string;
      authorName?: string;
      authorAge?: number;
      coverImageUrl?: string;
      originalScript: string;
      readingLevel?: number;
      storyTone?: string;
      visibility?: 'private' | 'public';
      language?: 'en' | 'zh';
      secondaryLanguage?: SecondaryLanguage | null;
      characterIds: string[];
      scenes: Array<{
        sceneNumber: number;
        description: string;
        raw_description?: string;
        enhanced_prompt?: string;
        caption?: string;
        caption_chinese?: string;
        caption_secondary?: string;
        imageUrl: string | null;
        prompt: string;
        generationTime: number;
      }>;
      quizData?: Array<{
        question: string;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        correct_answer: string;
        explanation?: string;
      }>;
      storyBible?: StoryBibleResult | null;
    }
  ): Promise<ProjectDTO> {
    const supabase = this.projectRepo['supabase'];
    const usesStoryBible = !!(data.storyBible && data.storyBible.scenes?.length);

    let project: Project;

    if (data.projectId) {
      // Draft → completed transition
      const existing = await this.projectRepo.findById(data.projectId);
      if (!existing) throw new Error('Draft project not found');
      if (existing.user_id !== userId) throw new Error('Unauthorized: Project does not belong to you');
      if (existing.status !== 'draft') throw new Error('Project is not a draft');

      // Delete existing scenes (cascade deletes images) for clean recreate
      await supabase.from('scenes').delete().eq('project_id', data.projectId);
      // Delete existing quiz questions for clean recreate
      await supabase.from('quiz_questions').delete().eq('project_id', data.projectId);
      // Delete existing character links for clean recreate
      await supabase.from('project_characters').delete().eq('project_id', data.projectId);

      // Clean recreate of story_locations when bible data is being resubmitted
      if (usesStoryBible) {
        await this.storyLocationRepo.deleteByProjectId(data.projectId);
      }

      // Update project to completed, clear draft_metadata
      project = await this.projectRepo.update(data.projectId, {
        title: data.title,
        description: data.description,
        author_name: data.authorName,
        author_age: data.authorAge,
        cover_image_url: data.coverImageUrl,
        original_script: data.originalScript,
        reading_level: data.readingLevel,
        story_tone: data.storyTone,
        visibility: data.visibility || 'private',
        content_language: data.language || 'en',
        secondary_language: data.secondaryLanguage ?? existing.secondary_language,
        status: 'completed',
        draft_metadata: null, // Clear draft state
        ...(usesStoryBible ? { uses_story_bible: true } : {}),
      } as any);
    } else {
      // Create new completed project (existing behavior)
      project = await this.projectRepo.create({
        user_id: userId,
        title: data.title,
        description: data.description,
        author_name: data.authorName,
        author_age: data.authorAge,
        cover_image_url: data.coverImageUrl,
        original_script: data.originalScript,
        reading_level: data.readingLevel,
        story_tone: data.storyTone,
        visibility: data.visibility || 'private',
        content_language: data.language || 'en',
        secondary_language: data.secondaryLanguage || null,
        status: 'completed',
        uses_story_bible: usesStoryBible,
      } as any);
    }

    // 2. Link characters to project
    await this.linkCharactersToProject(project.id, data.characterIds);

    // 3. Increment character usage counts
    for (const charId of data.characterIds) {
      await this.characterRepo.incrementUsageCount(charId);
    }

    // Persist story bible (locations) BEFORE the scene loop
    let bibleMaps: Awaited<ReturnType<typeof this.persistStoryBible>> | null = null;
    if (usesStoryBible && data.storyBible && data.characterIds.length > 0) {
      try {
        bibleMaps = await this.persistStoryBible(project.id, data.storyBible, data.characterIds);
      } catch (bibleErr) {
        console.error('[saveCompletedStory] Failed to persist story bible, continuing without:', bibleErr);
        bibleMaps = null;
      }
    }

    // 4. Save scenes with images
    // Determine secondary language for dual-write logic
    const secLang = data.secondaryLanguage || null;

    for (const sceneData of data.scenes) {
      // Resolve the secondary caption: prefer explicit caption_secondary, fall back to caption_chinese
      const secondaryCaption = sceneData.caption_secondary || sceneData.caption_chinese || null;

      const bibleFields = bibleMaps
        ? this.resolveSceneBibleFields(sceneData.sceneNumber, bibleMaps)
        : {};

      const { data: scene, error: sceneError } = await supabase
        .from('scenes')
        .insert({
          project_id: project.id,
          scene_number: sceneData.sceneNumber,
          description: sceneData.description,
          raw_description: sceneData.raw_description,
          enhanced_prompt: sceneData.enhanced_prompt,
          caption: sceneData.caption,
          // Always write to generic column
          caption_secondary: secondaryCaption,
          // Dual-write to legacy Chinese column when language is 'zh' (backward compat for mobile app)
          caption_chinese: secLang === 'zh' ? secondaryCaption : (sceneData.caption_chinese || null),
          character_ids: data.characterIds,
          ...bibleFields,
        })
        .select()
        .single();

      if (sceneError) {
        throw new Error(`Failed to save scene ${sceneData.sceneNumber}: ${sceneError.message}`);
      }

      // Save generated image (only if scene has an image)
      if (sceneData.imageUrl) {
        const { error: imageError } = await supabase
          .from('generated_images')
          .insert({
            scene_id: scene.id,
            project_id: project.id,
            image_url: sceneData.imageUrl,
            prompt: sceneData.prompt,
            generation_time: sceneData.generationTime,
            status: 'completed',
          });

        if (imageError) {
          throw new Error(`Failed to save image for scene ${sceneData.sceneNumber}: ${imageError.message}`);
        }
      }
    }

    // 5. Save quiz questions if provided
    if (data.quizData && data.quizData.length > 0) {
      console.log(`Saving ${data.quizData.length} quiz questions for project ${project.id}...`);

      for (let i = 0; i < data.quizData.length; i++) {
        const question = data.quizData[i];
        const { error: quizError } = await supabase
          .from('quiz_questions')
          .insert({
            project_id: project.id,
            question_order: i + 1,
            question: question.question,
            option_a: question.option_a,
            option_b: question.option_b,
            option_c: question.option_c,
            option_d: question.option_d,
            correct_answer: question.correct_answer,
            explanation: question.explanation,
          });

        if (quizError) {
          console.error(`Failed to save quiz question ${i + 1}:`, quizError);
          throw new Error(`Failed to save quiz question ${i + 1}: ${quizError.message}`);
        }
      }

      console.log(`Successfully saved ${data.quizData.length} quiz questions`);
    }

    return projectToDTO(project);
  }
}
