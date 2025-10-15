/**
 * Database queries for Character Library
 * All queries use Row Level Security (RLS) to ensure users only access their own data
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CharacterLibrary, CharacterLibraryInput } from '../types/database';

/**
 * Get all characters for the current user
 */
export async function getUserCharacters(
  supabase: SupabaseClient
): Promise<{ data: CharacterLibrary[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('character_library')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}

/**
 * Get a single character by ID
 */
export async function getCharacterById(
  supabase: SupabaseClient,
  characterId: string
): Promise<{ data: CharacterLibrary | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('character_library')
    .select('*')
    .eq('id', characterId)
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}

/**
 * Create a new character
 */
export async function createCharacter(
  supabase: SupabaseClient,
  userId: string,
  character: CharacterLibraryInput
): Promise<{ data: CharacterLibrary | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('character_library')
    .insert({
      user_id: userId,
      ...character,
      usage_count: 0,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}

/**
 * Update an existing character
 */
export async function updateCharacter(
  supabase: SupabaseClient,
  characterId: string,
  updates: Partial<CharacterLibraryInput>
): Promise<{ data: CharacterLibrary | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('character_library')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', characterId)
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}

/**
 * Delete a character
 */
export async function deleteCharacter(
  supabase: SupabaseClient,
  characterId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('character_library')
    .delete()
    .eq('id', characterId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Toggle favorite status for a character
 */
export async function toggleCharacterFavorite(
  supabase: SupabaseClient,
  characterId: string,
  isFavorite: boolean
): Promise<{ data: CharacterLibrary | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('character_library')
    .update({ is_favorite: isFavorite })
    .eq('id', characterId)
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}

/**
 * Search characters by name
 */
export async function searchCharacters(
  supabase: SupabaseClient,
  searchTerm: string
): Promise<{ data: CharacterLibrary[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('character_library')
    .select('*')
    .ilike('name', `%${searchTerm}%`)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}

/**
 * Get favorite characters for the current user
 */
export async function getFavoriteCharacters(
  supabase: SupabaseClient
): Promise<{ data: CharacterLibrary[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('character_library')
    .select('*')
    .eq('is_favorite', true)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}
