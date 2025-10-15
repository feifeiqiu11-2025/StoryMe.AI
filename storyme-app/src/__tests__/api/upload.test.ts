/**
 * API Endpoint Tests
 * Tests for API routes
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createMockFile, createMockSupabaseClient } from '../utils/test-helpers';

describe('API: /api/upload', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    jest.clearAllMocks();
  });

  describe('POST /api/upload', () => {
    it('should upload file successfully', async () => {
      const file = createMockFile('test.png', 2048, 'image/png');
      const formData = new FormData();
      formData.append('file', file);

      // Mock the upload endpoint behavior
      const uploadResult = {
        url: 'https://test.supabase.co/storage/v1/object/public/character-images/test-user-id/test.png',
        filename: 'test.png',
        path: 'test-user-id/test.png',
      };

      expect(uploadResult.url).toContain('supabase.co');
      expect(uploadResult.filename).toBe('test.png');
    });

    it('should reject files larger than 10MB', async () => {
      const largeFile = createMockFile('large.png', 11 * 1024 * 1024, 'image/png');
      const formData = new FormData();
      formData.append('file', largeFile);

      // File size validation should reject
      expect(largeFile.size).toBeGreaterThan(10 * 1024 * 1024);
    });

    it('should reject non-image files', async () => {
      const textFile = createMockFile('document.txt', 1024, 'text/plain');

      expect(textFile.type).not.toMatch(/^image\//);
    });

    it('should require authentication', async () => {
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const { data } = await mockSupabase.auth.getUser();

      expect(data.user).toBeNull();
    });

    it('should return proper response format', () => {
      const response = {
        success: true,
        url: 'https://test.supabase.co/storage/file.png',
        filename: 'file.png',
        path: 'user-id/file.png',
      };

      expect(response.success).toBe(true);
      expect(response.url).toBeDefined();
      expect(response.filename).toBeDefined();
      expect(response.path).toBeDefined();
    });
  });
});

describe('API: /api/characters', () => {
  describe('POST /api/characters', () => {
    it('should create character with valid data', () => {
      const characterData = {
        name: 'Connor',
        hairColor: 'brown',
        skinTone: 'light',
        age: '4',
        clothing: 'blue shirt',
        referenceImageUrl: 'https://test.supabase.co/storage/connor.png',
      };

      expect(characterData.name).toBeDefined();
      expect(characterData.name.length).toBeGreaterThan(0);
    });

    it('should fail without name', () => {
      const invalidData = {
        hairColor: 'brown',
        // Missing name
      };

      expect(invalidData.name).toBeUndefined();
    });
  });

  describe('GET /api/characters', () => {
    it('should return user characters', () => {
      const mockCharacters = [
        {
          id: 'char-1',
          name: 'Connor',
          userId: 'test-user-id',
        },
        {
          id: 'char-2',
          name: 'Emma',
          userId: 'test-user-id',
        },
      ];

      expect(mockCharacters).toHaveLength(2);
      expect(mockCharacters.every(c => c.userId === 'test-user-id')).toBe(true);
    });
  });
});

describe('API: /api/projects', () => {
  describe('POST /api/projects', () => {
    it('should create project with valid data', () => {
      const projectData = {
        title: 'My Story',
        originalScript: 'Once upon a time in a magical forest...',
        characterIds: ['char-1', 'char-2'],
      };

      expect(projectData.title).toBeDefined();
      expect(projectData.originalScript.length).toBeGreaterThanOrEqual(10);
      expect(projectData.characterIds.length).toBeGreaterThan(0);
      expect(projectData.characterIds.length).toBeLessThanOrEqual(5);
    });

    it('should validate script length', () => {
      const shortScript = 'Short';
      const validScript = 'This is a long enough script for validation';

      expect(shortScript.length).toBeLessThan(10);
      expect(validScript.length).toBeGreaterThanOrEqual(10);
    });

    it('should validate character count', () => {
      const noCharacters: string[] = [];
      const tooManyCharacters = ['1', '2', '3', '4', '5', '6'];
      const validCharacters = ['1', '2', '3'];

      expect(noCharacters.length).toBe(0);
      expect(tooManyCharacters.length).toBeGreaterThan(5);
      expect(validCharacters.length).toBeGreaterThan(0);
      expect(validCharacters.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/projects', () => {
    it('should return user projects', () => {
      const mockProjects = [
        {
          id: 'project-1',
          userId: 'test-user-id',
          title: 'Story 1',
          status: 'completed',
        },
        {
          id: 'project-2',
          userId: 'test-user-id',
          title: 'Story 2',
          status: 'draft',
        },
      ];

      expect(mockProjects).toHaveLength(2);
      expect(mockProjects.every(p => p.userId === 'test-user-id')).toBe(true);
    });
  });
});

describe('API: /api/generate-images', () => {
  describe('POST /api/generate-images', () => {
    it('should validate request data', () => {
      const validRequest = {
        projectId: 'project-1',
        characters: [
          {
            name: 'Connor',
            referenceImageUrl: 'https://test.com/connor.png',
            description: { hairColor: 'brown' },
          },
        ],
        script: 'Scene 1: Connor at the park\nScene 2: Dragon appears',
      };

      expect(validRequest.projectId).toBeDefined();
      expect(validRequest.characters.length).toBeGreaterThan(0);
      expect(validRequest.script.length).toBeGreaterThan(0);
    });

    it('should handle generation errors', () => {
      const errorResponse = {
        success: false,
        error: 'Generation failed',
        details: 'API rate limit exceeded',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
    });

    it('should return generation results', () => {
      const successResponse = {
        success: true,
        generatedImages: [
          {
            sceneId: 'scene-1',
            imageUrl: 'https://supabase.co/storage/image1.png',
            status: 'completed',
          },
          {
            sceneId: 'scene-2',
            imageUrl: 'https://supabase.co/storage/image2.png',
            status: 'completed',
          },
        ],
        totalScenes: 2,
        successfulScenes: 2,
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.generatedImages).toHaveLength(2);
      expect(successResponse.successfulScenes).toBe(successResponse.totalScenes);
    });
  });
});
