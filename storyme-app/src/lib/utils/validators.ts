/**
 * Zod validation schemas for forms and API requests
 */

import { z } from 'zod';

// Character Library Validation
export const characterLibrarySchema = z.object({
  name: z.string().min(1, 'Character name is required').max(255),
  is_favorite: z.boolean().optional().default(false),

  // Reference Images
  reference_image_url: z.string().url().optional(),
  reference_image_filename: z.string().optional(),

  // Animated Preview (Gemini-generated 3D Pixar-style version)
  animated_preview_url: z.string().url().optional(),

  // Description Fields - at least one should be filled
  hair_color: z.string().max(100).optional(),
  skin_tone: z.string().max(100).optional(),
  clothing: z.string().optional(),
  age: z.string().max(50).optional(),
  other_features: z.string().optional(),
  personality_traits: z.array(z.string()).optional(),

  // Art Style
  art_style_preference: z.enum(['cartoon', 'watercolor', 'realistic']).optional(),
}).refine(
  (data) => {
    // Either have a reference image OR at least one description field
    const hasReferenceImage = !!data.reference_image_url;
    const hasDescription = !!(
      data.hair_color ||
      data.skin_tone ||
      data.clothing ||
      data.age ||
      data.other_features
    );

    return hasReferenceImage || hasDescription;
  },
  {
    message: 'Please provide either a reference image or at least one character description',
    path: ['reference_image_url'],
  }
);

export type CharacterLibraryFormData = z.infer<typeof characterLibrarySchema>;

// Project Validation
export const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required').max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'processing', 'completed', 'error']).default('draft'),
  original_script: z.string().optional(),
  reading_level: z.enum(['pre-k', 'kindergarten', 'grade-1']).optional(),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// Scene Validation
export const sceneSchema = z.object({
  scene_number: z.number().min(1),
  description: z.string().min(10, 'Scene description must be at least 10 characters').max(500),
  character_ids: z.array(z.string().uuid()).optional(),
  location_type: z.string().optional(),
  location_description: z.string().optional(),
  time_of_day: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
});

export type SceneFormData = z.infer<typeof sceneSchema>;

// File Upload Validation
export const imageUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'Image must be less than 10MB')
    .refine(
      (file) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type),
      'Image must be JPEG, PNG, or WebP format'
    ),
});

// Login Validation
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Signup Validation
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  name: z.string().min(1, 'Name is required').max(255),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type SignupFormData = z.infer<typeof signupSchema>;
