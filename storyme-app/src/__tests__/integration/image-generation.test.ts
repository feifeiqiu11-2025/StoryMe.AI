/**
 * Image Generation Integration Tests
 * Tests for Fal.ai API integration and image generation flow
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { testData, createMockSupabaseClient } from '../utils/test-helpers';
import * as fal from '@fal-ai/serverless-client';

// Mock Fal.ai client
jest.mock('@fal-ai/serverless-client', () => ({
  config: jest.fn(),
  subscribe: jest.fn(),
}));

describe('Image Generation Integration', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    jest.clearAllMocks();

    // Reset Fal.ai mock
    (fal.subscribe as jest.Mock).mockReset();
  });

  describe('Fal.ai API Integration', () => {
    it('should successfully generate image with Fal.ai', async () => {
      const mockFalResponse = {
        data: {
          images: [
            {
              url: 'https://fal.ai/generated/test-image.png',
              width: 1024,
              height: 1024,
            },
          ],
          seed: 12345,
          prompt: 'Connor playing at the park, children\'s book illustration',
        },
      };

      (fal.subscribe as jest.Mock).mockResolvedValue(mockFalResponse);

      // Import and test the Fal client function
      const { generateImageWithCharacter } = await import('@/lib/fal-client');

      const result = await generateImageWithCharacter({
        referenceImageUrl: 'https://test.com/reference.png',
        sceneDescription: 'Connor playing at the park',
        artStyle: 'children\'s book illustration',
      });

      expect(result).toBeDefined();
      expect(result.imageUrl).toBe('https://fal.ai/generated/test-image.png');
      expect(result.prompt).toContain('Connor playing at the park');
      expect(result.seed).toBe(12345);
      expect(result.generationTime).toBeGreaterThan(0);
    });

    it('should generate image with multiple characters', async () => {
      const mockFalResponse = {
        data: {
          images: [
            {
              url: 'https://fal.ai/generated/multi-character.png',
              width: 1024,
              height: 1024,
            },
          ],
          seed: 67890,
          prompt: 'Connor and Emma playing together',
        },
      };

      (fal.subscribe as jest.Mock).mockResolvedValue(mockFalResponse);

      const { generateImageWithMultipleCharacters } = await import('@/lib/fal-client');

      const result = await generateImageWithMultipleCharacters({
        characters: [
          {
            name: 'Connor',
            referenceImageUrl: 'https://test.com/connor.png',
            description: {
              hairColor: 'brown',
              skinTone: 'light',
              age: '4',
            },
          },
          {
            name: 'Emma',
            referenceImageUrl: 'https://test.com/emma.png',
            description: {
              hairColor: 'blonde',
              skinTone: 'light',
              age: '3',
            },
          },
        ],
        sceneDescription: 'Connor and Emma playing together at the park',
        artStyle: 'children\'s book illustration',
      });

      expect(result).toBeDefined();
      expect(result.imageUrl).toContain('fal.ai');
      expect(result.prompt).toContain('Connor');
      expect(result.prompt).toContain('Emma');
    });

    it('should handle Fal.ai API errors', async () => {
      (fal.subscribe as jest.Mock).mockRejectedValue(
        new Error('FAL_KEY not configured')
      );

      const { generateImageWithCharacter } = await import('@/lib/fal-client');

      await expect(
        generateImageWithCharacter({
          referenceImageUrl: 'https://test.com/reference.png',
          sceneDescription: 'Test scene',
        })
      ).rejects.toThrow();
    });

    it('should handle missing FAL_KEY', async () => {
      const originalEnv = process.env.FAL_KEY;
      delete process.env.FAL_KEY;

      const { initializeFalClient } = await import('@/lib/fal-client');

      expect(() => initializeFalClient()).toThrow('FAL_KEY');

      process.env.FAL_KEY = originalEnv;
    });

    it('should handle empty image response', async () => {
      (fal.subscribe as jest.Mock).mockResolvedValue({
        data: {
          images: [],
        },
      });

      const { generateImageWithCharacter } = await import('@/lib/fal-client');

      await expect(
        generateImageWithCharacter({
          referenceImageUrl: 'https://test.com/reference.png',
          sceneDescription: 'Test scene',
        })
      ).rejects.toThrow('No images generated');
    });
  });

  describe('Scene Parsing', () => {
    it('should parse script into scenes', () => {
      const { parseScriptIntoScenes } = require('@/lib/scene-parser');

      const script = `Connor playing with his friend at the park on a sunny day
A big friendly dragon accidentally swallows Connor's friend
Connor looks shocked and worried, the dragon looks surprised and apologetic`;

      const characters = [
        { ...testData.character, name: 'Connor' },
      ];

      const scenes = parseScriptIntoScenes(script, characters);

      expect(scenes).toHaveLength(3);
      expect(scenes[0].sceneNumber).toBe(1);
      expect(scenes[0].description).toContain('Connor');
      expect(scenes[0].characterNames).toContain('Connor');
      expect(scenes[1].sceneNumber).toBe(2);
      expect(scenes[2].sceneNumber).toBe(3);
    });

    it('should extract character names from scenes', () => {
      const { extractCharacterNames } = require('@/lib/scene-parser');

      const description = 'Connor and Emma are playing together at the park';
      const characters = [
        { ...testData.character, name: 'Connor' },
        { ...testData.character, name: 'Emma' },
        { ...testData.character, name: 'Oliver' },
      ];

      const found = extractCharacterNames(description, characters);

      expect(found).toContain('Connor');
      expect(found).toContain('Emma');
      expect(found).not.toContain('Oliver');
    });

    it('should detect generic characters', () => {
      const { extractGenericCharacters } = require('@/lib/scene-parser');

      const description = 'Connor meets a friendly policeman at the park who helps find his lost dog';

      const genericChars = extractGenericCharacters(description);

      expect(genericChars).toContain('policeman');
    });

    it('should validate script length', () => {
      const { validateScript } = require('@/lib/scene-parser');

      const tooShort = '';
      const tooLong = 'Scene 1\n'.repeat(20);
      const justRight = 'Scene 1\nScene 2\nScene 3';

      expect(validateScript(tooShort).valid).toBe(false);
      expect(validateScript(tooLong).valid).toBe(false);
      expect(validateScript(justRight).valid).toBe(true);
    });
  });

  describe('Complete Generation Flow', () => {
    it('should complete full story generation flow', async () => {
      // 1. Parse script into scenes
      const { parseScriptIntoScenes } = require('@/lib/scene-parser');

      const script = 'Connor playing at the park\nA dragon appears';
      const characters = [{ ...testData.character, name: 'Connor' }];
      const scenes = parseScriptIntoScenes(script, characters);

      expect(scenes).toHaveLength(2);

      // 2. Generate images for each scene
      const mockFalResponse = {
        data: {
          images: [{ url: 'https://fal.ai/generated/image.png' }],
          seed: 12345,
          prompt: 'test prompt',
        },
      };

      (fal.subscribe as jest.Mock).mockResolvedValue(mockFalResponse);

      const { generateImageWithMultipleCharacters } = await import('@/lib/fal-client');

      const generatedImages = [];

      for (const scene of scenes) {
        const result = await generateImageWithMultipleCharacters({
          characters: [{
            name: 'Connor',
            referenceImageUrl: 'https://test.com/connor.png',
            description: {
              hairColor: 'brown',
              skinTone: 'light',
              age: '4',
            },
          }],
          sceneDescription: scene.description,
        });

        generatedImages.push({
          sceneId: scene.id,
          imageUrl: result.imageUrl,
          prompt: result.prompt,
        });
      }

      expect(generatedImages).toHaveLength(2);
      expect(generatedImages[0].imageUrl).toContain('fal.ai');

      // 3. Save to database (mocked)
      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn().mockResolvedValue({
            data: generatedImages.map((img, idx) => ({
              id: `img-${idx + 1}`,
              ...img,
              status: 'completed',
              created_at: new Date().toISOString(),
            })),
            error: null,
          }),
        })),
      }));

      const { data } = await mockSupabase
        .from('generated_images')
        .insert(generatedImages)
        .select();

      expect(data).toHaveLength(2);
      expect(data[0].status).toBe('completed');
    });

    it('should handle generation errors gracefully', async () => {
      const { parseScriptIntoScenes } = require('@/lib/scene-parser');

      const script = 'Scene 1\nScene 2';
      const scenes = parseScriptIntoScenes(script, []);

      // Mock first scene succeeds, second fails
      (fal.subscribe as jest.Mock)
        .mockResolvedValueOnce({
          data: {
            images: [{ url: 'https://fal.ai/image1.png' }],
            seed: 12345,
            prompt: 'scene 1',
          },
        })
        .mockRejectedValueOnce(new Error('Generation failed'));

      const { generateImageWithCharacter } = await import('@/lib/fal-client');

      const results = [];

      for (const scene of scenes) {
        try {
          const result = await generateImageWithCharacter({
            referenceImageUrl: 'https://test.com/ref.png',
            sceneDescription: scene.description,
          });
          results.push({ status: 'completed', ...result });
        } catch (error) {
          results.push({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('completed');
      expect(results[1].status).toBe('failed');
    });
  });

  describe('Progress Tracking', () => {
    it('should track generation progress', async () => {
      const progressUpdates: any[] = [];

      (fal.subscribe as jest.Mock).mockImplementation((model: string, options: any) => {
        // Simulate progress updates
        if (options.onQueueUpdate) {
          options.onQueueUpdate({ status: 'IN_QUEUE' });
          options.onQueueUpdate({ status: 'IN_PROGRESS', logs: ['Generating...'] });
        }

        return Promise.resolve({
          data: {
            images: [{ url: 'https://fal.ai/image.png' }],
            seed: 12345,
            prompt: 'test',
          },
        });
      });

      const { generateImageWithCharacter } = await import('@/lib/fal-client');

      await generateImageWithCharacter({
        referenceImageUrl: 'https://test.com/ref.png',
        sceneDescription: 'Test scene',
      });

      // Progress updates would be captured via onQueueUpdate callback
      expect(fal.subscribe).toHaveBeenCalled();
    });
  });
});
