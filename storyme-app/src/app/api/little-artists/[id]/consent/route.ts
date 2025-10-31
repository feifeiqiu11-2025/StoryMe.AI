/**
 * Artist Consent API Route
 * POST /api/little-artists/[id]/consent
 *
 * Parent gives consent to publish artist profile
 * Sends email notification to admin for review
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ArtistConsentInput } from '@/lib/types/artist';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

/**
 * Generate a secure review token for email approval
 */
function generateReviewToken(artistId: string): string {
  const timestamp = Date.now();
  const secret = process.env.REVIEW_TOKEN_SECRET || 'default-secret-change-in-production';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${artistId}:${timestamp}`)
    .digest('hex');

  const tokenData = `${artistId}:${timestamp}:${signature}`;
  return Buffer.from(tokenData).toString('base64url');
}

/**
 * Send email notification to admin for artist review
 */
async function sendAdminReviewEmail(artist: any, parentEmail: string, artworks: any[]) {
  try {
    // Generate review token
    const reviewToken = generateReviewToken(artist.id);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
    const approveUrl = `${baseUrl}/api/little-artists/${artist.id}/review?action=approve&token=${reviewToken}`;
    const rejectUrl = `${baseUrl}/api/little-artists/${artist.id}/review?action=reject&token=${reviewToken}`;

    // Create transporter (use environment variables for email config)
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email content
    const adminEmail = 'kindlewoods@gmail.com';
    const subject = `New Little Artist Ready for Review: ${artist.name}, age ${artist.age || 'N/A'}`;

    // Build artworks HTML
    const artworksHtml = artworks.map(artwork => `
      <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
        <h4 style="margin: 0 0 10px 0; color: #333;">${artwork.character_name || 'Untitled'}</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; font-weight: bold;">ORIGINAL SKETCH</p>
            <img src="${artwork.original_sketch_url}" alt="Original" style="width: 100%; border-radius: 4px; border: 1px solid #ddd;" />
          </div>
          <div>
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; font-weight: bold;">AI TRANSFORMED</p>
            ${artwork.animated_version_url
              ? `<img src="${artwork.animated_version_url}" alt="Transformed" style="width: 100%; border-radius: 4px; border: 1px solid #ddd;" />`
              : `<div style="width: 100%; aspect-ratio: 1; background: #f5f5f5; border-radius: 4px; border: 1px solid #ddd; display: flex; align-items: center; justify-center; color: #999; font-size: 12px;">No transformation</div>`
            }
          </div>
        </div>
        ${artwork.description ? `<p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">${artwork.description}</p>` : ''}
      </div>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 650px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 25px; border-radius: 0 0 10px 10px; }
          .artist-header { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; display: flex; gap: 20px; align-items: center; }
          .artist-photo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #667eea; }
          .artist-info { flex: 1; }
          .info-row { margin: 5px 0; font-size: 14px; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { display: inline-block; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px; font-size: 16px; }
          .button-approve { background: #10b981; color: white; }
          .button-reject { background: #ef4444; color: white; }
          .consent-box { background: white; padding: 15px; border-left: 4px solid #667eea; font-style: italic; margin: 20px 0; border-radius: 4px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🎨 New Little Artist Awaiting Review</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">Review and approve directly from this email</p>
          </div>
          <div class="content">
            <!-- Artist Profile -->
            <div class="artist-header">
              ${artist.profile_photo_url
                ? `<img src="${artist.profile_photo_url}" alt="${artist.name}" class="artist-photo" />`
                : `<div class="artist-photo" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-center; font-size: 40px;">🎨</div>`
              }
              <div class="artist-info">
                <h2 style="margin: 0 0 5px 0; color: #333;">${artist.name}</h2>
                <div class="info-row"><strong>Age:</strong> ${artist.age || 'Not specified'}</div>
                <div class="info-row"><strong>Artworks:</strong> ${artworks.length} uploaded</div>
                <div class="info-row"><strong>Submitted:</strong> ${new Date(artist.parent_consent_date).toLocaleDateString()}</div>
              </div>
            </div>

            ${artist.bio ? `
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;"><strong>Bio:</strong> ${artist.bio}</p>
            </div>
            ` : ''}

            <!-- Consent Statement -->
            <h3 style="color: #333; margin: 25px 0 10px 0;">Parental Consent Statement</h3>
            <div class="consent-box">
              "${artist.parent_consent_text}"
            </div>
            <p style="font-size: 13px; color: #666; margin: 5px 0 20px 0;">
              <strong>Parent Email:</strong> ${parentEmail}
            </p>

            <!-- Artworks -->
            <h3 style="color: #333; margin: 25px 0 10px 0;">Artworks (${artworks.length})</h3>
            ${artworksHtml}

            <!-- Action Buttons -->
            <div class="button-container">
              <a href="${approveUrl}" class="button button-approve">
                ✅ Approve & Publish
              </a>
              <a href="${rejectUrl}" class="button button-reject">
                ❌ Reject
              </a>
            </div>

            <div class="footer">
              <p><strong>KindleWood Studio</strong> - Little Artists Review</p>
              <p>Click the buttons above to approve or reject this artist profile.</p>
              <p style="color: #999; font-size: 11px; margin-top: 15px;">This review link is valid for 30 days.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
New Little Artist Ready for Review

Artist Information:
- Name: ${artist.name}
- Age: ${artist.age || 'Not specified'}
- Artworks: ${artworks.length} uploaded

Parental Consent: "${artist.parent_consent_text}"
Parent Email: ${parentEmail}

To approve or reject, click one of these links:
Approve: ${approveUrl}
Reject: ${rejectUrl}

This review link is valid for 30 days.
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"KindleWood Studio" <noreply@kindlewoodstudio.ai>',
      to: adminEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log('✅ Admin review email sent successfully to:', adminEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send admin review email:', error);
    // Don't fail the whole request if email fails
    return { success: false, error };
  }
}

/**
 * POST /api/little-artists/[id]/consent
 * Record parental consent and notify admin
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: artistId } = await params;

    // 1. Authentication required
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Check ownership
    const { data: artist, error: fetchError } = await supabase
      .from('little_artists')
      .select('*')
      .eq('id', artistId)
      .single();

    if (fetchError || !artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    if (artist.parent_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // 3. Check if already consented
    if (artist.parent_consent_given) {
      return NextResponse.json(
        { error: 'Consent already given' },
        { status: 400 }
      );
    }

    // 4. Parse input
    const body: { consent_text: string } = await request.json();

    if (!body.consent_text || body.consent_text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Consent statement must be at least 10 characters' },
        { status: 400 }
      );
    }

    // 5. Update artist with consent
    const consentDate = new Date().toISOString();
    const { data: updatedArtist, error: updateError } = await supabase
      .from('little_artists')
      .update({
        parent_consent_given: true,
        parent_consent_date: consentDate,
        parent_consent_text: body.consent_text.trim(),
        status: 'pending_review',
        notification_sent_at: consentDate,
      })
      .eq('id', artistId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating artist consent:', updateError);
      return NextResponse.json(
        { error: 'Failed to record consent' },
        { status: 500 }
      );
    }

    // 6. Fetch artworks for email
    const { data: artworks } = await supabase
      .from('artist_artworks')
      .select('*')
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false });

    // 7. Send email notification to admin with artworks
    const emailResult = await sendAdminReviewEmail(
      updatedArtist,
      user.email || 'No email',
      artworks || []
    );

    if (!emailResult.success) {
      console.warn('Email notification failed, but consent was recorded');
    }

    return NextResponse.json({
      success: true,
      artist: updatedArtist,
      message: 'Consent recorded successfully. Artist profile is now pending review.',
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error('Error in POST /api/little-artists/[id]/consent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
