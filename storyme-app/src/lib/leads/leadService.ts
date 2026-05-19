import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadRepository, type LeadRow } from './leadRepository';
import type { CreateLeadInput } from './schemas';

export class LeadService {
  private readonly repo: LeadRepository;

  constructor(client: SupabaseClient) {
    this.repo = new LeadRepository(client);
  }

  async createLead(input: CreateLeadInput): Promise<LeadRow> {
    return this.repo.insert(input);
  }
}
