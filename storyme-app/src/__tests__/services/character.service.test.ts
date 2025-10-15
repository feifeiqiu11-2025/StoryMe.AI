/**
 * Character Service Tests
 * Tests for character CRUD operations
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CharacterRepository } from '@/lib/repositories/character.repository';
import { createMockSupabaseClient, testData, expectToThrow } from '../utils/test-helpers';
import type { CharacterLibrary } from '@/lib/domain/models';

describe('Character Service', () => {
  let characterRepo: CharacterRepository;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    characterRepo = new CharacterRepository(mockSupabase);
    jest.clearAllMocks();
  });

  describe('Create Character', () => {
    it('should successfully create a new character', async () => {
      const newCharacter: Partial<CharacterLibrary> = {
        user_id: 'test-user-id',
        name: 'Connor',
        hair_color: 'brown',
        skin_tone: 'light',
        age: '4',
        clothing: 'blue shirt',
        reference_image_url: 'https://test.supabase.co/storage/character.png',
        reference_image_filename: 'connor.png',
      };

      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'char-1', ...newCharacter, created_at: new Date().toISOString() },
            error: null,
          }),
        })),
      }));

      const created = await characterRepo.create(newCharacter);

      expect(created).toBeDefined();
      expect(created.name).toBe('Connor');
      expect(created.hair_color).toBe('brown');
      expect(created.user_id).toBe('test-user-id');
    });

    it('should create character with minimum required fields', async () => {
      const minimalCharacter: Partial<CharacterLibrary> = {
        user_id: 'test-user-id',
        name: 'Emma',
      };

      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'char-2',
              ...minimalCharacter,
              is_favorite: false,
              usage_count: 0,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        })),
      }));

      const created = await characterRepo.create(minimalCharacter);

      expect(created).toBeDefined();
      expect(created.name).toBe('Emma');
      expect(created.is_favorite).toBe(false);
      expect(created.usage_count).toBe(0);
    });

    it('should fail to create character without required fields', async () => {
      const invalidCharacter: Partial<CharacterLibrary> = {
        // Missing user_id and name
        hair_color: 'blonde',
      };

      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Missing required fields' },
          }),
        })),
      }));

      await expectToThrow(
        async () => await characterRepo.create(invalidCharacter),
        'Missing required fields'
      );
    });
  });

  describe('Read Characters', () => {
    it('should get character by ID', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: testData.character,
          error: null,
        }),
      }));

      const character = await characterRepo.findById('char-1');

      expect(character).toBeDefined();
      expect(character?.id).toBe('char-1');
      expect(character?.name).toBe('Connor');
    });

    it('should return null for non-existent character', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // Not found error code
        }),
      }));

      const character = await characterRepo.findById('non-existent-id');

      expect(character).toBeNull();
    });

    it('should get all characters for a user', async () => {
      const userCharacters = [
        { ...testData.character, id: 'char-1', name: 'Connor' },
        { ...testData.character, id: 'char-2', name: 'Emma' },
        { ...testData.character, id: 'char-3', name: 'Oliver' },
      ];

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: userCharacters,
          error: null,
        }),
      }));

      const characters = await characterRepo.findByUserId('test-user-id');

      expect(characters).toHaveLength(3);
      expect(characters[0].name).toBe('Connor');
      expect(characters[1].name).toBe('Emma');
      expect(characters[2].name).toBe('Oliver');
    });

    it('should filter favorite characters', async () => {
      const favoriteCharacters = [
        { ...testData.character, id: 'char-1', is_favorite: true },
        { ...testData.character, id: 'char-2', is_favorite: true },
      ];

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: favoriteCharacters,
          error: null,
        }),
      }));

      const characters = await characterRepo.findByUserIdWithFilters('test-user-id', {
        favoriteOnly: true,
      });

      expect(characters).toHaveLength(2);
      expect(characters.every(c => c.is_favorite)).toBe(true);
    });

    it('should search characters by name', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [{ ...testData.character, name: 'Connor' }],
          error: null,
        }),
      }));

      const characters = await characterRepo.findByUserIdWithFilters('test-user-id', {
        searchTerm: 'Con',
      });

      expect(characters).toHaveLength(1);
      expect(characters[0].name).toContain('Connor');
    });
  });

  describe('Update Character', () => {
    it('should update character fields', async () => {
      const updates: Partial<CharacterLibrary> = {
        name: 'Connor Updated',
        hair_color: 'dark brown',
        age: '5',
      };

      mockSupabase.from = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...testData.character, ...updates, updated_at: new Date().toISOString() },
            error: null,
          }),
        })),
      }));

      const updated = await characterRepo.update('char-1', updates);

      expect(updated.name).toBe('Connor Updated');
      expect(updated.hair_color).toBe('dark brown');
      expect(updated.age).toBe('5');
    });

    it('should toggle favorite status', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...testData.character, is_favorite: false },
          error: null,
        }),
        update: jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...testData.character, is_favorite: true },
            error: null,
          }),
        })),
      }));

      const updated = await characterRepo.toggleFavorite('char-1');

      expect(updated.is_favorite).toBe(true);
    });

    it('should increment usage count', async () => {
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      await characterRepo.incrementUsageCount('char-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_character_usage', {
        character_id: 'char-1',
      });
    });

    it('should update reference image', async () => {
      const newImageUrl = 'https://test.supabase.co/storage/new-image.png';
      const newFilename = 'new-image.png';

      mockSupabase.from = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              ...testData.character,
              reference_image_url: newImageUrl,
              reference_image_filename: newFilename,
            },
            error: null,
          }),
        })),
      }));

      const updated = await characterRepo.updateReferenceImage('char-1', newImageUrl, newFilename);

      expect(updated.reference_image_url).toBe(newImageUrl);
      expect(updated.reference_image_filename).toBe(newFilename);
    });
  });

  describe('Delete Character', () => {
    it('should successfully delete a character', async () => {
      mockSupabase.from = jest.fn(() => ({
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        })),
      }));

      await characterRepo.delete('char-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('character_library');
    });

    it('should handle deletion of non-existent character', async () => {
      mockSupabase.from = jest.fn(() => ({
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Character not found' },
          }),
        })),
      }));

      await expectToThrow(
        async () => await characterRepo.delete('non-existent-id'),
        'Character not found'
      );
    });
  });

  describe('Character Usage Analytics', () => {
    it('should get most used characters', async () => {
      const mostUsed = [
        { ...testData.character, id: 'char-1', usage_count: 10 },
        { ...testData.character, id: 'char-2', usage_count: 7 },
        { ...testData.character, id: 'char-3', usage_count: 5 },
      ];

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mostUsed,
          error: null,
        }),
      }));

      const characters = await characterRepo.findMostUsed('test-user-id', 3);

      expect(characters).toHaveLength(3);
      expect(characters[0].usage_count).toBe(10);
      expect(characters[2].usage_count).toBe(5);
    });
  });
});
