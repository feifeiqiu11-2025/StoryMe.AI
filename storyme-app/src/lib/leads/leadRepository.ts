import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateLeadInput } from './schemas';

export type LeadRow = {
  id: string;
  email: string;
  name: string | null;
  interest: CreateLeadInput['interest'];
  source: string;
  source_medium: CreateLeadInput['source_medium'] | null;
  auth_provider: CreateLeadInput['auth_provider'] | null;
  user_id: string | null;
  message: string | null;
  consent_marketing: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export class LeadRepository {
  constructor(private readonly client: SupabaseClient) {}

  async insert(input: CreateLeadInput): Promise<LeadRow> {
    const { data, error } = await this.client
      .from('leads')
      .insert({
        email: input.email,
        name: input.name ?? null,
        interest: input.interest,
        source: input.source,
        source_medium: input.source_medium ?? null,
        auth_provider: input.auth_provider ?? null,
        user_id: input.user_id ?? null,
        message: input.message ?? null,
        consent_marketing: input.consent_marketing,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to insert lead: ${error?.message ?? 'unknown error'}`);
    }

    return data as LeadRow;
  }
}
