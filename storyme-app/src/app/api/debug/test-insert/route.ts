import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const testUserId = body.userId || '00000000-0000-0000-0000-000000000000'; // Test UUID

    const supabase = await createClient();

    const testCharacter = {
      user_id: testUserId,
      name: 'Test Character',
      reference_image_url: null,
      reference_image_filename: null,
      hair_color: 'brown',
      skin_tone: 'light',
      clothing: 'blue shirt',
      age: '8 years old',
      other_features: 'Test character for debugging',
    };

    console.log('Attempting to insert:', testCharacter);

    // Try to insert a test character
    const { data, error } = await supabase
      .from('character_library')
      .insert([testCharacter])
      .select();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error,
        hint: error.hint,
        testData: testCharacter
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test character inserted successfully',
      data: data
    });
  } catch (error: any) {
    console.error('Caught error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
