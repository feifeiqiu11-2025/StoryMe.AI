/**
 * Story Location Repository
 * Data access layer for the story_locations table (story bible).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';
import type { StoryLocation } from '../domain/models';

export class StoryLocationRepository extends BaseRepository<StoryLocation> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'story_locations');
  }

  async findByProjectId(projectId: string): Promise<StoryLocation[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('first_scene_index', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return (data || []) as StoryLocation[];
  }

  async createBatch(
    projectId: string,
    locations: Array<Omit<StoryLocation, 'id' | 'project_id' | 'created_at' | 'updated_at' | 'deleted_at'>>
  ): Promise<StoryLocation[]> {
    if (locations.length === 0) return [];

    const rows = locations.map(loc => ({ ...loc, project_id: projectId }));

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(rows)
      .select();

    if (error) throw error;

    return (data || []) as StoryLocation[];
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('project_id', projectId);

    if (error) throw error;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }
}
