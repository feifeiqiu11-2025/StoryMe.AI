/**
 * Workshop Registration Validation Schemas
 */

import { z } from 'zod';

export const WorkshopRegistrationSchema = z.object({
  // Workshop selection
  selectedWorkshopIds: z
    .array(z.string())
    .min(1, 'Please select at least one workshop'),
  selectedSessionType: z.enum(['morning', 'afternoon', 'single'], {
    message: 'Please select a session type',
  }),
  partnerId: z.string().min(1, 'Partner is required'),
  selectedLocation: z.string().max(100).optional(),
  selectedTimeSlot: z.string().max(50).optional(),

  // Parent / Guardian
  parentFirstName: z
    .string()
    .min(1, 'First name is required')
    .max(100),
  parentLastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100),
  parentEmail: z
    .string()
    .email('Please enter a valid email address'),
  parentPhone: z
    .string()
    .min(10, 'Please enter a valid phone number')
    .max(20),

  // Children (1-3 per registration)
  children: z
    .array(
      z.object({
        firstName: z
          .string()
          .min(1, 'Child\'s first name is required')
          .max(100),
        lastName: z
          .string()
          .max(100)
          .optional()
          .default(''),
        age: z
          .number({ message: 'Please select child\'s age' })
          .int()
          .min(3, 'Minimum age is 3')
          .max(14, 'Maximum age is 14'),
      }),
    )
    .min(1, 'At least one child is required')
    .max(3, 'Maximum 3 children per registration'),

  // Emergency Contact (required for non-school partners; skipped for school-based partners like Avocado)
  emergencyContactName: z
    .string()
    .max(200)
    .optional()
    .default(''),
  emergencyContactPhone: z
    .string()
    .max(20)
    .optional()
    .default(''),
  emergencyContactRelation: z
    .string()
    .max(100)
    .optional()
    .default(''),

  // Promo code — now handled by Stripe's allow_promotion_codes at checkout
  // promoCode: z.string().max(50).optional().default(''),

  // Waiver
  waiverAccepted: z.literal(true, {
    message: 'You must accept the digital waiver to register',
  }),

  // Code of Conduct (required for SteamOji only)
  codeOfConductAccepted: z.boolean().optional().default(false),

  // Photo/Video Consent (optional — awareness only, does not block registration)
  photoVideoConsentAccepted: z.boolean().optional().default(false),
});

export type WorkshopRegistrationData = z.infer<typeof WorkshopRegistrationSchema>;
