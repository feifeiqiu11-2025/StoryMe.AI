/**
 * Storage Service Tests
 * Tests for file uploads to Supabase Storage
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { StorageService } from '@/lib/services/storage.service';
import { createMockSupabaseClient, createMockFile } from '../utils/test-helpers';

describe('Storage Service', () => {
  let storageService: StorageService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    storageService = new StorageService(mockSupabase);
    jest.clearAllMocks();
  });

  describe('Upload Character Image', () => {
    it('should successfully upload character image', async () => {
      const file = createMockFile('test-character.png', 2048, 'image/png');
      const userId = 'test-user-id';

      const result = await storageService.uploadCharacterImage(userId, file);

      expect(result).toBeDefined();
      expect(result.url).toContain('supabase.co');
      expect(result.filename).toBe('test-character.png');
      expect(result.path).toContain(userId);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('character-images');
    });

    it('should generate unique filename', async () => {
      const file1 = createMockFile('character.png');
      const file2 = createMockFile('character.png');
      const userId = 'test-user-id';

      const result1 = await storageService.uploadCharacterImage(userId, file1);
      const result2 = await storageService.uploadCharacterImage(userId, file2);

      expect(result1.path).not.toBe(result2.path);
    });

    it('should fail with upload error', async () => {
      const file = createMockFile('test.png');

      mockSupabase.storage.from = jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' },
        }),
      }));

      await expect(
        storageService.uploadCharacterImage('user-id', file)
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('Upload Generated Image from URL', () => {
    it('should download and upload generated image', async () => {
      const falImageUrl = 'https://fal.ai/generated/image.png';
      const projectId = 'project-1';
      const sceneId = 'scene-1';

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['image data'])),
      } as any);

      const result = await storageService.uploadGeneratedImageFromUrl(
        projectId,
        sceneId,
        falImageUrl
      );

      expect(result).toBeDefined();
      expect(result.url).toContain('supabase.co');
      expect(result.path).toContain(projectId);
      expect(global.fetch).toHaveBeenCalledWith(falImageUrl);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('generated-images');
    });

    it('should fail if fetch fails', async () => {
      const falImageUrl = 'https://fal.ai/generated/image.png';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      await expect(
        storageService.uploadGeneratedImageFromUrl('project-1', 'scene-1', falImageUrl)
      ).rejects.toThrow();
    });
  });

  describe('Upload Storybook PDF', () => {
    it('should upload PDF storybook', async () => {
      const pdfBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const userId = 'test-user-id';
      const projectId = 'project-1';
      const filename = 'My Story.pdf';

      const result = await storageService.uploadStorybook(
        userId,
        projectId,
        pdfBlob,
        filename
      );

      expect(result).toBeDefined();
      expect(result.url).toContain('supabase.co');
      expect(result.path).toContain(userId);
      expect(result.path).toContain(projectId);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('storybooks');
    });

    it('should sanitize filename', async () => {
      const pdfBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const unsafeFilename = 'My Story!@#$.pdf';

      const result = await storageService.uploadStorybook(
        'user-id',
        'project-1',
        pdfBlob,
        unsafeFilename
      );

      expect(result.filename).not.toContain('!');
      expect(result.filename).not.toContain('@');
      expect(result.filename).not.toContain('#');
    });
  });

  describe('Delete Operations', () => {
    it('should delete character image', async () => {
      const path = 'user-id/character.png';

      await storageService.deleteCharacterImage(path);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('character-images');
    });

    it('should delete all project images', async () => {
      const projectId = 'project-1';

      mockSupabase.storage.from = jest.fn(() => ({
        list: jest.fn().mockResolvedValue({
          data: [
            { name: 'scene-1.png' },
            { name: 'scene-2.png' },
          ],
          error: null,
        }),
        remove: jest.fn().mockResolvedValue({ error: null }),
      }));

      await storageService.deleteProjectImages(projectId);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('generated-images');
    });

    it('should handle empty project folder', async () => {
      const projectId = 'empty-project';

      mockSupabase.storage.from = jest.fn(() => ({
        list: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      await storageService.deleteProjectImages(projectId);

      // Should not attempt to remove files if none exist
      const bucket = mockSupabase.storage.from();
      expect(bucket.remove).not.toHaveBeenCalled();
    });
  });

  describe('Signed URLs', () => {
    it('should generate signed URL for private files', async () => {
      const bucket = 'character-images';
      const path = 'user-id/private-image.png';
      const expiresIn = 3600;

      const signedUrl = await storageService.getSignedUrl(bucket, path, expiresIn);

      expect(signedUrl).toContain('sign');
      expect(mockSupabase.storage.from).toHaveBeenCalledWith(bucket);
    });
  });

  describe('Bucket Management', () => {
    it('should ensure all buckets exist', async () => {
      mockSupabase.storage.listBuckets = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.storage.createBucket = jest.fn().mockResolvedValue({
        data: { name: 'test-bucket' },
        error: null,
      });

      await storageService.ensureBucketsExist();

      // Should create all three buckets
      expect(mockSupabase.storage.createBucket).toHaveBeenCalledTimes(3);
      expect(mockSupabase.storage.createBucket).toHaveBeenCalledWith(
        'character-images',
        expect.any(Object)
      );
      expect(mockSupabase.storage.createBucket).toHaveBeenCalledWith(
        'generated-images',
        expect.any(Object)
      );
      expect(mockSupabase.storage.createBucket).toHaveBeenCalledWith(
        'storybooks',
        expect.any(Object)
      );
    });

    it('should not recreate existing buckets', async () => {
      mockSupabase.storage.listBuckets = jest.fn().mockResolvedValue({
        data: [
          { name: 'character-images' },
          { name: 'generated-images' },
          { name: 'storybooks' },
        ],
        error: null,
      });

      mockSupabase.storage.createBucket = jest.fn();

      await storageService.ensureBucketsExist();

      expect(mockSupabase.storage.createBucket).not.toHaveBeenCalled();
    });
  });
});
