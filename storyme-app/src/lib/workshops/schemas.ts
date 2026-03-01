/**
 * Workshop Registration Validation Schemas
 */

import { z } from 'zod';

export const WorkshopRegistrationSchema = z.object({
  // Workshop selection
  selectedWorkshopIds: z
    .array(z.string())
    .min(1, 'Please select at least one workshop'),
  selectedSessionType: z.enum(['morning', 'afternoon'], {
    message: 'Please select a session type',
  }),
  partnerId: z.string().min(1, 'Partner is required'),

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

  // Child
  childFirstName: z
    .string()
    .min(1, 'Child\'s first name is required')
    .max(100),
  childLastName: z
    .string()
    .max(100)
    .optional()
    .default(''),
  childAge: z
    .number({ message: 'Please select child\'s age' })
    .int()
    .min(3, 'Minimum age is 3')
    .max(14, 'Maximum age is 14'),

  // Emergency Contact
  emergencyContactName: z
    .string()
    .min(1, 'Emergency contact name is required')
    .max(200),
  emergencyContactPhone: z
    .string()
    .min(10, 'Please enter a valid phone number')
    .max(20),
  emergencyContactRelation: z
    .string()
    .min(1, 'Relationship is required')
    .max(100),

  // Promo code — now handled by Stripe's allow_promotion_codes at checkout
  // promoCode: z.string().max(50).optional().default(''),

  // Waiver
  waiverAccepted: z.literal(true, {
    message: 'You must accept the digital waiver to register',
  }),
});

export type WorkshopRegistrationData = z.infer<typeof WorkshopRegistrationSchema>;
