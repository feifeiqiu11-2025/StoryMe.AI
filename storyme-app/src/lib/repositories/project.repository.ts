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
   * Find single project by ID with ALL scenes and images (DETAIL VIEW)
   *
   * Use this for project detail page where full data is needed.
   * For list view, use findByUserIdWithScenes() which is optimized.
   */
  async findByIdWithScenes(id: string): Promise<ProjectWithScenes | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        scenes (
          *,
          images:generated_images (*)
        ),
        project_tags (
          tag_id,
          story_tags (
            id,
            name,
            slug,
            icon,
            display_order
          )
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
   * Find all projects by user for LIST VIEW (with pagination)
   *
   * OPTIMIZATION: This query is intentionally lightweight for the /projects list page:
   * - Only fetches essential fields (not all columns)
   * - Only fetches first 2 scenes (for cover image preview)
   * - Only fetches first image per scene (thumbnail)
   *
   * For full project data (detail page), use findByIdWithScenes() instead.
   */
  async findByUserIdWithScenes(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ projects: ProjectWithScenes[]; total: number }> {
    // First, get total count for pagination (fast query with no data)
    const { count, error: countError } = await this.supabase
      .from(this.tableName)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw countError;

    // Optimized query for list view:
    // - Only fetch essential project fields
    // - Only fetch first 2 scenes (for cover image preview)
    // - Only fetch first image per scene (thumbnail)
    // - Limit tags to avoid bloat
    let query = this.supabase
      .from(this.tableName)
      .select(`
        id,
        user_id,
        title,
        description,
        cover_image_url,
        status,
        visibility,
        featured,
        view_count,
        created_at,
        updated_at,
        scenes (
          id,
          scene_number,
          images:generated_images (
            id,
            image_url,
            thumbnail_url
          )
        ),
        project_tags (
          tag_id,
          story_tags (
            id,
            name,
            slug,
            icon
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply pagination if provided
    if (options?.limit !== undefined && options?.offset !== undefined) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    } else if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Post-process: limit scenes to first 2 for list view (cover image)
    const processedData = (data || []).map(project => ({
      ...project,
      scenes: (project.scenes || [])
        .sort((a: any, b: any) => a.scene_number - b.scene_number)
        .slice(0, 2) // Only keep first 2 scenes for cover
        .map((scene: any) => ({
          ...scene,
          images: (scene.images || []).slice(0, 1) // Only first image per scene
        }))
    }));

    return {
      projects: processedData as ProjectWithScenes[],
      total: count || 0,
    };
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

  /**
   * Find all projects with scenes (for public gallery)
   */
  async findAllWithScenes(): Promise<ProjectWithScenes[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        scenes (
          *,
          images:generated_images (*)
        )
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map images back to generated_images for proper typing
    const mapped = (data || []).map(project => ({
      ...project,
      scenes: project.scenes?.map((scene: any) => ({
        ...scene,
        generated_images: scene.images || [],
      })),
    }));

    return mapped as ProjectWithScenes[];
  }

  /**
   * Find public projects with scenes (for landing page)
   * Only returns projects with visibility = 'public'
   */
  async findPublicWithScenes(): Promise<ProjectWithScenes[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        scenes (
          *,
          images:generated_images (*)
        )
      `)
      .eq('status', 'completed')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map images back to generated_images for proper typing
    const mapped = (data || []).map(project => ({
      ...project,
      scenes: project.scenes?.map((scene: any) => ({
        ...scene,
        generated_images: scene.images || [],
      })),
    }));

    return mapped as ProjectWithScenes[];
  }
}
