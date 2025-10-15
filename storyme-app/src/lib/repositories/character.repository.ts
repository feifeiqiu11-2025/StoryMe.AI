/**
 * Character Repository
 * Data access layer for character_library table
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository';
import type { CharacterLibrary } from '../domain/models';

export class CharacterRepository extends BaseRepository<CharacterLibrary> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'character_library');
  }

  /**
   * Find characters by user ID with optional filters
   */
  async findByUserIdWithFilters(
    userId: string,
    options?: {
      favoriteOnly?: boolean;
      searchTerm?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<CharacterLibrary[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId);

    if (options?.favoriteOnly) {
      query = query.eq('is_favorite', true);
    }

    if (options?.searchTerm) {
      query = query.ilike('name', `%${options.searchTerm}%`);
    }

    query = query.order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as CharacterLibrary[];
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string): Promise<CharacterLibrary> {
    const character = await this.findById(id);
    if (!character) {
      throw new Error('Character not found');
    }

    return this.update(id, { is_favorite: !character.is_favorite } as Partial<CharacterLibrary>);
  }

  /**
   * Increment usage count
   */
  async incrementUsageCount(id: string): Promise<void> {
    const { error } = await this.supabase.rpc('increment_character_usage', {
      character_id: id,
    });

    if (error) {
      // Fallback if RPC doesn't exist
      const character = await this.findById(id);
      if (character) {
        await this.update(id, {
          usage_count: (character.usage_count || 0) + 1,
        } as Partial<CharacterLibrary>);
      }
    }
  }

  /**
   * Find most used characters
   */
  async findMostUsed(userId: string, limit: number = 5): Promise<CharacterLibrary[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []) as CharacterLibrary[];
  }

  /**
   * Update reference image
   */
  async updateReferenceImage(
    id: string,
    imageUrl: string,
    imageFilename: string
  ): Promise<CharacterLibrary> {
    return this.update(id, {
      reference_image_url: imageUrl,
      reference_image_filename: imageFilename,
    } as Partial<CharacterLibrary>);
  }
}
