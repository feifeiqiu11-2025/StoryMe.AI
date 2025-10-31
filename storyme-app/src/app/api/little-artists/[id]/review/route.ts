/**
 * Artist Review API Route
 * GET /api/little-artists/[id]/review?action=approve&token=xxx
 *
 * Handles admin approval/rejection from email links
 * No authentication required - uses signed token for security
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * Verify review token
 */
function verifyReviewToken(token: string, artistId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [tokenArtistId, timestamp, signature] = decoded.split(':');

    // Check if artist ID matches
    if (tokenArtistId !== artistId) {
      console.error('Token artist ID mismatch');
      return false;
    }

    // Check if token is expired (30 days)
    const tokenAge = Date.now() - parseInt(timestamp);
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    if (tokenAge > thirtyDaysInMs) {
      console.error('Token expired');
      return false;
    }

    // Verify signature
    const secret = process.env.REVIEW_TOKEN_SECRET || 'default-secret-change-in-production';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${tokenArtistId}:${timestamp}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid token signature');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}

/**
 * Generate HTML success/error page
 */
function generateResponsePage(success: boolean, action: string, artistName: string, message?: string) {
  const statusColor = success ? '#10b981' : '#ef4444';
  const statusIcon = success ? '✅' : '❌';
  const statusText = success
    ? (action === 'approve' ? 'Approved Successfully!' : 'Rejected Successfully!')
    : 'Error';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${statusText}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          border-radius: 16px;
          padding: 48px;
          max-width: 500px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .icon {
          font-size: 72px;
          margin-bottom: 24px;
        }
        h1 {
          color: ${statusColor};
          margin: 0 0 16px 0;
          font-size: 32px;
        }
        p {
          color: #666;
          font-size: 18px;
          line-height: 1.6;
          margin: 0 0 32px 0;
        }
        .artist-name {
          font-weight: bold;
          color: #333;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 14px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">${statusIcon}</div>
        <h1>${statusText}</h1>
        <p>
          ${success
            ? `Artist profile <span class="artist-name">${artistName}</span> has been ${action === 'approve' ? 'approved and published' : 'rejected'}.`
            : (message || 'An error occurred. Please try again or contact support.')
          }
        </p>
        ${success && action === 'approve' ? `
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007'}/little-artists" class="button">
          View Little Artists
        </a>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}

/**
 * GET /api/little-artists/[id]/review?action=approve&token=xxx
 * Handle admin review action from email
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: artistId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const token = searchParams.get('token');

    // Validate parameters
    if (!action || !token) {
      return new NextResponse(
        generateResponsePage(false, action || '', '', 'Missing action or token parameter'),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return new NextResponse(
        generateResponsePage(false, action, '', 'Invalid action. Must be "approve" or "reject"'),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Verify token (allow mock tokens in development)
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Decode base64url to check if it's a mock token
    let isMockToken = false;
    let tokenArtistId = '';

    try {
      // Convert base64url back to base64
      let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      while (base64.length % 4) {
        base64 += '=';
      }
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      isMockToken = decoded.includes(':mock');
      tokenArtistId = decoded.split(':')[0];
    } catch (error) {
      console.error('Error decoding token:', error);
      return new NextResponse(
        generateResponsePage(false, action, '', 'Invalid review link format.'),
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // For mock tokens in development, just verify artist ID matches
    if (isMockToken && isDevelopment) {
      if (tokenArtistId !== artistId) {
        return new NextResponse(
          generateResponsePage(false, action, '', 'Invalid review link - artist ID mismatch.'),
          { status: 403, headers: { 'Content-Type': 'text/html' } }
        );
      }
      // Mock token is valid for development
    } else if (!isMockToken) {
      // Production token - verify signature
      if (!verifyReviewToken(token, artistId)) {
        return new NextResponse(
          generateResponsePage(false, action, '', 'Invalid or expired review link. Please contact support.'),
          { status: 403, headers: { 'Content-Type': 'text/html' } }
        );
      }
    } else {
      // Mock token in production - reject
      return new NextResponse(
        generateResponsePage(false, action, '', 'Mock tokens are not allowed in production.'),
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Fetch artist
    const { data: artist, error: fetchError } = await supabase
      .from('little_artists')
      .select('*')
      .eq('id', artistId)
      .single();

    if (fetchError || !artist) {
      return new NextResponse(
        generateResponsePage(false, action, '', 'Artist profile not found'),
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Check if already reviewed
    if (artist.status !== 'pending_review') {
      return new NextResponse(
        generateResponsePage(
          false,
          action,
          artist.name,
          `This artist profile has already been reviewed (current status: ${artist.status})`
        ),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Update artist status
    const newStatus = action === 'approve' ? 'published' : 'archived';
    const { error: updateError } = await supabase
      .from('little_artists')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'admin-email',
        published_at: action === 'approve' ? new Date().toISOString() : null,
      })
      .eq('id', artistId);

    if (updateError) {
      console.error('Error updating artist:', updateError);
      return new NextResponse(
        generateResponsePage(false, action, artist.name, 'Failed to update artist status'),
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // If approved, update character_library entries to make them public
    if (action === 'approve') {
      const { error: libraryError } = await supabase
        .from('character_library')
        .update({ is_public: true })
        .eq('artist_id', artistId)
        .eq('source_type', 'artist_community');

      if (libraryError) {
        console.error('Error updating character library:', libraryError);
        // Don't fail the whole request, just log
      }

      // Also update artwork status to published
      await supabase
        .from('artist_artworks')
        .update({ status: 'published' })
        .eq('artist_id', artistId);
    }

    // Return success page
    return new NextResponse(
      generateResponsePage(true, action, artist.name),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error in GET /api/little-artists/[id]/review:', error);
    return new NextResponse(
      generateResponsePage(false, '', '', 'Internal server error'),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
