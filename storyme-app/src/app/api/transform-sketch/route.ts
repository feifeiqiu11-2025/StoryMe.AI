/**
 * Sketch Transformation API
 * POST /api/transform-sketch
 *
 * Transforms a child's sketch into an animated character using AI
 * Premium feature for Little Artists
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transformSketchToCharacter } from '@/lib/fal-client';
import { TransformationStyle } from '@/lib/types/artist';

export const maxDuration = 300; // 5 minutes timeout for transformation

interface TransformSketchRequest {
  artworkId: string; // The artwork record to update
  imageUrl: string; // Sketch image URL
  characterName?: string;
  style: TransformationStyle;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authentication required
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Check premium subscription
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to verify subscription' },
        { status: 500 }
      );
    }

    if (!['basic', 'premium', 'team'].includes(userData.subscription_tier)) {
      return NextResponse.json(
        {
          error: 'Premium subscription required',
          message: 'Little Artists feature is available for premium subscribers only',
          upgradeUrl: '/upgrade',
        },
        { status: 403 }
      );
    }

    // 3. Parse and validate request
    const body: TransformSketchRequest = await request.json();

    if (!body.artworkId || !body.imageUrl || !body.style) {
      return NextResponse.json(
        { error: 'Missing required fields: artworkId, imageUrl, style' },
        { status: 400 }
      );
    }

    const validStyles: TransformationStyle[] = ['sketch-to-character', 'cartoon', 'watercolor', 'realistic'];
    if (!validStyles.includes(body.style)) {
      return NextResponse.json(
        { error: 'Invalid transformation style' },
        { status: 400 }
      );
    }

    // 4. Fetch artwork and verify ownership
    const { data: artwork, error: artworkError } = await supabase
      .from('artist_artworks')
      .select(`
        *,
        little_artists!inner(parent_user_id)
      `)
      .eq('id', body.artworkId)
      .single();

    if (artworkError || !artwork) {
      return NextResponse.json(
        { error: 'Artwork not found' },
        { status: 404 }
      );
    }

    // Check ownership via artist's parent_user_id
    if (artwork.little_artists.parent_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // 5. Update status to processing
    await supabase
      .from('artist_artworks')
      .update({ status: 'processing' })
      .eq('id', body.artworkId);

    console.log('🎨 Starting sketch transformation...');
    console.log('  Artwork ID:', body.artworkId);
    console.log('  Style:', body.style);
    console.log('  Character Name:', body.characterName || 'Not specified');

    // 6. Transform sketch using FAL.ai
    let transformResult;
    try {
      transformResult = await transformSketchToCharacter({
        sketchImageUrl: body.imageUrl,
        characterName: body.characterName || 'character',
        style: body.style,
        preserveSketchStyle: body.style === 'sketch-to-character',
      });

      console.log('✅ Sketch transformation successful!');
      console.log('  Generation time:', transformResult.generationTime, 'seconds');
      console.log('  Image URL:', transformResult.imageUrl);
    } catch (transformError) {
      console.error('❌ Sketch transformation failed:', transformError);

      // Update artwork with error
      await supabase
        .from('artist_artworks')
        .update({
          status: 'draft',
          error_message: transformError instanceof Error ? transformError.message : 'Transformation failed',
        })
        .eq('id', body.artworkId);

      return NextResponse.json(
        {
          error: 'Sketch transformation failed',
          message: transformError instanceof Error ? transformError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // 7. Update artwork with transformed image
    const generationTimeMs = Math.round(transformResult.generationTime * 1000);
    const estimatedCost = 0.05; // Rough estimate for sketch transformation

    const { data: updatedArtwork, error: updateError } = await supabase
      .from('artist_artworks')
      .update({
        animated_version_url: transformResult.imageUrl,
        animated_version_filename: `transformed_${Date.now()}.jpg`,
        ai_prompt_used: transformResult.prompt,
        generation_time_ms: generationTimeMs,
        cost_usd: estimatedCost,
        status: 'draft', // Parent can review before publishing
        error_message: null,
      })
      .eq('id', body.artworkId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating artwork:', updateError);
      return NextResponse.json(
        { error: 'Failed to save transformed image' },
        { status: 500 }
      );
    }

    const totalTime = (Date.now() - startTime) / 1000;
    console.log('🎉 Sketch transformation complete!');
    console.log('  Total time:', totalTime, 'seconds');

    return NextResponse.json({
      success: true,
      artwork: updatedArtwork,
      transformedImageUrl: transformResult.imageUrl,
      generationTime: transformResult.generationTime,
      message: 'Sketch transformed successfully!',
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/transform-sketch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
