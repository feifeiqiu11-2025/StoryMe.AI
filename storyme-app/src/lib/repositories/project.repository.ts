/**
 * Project Repository
 * Data access layer for projects table
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';
import type { Project, ProjectWithCharacters, ProjectWithScenes, ProjectFull } from '../domain/models';

export class ProjectRepository extends BaseRepository<Project> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'projects');
  }

  /**
   * Find project by ID with characters
   */
  async findByIdWithCharacters(id: string): Promise<ProjectWithCharacters | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        characters:project_characters (
          id,
          project_id,
          character_library_id,
          is_primary,
          order_index,
          role,
          override_clothing,
          override_age,
          override_description,
          created_at,
          character:character_library (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as ProjectWithCharacters;
  }

  /**
   * Find project by ID with scenes and images
   */
  async findByIdWithScenes(id: string): Promise<ProjectWithScenes | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        scenes (
          *,
          images:generated_images (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as ProjectWithScenes;
  }

  /**
   * Find project by ID with all relations
   */
  async findByIdFull(id: string): Promise<ProjectFull | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        characters:project_characters (
          id,
          project_id,
          character_library_id,
          is_primary,
          order_index,
          role,
          override_clothing,
          override_age,
          override_description,
          created_at,
          character:character_library (*)
        ),
        scenes (
          *,
          images:generated_images (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as ProjectFull;
  }

  /**
   * Find all projects by user with scenes
   */
  async findByUserIdWithScenes(userId: string): Promise<ProjectWithScenes[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        scenes (
          *,
          images:generated_images (
            id,
            image_url,
            thumbnail_url,
            status
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []) as ProjectWithScenes[];
  }

  /**
   * Update project status
   */
  async updateStatus(
    id: string,
    status: 'draft' | 'processing' | 'completed' | 'error'
  ): Promise<Project> {
    return this.update(id, { status } as Partial<Project>);
  }

  /**
   * Find projects by status
   */
  async findByStatus(
    userId: string,
    status: 'draft' | 'processing' | 'completed' | 'error'
  ): Promise<Project[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []) as Project[];
  }

  /**
   * Count projects by user and status
   */
  async countByStatus(
    userId: string,
    status?: 'draft' | 'processing' | 'completed' | 'error'
  ): Promise<number> {
    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  }
}
