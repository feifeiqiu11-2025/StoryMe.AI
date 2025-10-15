/**
 * Scene Repository
 * Data access layer for scenes table
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';
import type { Scene, SceneWithImages } from '../domain/models';

export class SceneRepository extends BaseRepository<Scene> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'scenes');
  }

  /**
   * Find all scenes for a project
   */
  async findByProjectId(projectId: string): Promise<Scene[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true });

    if (error) throw error;

    return (data || []) as Scene[];
  }

  /**
   * Find scenes with images for a project
   */
  async findByProjectIdWithImages(projectId: string): Promise<SceneWithImages[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        images:generated_images (*)
      `)
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true });

    if (error) throw error;

    return (data || []) as SceneWithImages[];
  }

  /**
   * Create multiple scenes for a project
   */
  async createBatch(projectId: string, scenes: Partial<Scene>[]): Promise<Scene[]> {
    const scenesWithProjectId = scenes.map(scene => ({
      ...scene,
      project_id: projectId,
    }));

    return this.createMany(scenesWithProjectId);
  }

  /**
   * Update scene by scene number
   */
  async updateBySceneNumber(
    projectId: string,
    sceneNumber: number,
    updates: Partial<Scene>
  ): Promise<Scene> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updates)
      .eq('project_id', projectId)
      .eq('scene_number', sceneNumber)
      .select()
      .single();

    if (error) throw error;

    return data as Scene;
  }

  /**
   * Delete all scenes for a project
   */
  async deleteByProjectId(projectId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('project_id', projectId);

    if (error) throw error;
  }

  /**
   * Get scene count for a project
   */
  async countByProjectId(projectId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) throw error;

    return count || 0;
  }

  /**
   * Find scene by project ID and scene number
   */
  async findBySceneNumber(projectId: string, sceneNumber: number): Promise<Scene | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('project_id', projectId)
      .eq('scene_number', sceneNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as Scene;
  }
}
