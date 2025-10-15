/**
 * Storage Service
 * Handles file uploads to Supabase Storage
 * Replaces local file system storage
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface UploadResult {
  url: string;
  filename: string;
  path: string;
}

export class StorageService {
  private readonly CHARACTER_BUCKET = 'character-images';
  private readonly GENERATED_BUCKET = 'generated-images';
  private readonly STORYBOOK_BUCKET = 'storybooks';

  constructor(private supabase: SupabaseClient) {}

  /**
   * Upload character reference image
   */
  async uploadCharacterImage(
    userId: string,
    file: File
  ): Promise<UploadResult> {
    const filename = this.generateFilename(file.name);
    const path = `${userId}/${filename}`;

    const { data, error } = await this.supabase.storage
      .from(this.CHARACTER_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from(this.CHARACTER_BUCKET)
      .getPublicUrl(path);

    return {
      url: publicUrl,
      filename: file.name,
      path: data.path,
    };
  }

  /**
   * Upload generated image from URL (e.g., from Fal.ai)
   */
  async uploadGeneratedImageFromUrl(
    projectId: string,
    sceneId: string,
    imageUrl: string
  ): Promise<UploadResult> {
    try {
      // Fetch the image from the external URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from ${imageUrl}`);
      }

      const blob = await response.blob();
      const filename = `scene-${sceneId}-${Date.now()}.png`;
      const path = `${projectId}/${filename}`;

      const { data, error } = await this.supabase.storage
        .from(this.GENERATED_BUCKET)
        .upload(path, blob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload generated image: ${error.message}`);
      }

      const { data: { publicUrl } } = this.supabase.storage
        .from(this.GENERATED_BUCKET)
        .getPublicUrl(path);

      return {
        url: publicUrl,
        filename,
        path: data.path,
      };
    } catch (error) {
      console.error('Error uploading generated image:', error);
      throw error;
    }
  }

  /**
   * Upload PDF storybook
   */
  async uploadStorybook(
    userId: string,
    projectId: string,
    pdfBlob: Blob,
    filename: string
  ): Promise<UploadResult> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const path = `${userId}/${projectId}/${sanitizedFilename}`;

    const { data, error } = await this.supabase.storage
      .from(this.STORYBOOK_BUCKET)
      .upload(path, pdfBlob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload storybook: ${error.message}`);
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from(this.STORYBOOK_BUCKET)
      .getPublicUrl(path);

    return {
      url: publicUrl,
      filename: sanitizedFilename,
      path: data.path,
    };
  }

  /**
   * Delete character image
   */
  async deleteCharacterImage(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.CHARACTER_BUCKET)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Delete all generated images for a project
   */
  async deleteProjectImages(projectId: string): Promise<void> {
    const { data: files, error: listError } = await this.supabase.storage
      .from(this.GENERATED_BUCKET)
      .list(projectId);

    if (listError) {
      console.error('List error:', listError);
      throw new Error(`Failed to list project images: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      return;
    }

    const filePaths = files.map(file => `${projectId}/${file.name}`);

    const { error } = await this.supabase.storage
      .from(this.GENERATED_BUCKET)
      .remove(filePaths);

    if (error) {
      console.error('Delete error:', error);
      throw new Error(`Failed to delete project images: ${error.message}`);
    }
  }

  /**
   * Get signed URL for private files
   */
  async getSignedUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Generate unique filename with timestamp
   */
  private generateFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const sanitized = this.sanitizeFilename(nameWithoutExt);

    return `${sanitized}-${timestamp}-${random}.${extension}`;
  }

  /**
   * Sanitize filename to remove special characters
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Check if buckets exist, create if not
   */
  async ensureBucketsExist(): Promise<void> {
    const buckets = [
      this.CHARACTER_BUCKET,
      this.GENERATED_BUCKET,
      this.STORYBOOK_BUCKET,
    ];

    for (const bucketName of buckets) {
      const { data: existingBuckets } = await this.supabase.storage.listBuckets();
      const exists = existingBuckets?.some(b => b.name === bucketName);

      if (!exists) {
        console.log(`Creating bucket: ${bucketName}`);
        const { error } = await this.supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        });

        if (error) {
          console.error(`Failed to create bucket ${bucketName}:`, error);
        }
      }
    }
  }
}
