/**
 * Workshop Availability Types
 * Shared between the availability API and client components.
 */

export interface SessionCounts {
  morning: number;
  afternoon: number;
}

export interface WorkshopAvailabilityData {
  partnerId: string;
  counts: Record<string, SessionCounts>; // keyed by session ID (e.g. 'steamoji-wk1')
  queriedAt: string;
}
