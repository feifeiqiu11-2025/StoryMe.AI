/**
 * Support Submission API Route
 * POST /api/support/submit
 *
 * Handles support ticket submissions from users (authenticated or anonymous)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { resend, EMAIL_FROM } from '@/lib/email/resend';

/**
 * POST /api/support/submit
 * Create a new support submission
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();

    // Parse request body
    const body = await request.json();
    const { title, description, email, type } = body;

    // Demo requests allow unauthenticated submissions
    const isDemo = type === 'demo';

    // Require authentication for regular support submissions
    if (!user && !isDemo) {
      return NextResponse.json(
        { error: 'Please log in to submit a support request' },
        { status: 401 }
      );
    }

    // Demo requests require email
    if (isDemo && !user && (!email || !email.trim())) {
      return NextResponse.json(
        { error: 'Email is required for demo requests' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Validate input lengths to prevent abuse
    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title is too long (maximum 200 characters)' },
        { status: 400 }
      );
    }

    if (description.length > 5000) {
      return NextResponse.json(
        { error: 'Description is too long (maximum 5000 characters)' },
        { status: 400 }
      );
    }

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrer = request.headers.get('referer') || undefined;

    let userEmail: string | null = null;
    let userName: string | null = null;

    if (isDemo) {
      // Demo request — always use provided email for follow-up
      userEmail = email?.trim() || null;
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();
        userName = userData?.full_name || null;
      }
    } else if (user) {
      // Authenticated user — get their info
      const { data: userData } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      userEmail = userData?.email || user.email || null;
      userName = userData?.full_name || null;
    }

    // Use service role for demo inserts (no authenticated user = no RLS permission)
    const dbClient = isDemo && !user ? createServiceRoleClient() : supabase;

    // Build insert data — omit user_id entirely if no user (avoids NOT NULL constraint)
    const insertData: Record<string, any> = {
      title: title.trim(),
      description: description.trim(),
      submission_type: 'issue',
      user_email: userEmail,
      user_name: userName,
      user_agent: userAgent,
      referrer_url: referrer,
      status: 'new',
      priority: isDemo ? 'high' : 'medium',
    };
    if (user) {
      insertData.user_id = user.id;
    }

    const { data: submission, error: insertError } = await dbClient
      .from('support_submissions')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating support submission:', insertError);
      console.error('Full error details:', JSON.stringify(insertError, null, 2));
      console.error('Insert data:', JSON.stringify({ ...insertData, user_agent: '[redacted]' }, null, 2));

      // If DB insert fails for demo (likely user_id NOT NULL constraint),
      // still return success — the console log captures the request for admin follow-up
      if (isDemo) {
        console.log(`[DEMO REQUEST] Email: ${userEmail}, Subject: ${title.trim()}, Description: ${description.trim()}`);
        // Still send email even if DB insert failed
        try {
          await sendAdminNotification({
            title: title.trim(),
            description: description.trim(),
            userEmail,
            userName,
            isDemo: true,
            submissionId: 'demo-fallback',
          });
        } catch (emailError) {
          console.error('Failed to send demo notification email:', emailError);
        }
        return NextResponse.json(
          {
            success: true,
            message: 'Demo request received',
            submission: { id: 'demo-fallback', created_at: new Date().toISOString() },
          },
          { status: 201 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to submit support request. Please try again.' },
        { status: 500 }
      );
    }

    // Send email notification to admin
    try {
      await sendAdminNotification({
        title: title.trim(),
        description: description.trim(),
        userEmail,
        userName,
        isDemo,
        submissionId: submission.id,
      });
    } catch (emailError) {
      // Don't fail the request if email fails — submission is already saved
      console.error('Failed to send admin notification email:', emailError);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Support request submitted successfully',
        submission: {
          id: submission.id,
          created_at: submission.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/support/submit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const ADMIN_EMAIL = 'admin@kindlewoodstudio.ai';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendAdminNotification({
  title,
  description,
  userEmail,
  userName,
  isDemo,
  submissionId,
}: {
  title: string;
  description: string;
  userEmail: string | null;
  userName: string | null;
  isDemo: boolean;
  submissionId: string;
}) {
  const typeLabel = isDemo ? 'Demo Request' : 'Support Request';
  const priorityLabel = isDemo ? 'HIGH' : 'Medium';

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeName = escapeHtml(userName || 'Unknown');
  const safeEmail = escapeHtml(userEmail || 'No email');

  const subject = `[${typeLabel}] ${title}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background: linear-gradient(135deg, ${isDemo ? '#059669, #0d9488' : '#7c3aed, #ec4899'}); padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 20px; margin: 0;">New ${typeLabel}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #374151;">Priority:</strong>
                  <span style="color: ${isDemo ? '#dc2626' : '#2563eb'}; font-weight: 600;"> ${priorityLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #374151;">From:</strong>
                  <span style="color: #4b5563;"> ${safeName} &lt;${safeEmail}&gt;</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #374151;">Subject:</strong>
                  <span style="color: #4b5563;"> ${safeTitle}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 0 8px;">
                  <strong style="color: #374151;">Description:</strong>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 16px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid ${isDemo ? '#059669' : '#7c3aed'};">
                  <p style="color: #4b5563; margin: 0; white-space: pre-wrap;">${safeDesc}</p>
                </td>
              </tr>
            </table>
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
              <a href="https://www.kindlewoodstudio.ai/admin/support" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                View in Admin Dashboard
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 24px; background-color: #f9fafb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Submission ID: ${submissionId}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: ADMIN_EMAIL,
    replyTo: userEmail || undefined,
    subject,
    html,
  });
}
