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
  SceneDTO,
} from '../domain/dtos';
import {
  projectToDTO,
  projectWithCharactersToDTO,
  projectWithScenesToDTO,
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
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<ProjectWithScenesDTO[]> {
    const projects = await this.projectRepo.findByUserIdWithScenes(userId);
    return projects.map(projectWithScenesToDTO);
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
}
