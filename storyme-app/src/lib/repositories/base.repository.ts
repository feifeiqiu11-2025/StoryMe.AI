/**
 * Base Repository
 * Provides common CRUD operations for all repositories
 */

import { SupabaseClient } from '@supabase/supabase-js';

export class BaseRepository<T> {
  constructor(
    protected supabase: SupabaseClient,
    protected tableName: string
  ) {}

  /**
   * Find record by ID
   */
  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    return data as T;
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(filters?: Record<string, unknown>): Promise<T[]> {
    let query = this.supabase.from(this.tableName).select('*');

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as T[];
  }

  /**
   * Find records by user ID
   */
  async findByUserId(userId: string): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []) as T[];
  }

  /**
   * Create a new record
   */
  async create(record: Partial<T>): Promise<T> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    return data as T;
  }

  /**
   * Create multiple records
   */
  async createMany(records: Partial<T>[]): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(records)
      .select();

    if (error) throw error;

    return (data || []) as T[];
  }

  /**
   * Update a record
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data as T;
  }

  /**
   * Delete a record
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Delete records by user ID
   */
  async deleteByUserId(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Count records
   */
  async count(filters?: Record<string, unknown>): Promise<number> {
    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id);
    return record !== null;
  }
}
