import { z } from 'zod';

export const LeadInterestSchema = z.enum([
  'job',
  'school_partnership',
  'product_interest',
  'other',
]);

export const LeadSourceMediumSchema = z.enum([
  'qr_code',
  'web',
  'in_person',
  'referral',
]);

export const LeadAuthProviderSchema = z.enum(['google', 'apple', 'email']);

export const CreateLeadRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().max(100).optional().or(z.literal('').transform(() => undefined)),
  interest: LeadInterestSchema,
  message: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  consent_marketing: z.boolean(),
  source: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9\-_]*$/, 'source must be a kebab/underscore slug'),
  source_medium: LeadSourceMediumSchema.optional(),
  auth_provider: LeadAuthProviderSchema.optional(),
  user_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateLeadInput = z.infer<typeof CreateLeadRequestSchema>;

export const CreateLeadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    lead_id: z.string().uuid(),
  }),
});

export type CreateLeadResponse = z.infer<typeof CreateLeadResponseSchema>;
