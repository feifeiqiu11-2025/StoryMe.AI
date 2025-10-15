import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Try to query the character_library table
    const { data, error } = await supabase
      .from('character_library')
      .select('*')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error,
        message: error.code === '42P01'
          ? 'Table does not exist - need to run migration'
          : error.code === '42501'
          ? 'Permission denied - check RLS policies'
          : 'Unknown error'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Table exists and is accessible',
      sampleData: data,
      count: data?.length || 0
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
