/**
 * Admin API: Send marketing email broadcast.
 *
 * POST /api/admin/send-marketing-email
 * Body:
 *   {
 *     campaign_id: 'spark-letter-1',     // must be in CAMPAIGN_RENDERERS
 *     mode: 'dry_run' | 'test' | 'live',
 *     batch_size?: number                 // default 50, max 100
 *   }
 *
 * Modes:
 *   dry_run — no sends; returns recipient counts only
 *   test    — sends only to TEST_RECIPIENTS, logs under '<campaign>-test' so
 *             live sends to those addresses are not skipped
 *   live    — sends to UNION(users.email, workshop_registrations.email),
 *             deduped, opt-out filtered, already-sent filtered
 *
 * Idempotency: every successful or failed send writes a row to
 * marketing_email_sends. UNIQUE (campaign_id, LOWER(email)) prevents
 * duplicates across re-runs. The endpoint chunks via batch_size so a single
 * Vercel invocation stays under maxDuration; call repeatedly until
 * `remaining: 0`.
 *
 * Throttle: 600 ms between sends — 1.67/sec, comfortably under Resend's
 * 2/sec free-tier rate limit.
 *
 * Security: this route has no auth check (matching the existing admin/*
 * pattern). The campaign_id allowlist limits blast radius — even if the
 * route is hit anonymously, it can only fire pre-approved campaigns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resend, EMAIL_FROM } from '@/lib/email/resend';
import { getOptedOutEmails } from '@/lib/email/check-opt-out';
import {
  renderSparkLetter1,
  SPARK_LETTER_1_CAMPAIGN_ID,
} from '@/lib/email/spark-letter-1';

export const maxDuration = 60;

const REPLY_TO = 'Admin@KindleWoodStudio.ai';
const THROTTLE_MS = 600;
const TEST_RECIPIENTS = ['kindlewoodsai@gmail.com', 'feifei_qiu@hotmail.com'];

type CampaignRenderer = (email: string) => {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

// Allowlist. Adding a new campaign requires a code change — that's the point.
const CAMPAIGN_RENDERERS: Record<string, CampaignRenderer> = {
  [SPARK_LETTER_1_CAMPAIGN_ID]: renderSparkLetter1,
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface SendBody {
  campaign_id?: string;
  mode?: 'dry_run' | 'test' | 'live';
  batch_size?: number;
}

export async function POST(req: NextRequest) {
  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }

  const { campaign_id, mode, batch_size } = body;

  const renderer = campaign_id ? CAMPAIGN_RENDERERS[campaign_id] : undefined;
  if (!campaign_id || !renderer) {
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

  if (!mode || !['dry_run', 'test', 'live'].includes(mode)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_MODE', message: 'mode must be dry_run | test | live' },
      },
      { status: 400 },
    );
  }

  const cap = Math.min(Math.max(batch_size ?? 50, 1), 100);
  const supabase = getSupabase();

  // Test mode logs under a separate campaign suffix so live sends to those
  // addresses are not skipped by the already-sent filter.
  const effectiveCampaignId = mode === 'test' ? `${campaign_id}-test` : campaign_id;

  // Step 1: build recipient list
  let recipients: string[];
  if (mode === 'test') {
    recipients = TEST_RECIPIENTS.map((e) => e.toLowerCase().trim());
  } else {
    const [usersResp, workshopsResp] = await Promise.all([
      supabase.from('users').select('email').not('email', 'is', null),
      supabase.from('workshop_registrations').select('email').not('email', 'is', null),
    ]);

    if (usersResp.error || workshopsResp.error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DB_QUERY_FAILED',
            message: 'Failed to load recipient list',
            details: {
              users_error: usersResp.error?.message,
              workshops_error: workshopsResp.error?.message,
            },
          },
        },
        { status: 500 },
      );
    }

    const all = new Set<string>();
    for (const row of usersResp.data || []) {
      const e = (row as { email: string }).email?.toLowerCase().trim();
      if (e && e.includes('@')) all.add(e);
    }
    for (const row of workshopsResp.data || []) {
      const e = (row as { email: string }).email?.toLowerCase().trim();
      if (e && e.includes('@')) all.add(e);
    }
    recipients = Array.from(all);
  }

  // Step 2: filter opted-out
  const optedOut = await getOptedOutEmails(recipients, supabase);

  // Step 3: filter already-sent for this campaign
  const { data: sentRows, error: sentErr } = await supabase
    .from('marketing_email_sends')
    .select('email')
    .eq('campaign_id', effectiveCampaignId);

  if (sentErr) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DB_QUERY_FAILED', message: 'Failed to load sent log', details: sentErr.message },
      },
      { status: 500 },
    );
  }

  const alreadySent = new Set(
    (sentRows || []).map((r) => (r as { email: string }).email.toLowerCase()),
  );

  const eligible = recipients.filter(
    (e) => !optedOut.has(e) && !alreadySent.has(e),
  );

  // Step 4: dry run reports and exits
  if (mode === 'dry_run') {
    return NextResponse.json({
      success: true,
      mode,
      campaign_id: effectiveCampaignId,
      counts: {
        total_recipients: recipients.length,
        opted_out: optedOut.size,
        already_sent: alreadySent.size,
        eligible: eligible.length,
        will_send_in_this_batch: Math.min(eligible.length, cap),
      },
      sample_eligible: eligible.slice(0, 5),
    });
  }

  // Step 5: send loop
  const toSend = eligible.slice(0, cap);
  const sent: string[] = [];
  const failed: { email: string; error: string }[] = [];

  for (let i = 0; i < toSend.length; i++) {
    const email = toSend[i];
    if (i > 0) await delay(THROTTLE_MS);

    try {
      const { subject, html, text, headers } = renderer(email);
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject,
        html,
        text,
        replyTo: REPLY_TO,
        headers,
      });

      if (error) {
        failed.push({ email, error: error.message || 'Unknown Resend error' });
        await supabase.from('marketing_email_sends').insert({
          campaign_id: effectiveCampaignId,
          email,
          status: 'failed',
          error: (error.message || 'Unknown').slice(0, 500),
        });
      } else {
        sent.push(email);
        await supabase.from('marketing_email_sends').insert({
          campaign_id: effectiveCampaignId,
          email,
          resend_message_id: data?.id || null,
          status: 'sent',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ email, error: msg });
      await supabase.from('marketing_email_sends').insert({
        campaign_id: effectiveCampaignId,
        email,
        status: 'failed',
        error: msg.slice(0, 500),
      });
    }
  }

  return NextResponse.json({
    success: true,
    mode,
    campaign_id: effectiveCampaignId,
    counts: {
      total_recipients: recipients.length,
      opted_out: optedOut.size,
      already_sent_before_this_call: alreadySent.size,
      sent_this_call: sent.length,
      failed_this_call: failed.length,
      remaining_eligible: eligible.length - toSend.length,
    },
    failed_details: failed,
  });
}
