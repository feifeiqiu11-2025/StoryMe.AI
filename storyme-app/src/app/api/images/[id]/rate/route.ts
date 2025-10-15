import { NextRequest, NextResponse } from 'next/server';

interface RatingPayload {
  overallRating: number;
  ratingFeedback?: string;
}

// POST /api/images/[id]/rate
// Save or update overall scene rating
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const imageId = params.id;
    const body: RatingPayload = await request.json();

    const { overallRating, ratingFeedback } = body;

    // Validate rating
    if (!overallRating) {
      return NextResponse.json(
        { error: 'Overall rating is required' },
        { status: 400 }
      );
    }

    if (overallRating < 1 || overallRating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // TODO: Replace with actual database update when Supabase is connected
    // For now, we'll store in memory (POC mode)
    // In production, this would be:
    // await supabase
    //   .from('generated_images')
    //   .update({
    //     overall_rating: overallRating,
    //     rating_feedback: ratingFeedback,
    //     rated_at: new Date().toISOString(),
    //   })
    //   .eq('id', imageId);

    console.log(`[Rating API] Image ${imageId} rated:`, {
      overallRating,
      ratingFeedback,
    });

    return NextResponse.json({
      success: true,
      message: 'Rating saved successfully',
      imageId,
      ratings: {
        overallRating,
        ratingFeedback,
        ratedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Rating API] Error saving rating:', error);
    return NextResponse.json(
      { error: 'Failed to save rating' },
      { status: 500 }
    );
  }
}

// GET /api/images/[id]/rate
// Retrieve rating for a specific image
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const imageId = params.id;

    // TODO: Replace with actual database query when Supabase is connected
    // For now, return placeholder
    // In production, this would be:
    // const { data, error } = await supabase
    //   .from('generated_images')
    //   .select('overall_rating, rating_feedback, rated_at')
    //   .eq('id', imageId)
    //   .single();

    return NextResponse.json({
      imageId,
      ratings: null, // Will be populated from database
    });
  } catch (error) {
    console.error('[Rating API] Error fetching rating:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rating' },
      { status: 500 }
    );
  }
}
