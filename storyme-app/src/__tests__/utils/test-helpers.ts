/**
 * Test Utilities and Helpers
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase Client
export function createMockSupabaseClient(): Partial<SupabaseClient> {
  const mockData: Record<string, any[]> = {
    users: [],
    character_library: [],
    projects: [],
    scenes: [],
    generated_images: [],
    project_characters: [],
  };

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      signUp: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    } as any,

    from: jest.fn((table: string) => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn((data: any) => ({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: Array.isArray(data) ? data[0] : data,
          error: null,
        }),
      })),
      update: jest.fn(() => ({
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      })),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockData[table]?.[0] || null,
        error: null,
      }),
    })),

    storage: {
      from: jest.fn((bucket: string) => ({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'test/path/file.png' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/test/path/file.png' },
        }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        list: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/test' },
          error: null,
        }),
      })),
      listBuckets: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      createBucket: jest.fn().mockResolvedValue({
        data: { name: 'test-bucket' },
        error: null,
      }),
    } as any,
  } as Partial<SupabaseClient>;
}

// Mock File object for upload tests
export function createMockFile(
  name: string = 'test.png',
  size: number = 1024,
  type: string = 'image/png'
): File {
  const blob = new Blob(['test content'], { type });
  return new File([blob], name, { type });
}

// Mock FormData for upload tests
export function createMockFormData(file: File): FormData {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

// Mock fetch response
export function mockFetchResponse(data: any, ok: boolean = true, status: number = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

// Sample test data
export const testData = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },

  character: {
    id: 'char-1',
    user_id: 'test-user-id',
    name: 'Connor',
    hair_color: 'brown',
    skin_tone: 'light',
    age: '4',
    clothing: 'blue shirt',
    other_features: 'friendly smile',
    reference_image_url: 'https://test.supabase.co/storage/character.png',
    reference_image_filename: 'character.png',
    is_favorite: false,
    usage_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  project: {
    id: 'project-1',
    user_id: 'test-user-id',
    title: 'Connor\'s Dragon Adventure',
    description: 'A story about Connor and a dragon',
    status: 'draft' as const,
    original_script: 'Connor playing with his friend at the park on a sunny day\nA big friendly dragon accidentally swallows Connor\'s friend',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  scene: {
    id: 'scene-1',
    project_id: 'project-1',
    scene_number: 1,
    description: 'Connor playing with his friend at the park on a sunny day',
    character_ids: ['char-1'],
    created_at: new Date().toISOString(),
  },

  generatedImage: {
    id: 'img-1',
    scene_id: 'scene-1',
    project_id: 'project-1',
    image_url: 'https://test.supabase.co/storage/generated/image.png',
    prompt: 'Connor playing at the park, children\'s book illustration',
    generation_time: 5.2,
    status: 'completed' as const,
    created_at: new Date().toISOString(),
  },
};

// Wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Assert error was thrown
export async function expectToThrow(fn: () => Promise<any>, expectedError?: string) {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (expectedError && error instanceof Error) {
      expect(error.message).toContain(expectedError);
    }
  }
}
