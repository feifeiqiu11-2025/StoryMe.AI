#!/usr/bin/env node

/**
 * Script to run database migration to make scene_id nullable
 * This fixes the issue where quiz audio pages can't be inserted
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client with service role key (has admin privileges)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Running database migration to make scene_id nullable...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20251022_make_scene_id_nullable_in_audio_pages.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n');

    // Execute the ALTER TABLE command
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;'
    });

    if (error) {
      // Try direct SQL execution via REST API
      console.log('⚠️  RPC method not available, trying direct SQL execution...\n');

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          query: 'ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;'
        })
      });

      if (!response.ok) {
        console.error('❌ Migration failed via REST API');
        console.error('Response:', await response.text());
        console.log('\n📋 Please run this SQL manually in Supabase Dashboard → SQL Editor:\n');
        console.log('ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;\n');
        process.exit(1);
      }
    }

    console.log('✅ Migration completed successfully!\n');

    // Verify the change
    console.log('🔍 Verifying schema change...\n');

    const { data: schemaData, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, is_nullable, data_type')
      .eq('table_name', 'story_audio_pages')
      .in('column_name', ['scene_id', 'quiz_question_id', 'page_type']);

    if (schemaError) {
      console.log('⚠️  Could not verify schema (this is OK)');
      console.log('Error:', schemaError.message);
    } else if (schemaData) {
      console.log('Schema verification:');
      console.table(schemaData);
    }

    console.log('\n✅ Database migration complete!');
    console.log('📝 You can now test audio generation - it should create all 6 pages:\n');
    console.log('   1. Cover page');
    console.log('   2. Scene page');
    console.log('   3. Quiz transition');
    console.log('   4-6. Quiz question pages\n');

  } catch (err) {
    console.error('❌ Migration error:', err);
    console.log('\n📋 Please run this SQL manually in Supabase Dashboard → SQL Editor:\n');
    console.log('ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;\n');
    process.exit(1);
  }
}

runMigration();
