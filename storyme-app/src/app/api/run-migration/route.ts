/**
 * API Route: Run Database Migration
 * POST /api/run-migration
 *
 * Runs the migration to make scene_id nullable in story_audio_pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated (optional - you can remove this for one-time migration)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Running migration: Make scene_id nullable in story_audio_pages');

    // Run the migration SQL
    const { data, error } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;'
    });

    if (error) {
      console.error('❌ Migration failed:', error);

      // Return helpful error message
      return NextResponse.json({
        success: false,
        error: 'Migration failed',
        details: error.message,
        instructions: [
          'Please run this SQL manually in Supabase Dashboard → SQL Editor:',
          '',
          'ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;',
          '',
          'Dashboard URL: https://supabase.com/dashboard/project/qxeiajnmprinwydlozlq/sql'
        ].join('\n')
      }, { status: 500 });
    }

    console.log('✅ Migration completed successfully');

    // Verify the change by checking the schema
    const { data: schemaData, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, is_nullable, data_type')
      .eq('table_name', 'story_audio_pages')
      .in('column_name', ['scene_id', 'quiz_question_id', 'page_type']);

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully!',
      details: 'scene_id is now nullable in story_audio_pages table',
      schema: schemaData || 'Could not verify schema',
      nextSteps: [
        'You can now test audio generation',
        'It should create all 6 pages:',
        '  1. Cover page',
        '  2. Scene page',
        '  3. Quiz transition',
        '  4-6. Quiz question pages'
      ]
    });

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error.message,
      instructions: [
        'Please run this SQL manually in Supabase Dashboard → SQL Editor:',
        '',
        'ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;',
        '',
        'Dashboard URL: https://supabase.com/dashboard/project/qxeiajnmprinwydlozlq/sql'
      ].join('\n')
    }, { status: 500 });
  }
}
