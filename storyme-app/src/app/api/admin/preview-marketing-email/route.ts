/**
 * Admin API: In-browser preview of a marketing email template.
 *
 * GET /api/admin/preview-marketing-email?campaign_id=<id>&email=<sample>
 *
 * Returns the rendered HTML with Content-Type: text/html so it renders in a
 * browser tab. Lets us iterate on copy/layout without burning Resend sends
 * or waiting for an email round-trip.
 *
 * Auth: matches the existing admin/* pattern (no enforcement). campaign_id
 * is constrained to the same allowlist as the send endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  renderSparkLetter1,
  SPARK_LETTER_1_CAMPAIGN_ID,
} from '@/lib/email/spark-letter-1';
import {
  renderSummerWorkshopPromo,
  SUMMER_WORKSHOP_PROMO_CAMPAIGN_ID,
} from '@/lib/email/summer-workshop-promo';
import {
  renderSummerWorkshopFollowup,
  SUMMER_WORKSHOP_FOLLOWUP_CAMPAIGN_ID,
} from '@/lib/email/summer-workshop-followup';
import {
  renderCareerFairFollowup,
  CAREER_FAIR_FOLLOWUP_CAMPAIGN_ID,
} from '@/lib/email/career-fair-followup';

// Renderers vary in arity: most take (email), the summer follow-up takes
// (email, baseUrl). Type-narrow at the call site.
type CampaignRenderer =
  | ((email: string) => { html: string })
  | ((email: string, baseUrl: string) => { html: string });

const CAMPAIGN_RENDERERS: Record<string, CampaignRenderer> = {
  [SPARK_LETTER_1_CAMPAIGN_ID]: renderSparkLetter1,
  [SUMMER_WORKSHOP_PROMO_CAMPAIGN_ID]: renderSummerWorkshopPromo,
  [SUMMER_WORKSHOP_FOLLOWUP_CAMPAIGN_ID]: renderSummerWorkshopFollowup,
  [CAREER_FAIR_FOLLOWUP_CAMPAIGN_ID]: renderCareerFairFollowup,
};

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id');
  const sampleEmail =
    req.nextUrl.searchParams.get('email') || 'preview@kindlewoodstudio.ai';

  const renderer = campaignId ? CAMPAIGN_RENDERERS[campaignId] : undefined;
  if (!campaignId || !renderer) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNKNOWN_CAMPAIGN',
          message: `Unknown or missing campaign_id. Allowed: ${Object.keys(CAMPAIGN_RENDERERS).join(', ')}`,
        },
      },
      { status: 400 },
    );
  }

  // Pass the request origin so newly-added images (not yet on production)
  // load from the local dev server during preview.
  const origin = req.nextUrl.origin;
  const { html } = renderer(sampleEmail, origin);
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
