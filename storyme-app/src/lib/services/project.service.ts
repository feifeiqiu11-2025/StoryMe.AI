/**
 * Project Service
 * Business logic for story project management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectRepository } from '../repositories/project.repository';
import { SceneRepository } from '../repositories/scene.repository';
import { CharacterRepository } from '../repositories/character.repository';
import { StorageService } from './storage.service';
import type { Project, ProjectCharacter, Scene } from '../domain/models';
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
  private storageService: StorageService;

  constructor(supabase: SupabaseClient) {
    this.projectRepo = new ProjectRepository(supabase);
    this.sceneRepo = new SceneRepository(supabase);
    this.characterRepo = new CharacterRepository(supabase);
    this.storageService = new StorageService(supabase);
  }

  /**
   * Create a new story project
   */
  async createProject(userId: string, data: CreateProjectDTO): Promise<ProjectDTO> {
    // Validate input
    if (!data.originalScript || data.originalScript.trim().length < 10) {
      throw new Error('Script must be at least 10 characters long');
    }

    if (!data.characterIds || data.characterIds.length === 0) {
      throw new Error('At least one character is required');
    }

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
      characterIds?: string[];
      scenes?: Array<{
        sceneNumber: number;
        description: string;
        raw_description?: string;
        enhanced_prompt?: string;
        caption?: string;
        caption_chinese?: string;
        imageUrl?: string | null;
        prompt?: string;
        generationTime?: number;
      }>;
      draftMetadata: Record<string, any>;
    }
  ): Promise<{ projectId: string; project: ProjectDTO }> {
    const supabase = this.projectRepo['supabase'];

    let projectId: string;

    if (data.projectId) {
      // Update existing draft
      const existing = await this.projectRepo.findById(data.projectId);
      if (!existing) throw new Error('Draft not found');
      if (existing.user_id !== userId) throw new Error('Unauthorized: Draft does not belong to you');
      if (existing.status !== 'draft') throw new Error('Cannot update a non-draft project');

      // Update project fields
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
        visibility: 'private', // Drafts always private
        draft_metadata: data.draftMetadata,
      } as any);

      projectId = data.projectId;

      // Delete existing scenes (cascade deletes images) for clean recreate
      await supabase.from('scenes').delete().eq('project_id', projectId);

      // Delete existing character links for clean recreate
      await supabase.from('project_characters').delete().eq('project_id', projectId);

    } else {
      // Create new draft project
      const project = await this.projectRepo.create({
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
        visibility: 'private', // Drafts always private
        status: 'draft',
        draft_metadata: data.draftMetadata,
      } as any);

      projectId = project.id;
    }

    // Link characters if provided
    if (data.characterIds && data.characterIds.length > 0) {
      await this.linkCharactersToProject(projectId, data.characterIds);
    }

    // Save scenes + images if provided
    if (data.scenes && data.scenes.length > 0) {
      for (const sceneData of data.scenes) {
        const { data: scene, error: sceneError } = await supabase
          .from('scenes')
          .insert({
            project_id: projectId,
            scene_number: sceneData.sceneNumber,
            description: sceneData.description,
            raw_description: sceneData.raw_description,
            enhanced_prompt: sceneData.enhanced_prompt,
            caption: sceneData.caption,
            caption_chinese: sceneData.caption_chinese,
            character_ids: data.characterIds || [],
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
      characterIds: string[];
      scenes: Array<{
        sceneNumber: number;
        description: string;
        raw_description?: string;
        enhanced_prompt?: string;
        caption?: string;
        caption_chinese?: string;
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
    }
  ): Promise<ProjectDTO> {
    const supabase = this.projectRepo['supabase'];

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
        status: 'completed',
        draft_metadata: null, // Clear draft state
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
        status: 'completed',
      } as any);
    }

    // 2. Link characters to project
    await this.linkCharactersToProject(project.id, data.characterIds);

    // 3. Increment character usage counts
    for (const charId of data.characterIds) {
      await this.characterRepo.incrementUsageCount(charId);
    }

    // 4. Save scenes with images
    for (const sceneData of data.scenes) {
      const { data: scene, error: sceneError } = await supabase
        .from('scenes')
        .insert({
          project_id: project.id,
          scene_number: sceneData.sceneNumber,
          description: sceneData.description,
          raw_description: sceneData.raw_description,
          enhanced_prompt: sceneData.enhanced_prompt,
          caption: sceneData.caption,
          caption_chinese: sceneData.caption_chinese,
          character_ids: data.characterIds,
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
