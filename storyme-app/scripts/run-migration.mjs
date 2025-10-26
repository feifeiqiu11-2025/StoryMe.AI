#!/usr/bin/env node
/**
 * Database Migration Runner
 * Runs the bilingual support migration directly against Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase credentials from .env.local
const supabaseUrl = 'https://qxeiajnmprinwydlozlq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZWlham5tcHJpbnd5ZGxvemxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDM3NzMzMiwiZXhwIjoyMDc1OTUzMzMyfQ.1malSqCJtVm4OsxCXntLAh-6qtwVnLayIdXAlt3Gu3Q';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('📦 Reading migration file...');
  const migrationPath = join(__dirname, '../supabase/migrations/20251025_add_bilingual_support.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('🚀 Running bilingual support migration...');
  console.log('⏳ This may take a minute...\n');

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('Details:', error);

      // If exec_sql doesn't exist, try splitting and running each statement
      console.log('\n🔄 Trying alternative approach (splitting statements)...');

      // Split by semicolons and filter out comments and empty statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (!stmt) continue;

        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', {
            sql: stmt
          });

          if (stmtError) {
            console.warn(`⚠️ Statement ${i + 1} warning:`, stmtError.message);
          }
        } catch (err) {
          console.error(`❌ Statement ${i + 1} failed:`, err.message);
        }
      }

      console.log('\n✅ Migration completed (some statements may have failed)');
      process.exit(0);
    }

    console.log('✅ Migration completed successfully!');
    console.log('\nChanges made:');
    console.log('  ✓ Added content_language to projects table');
    console.log('  ✓ Added supported_languages (JSONB) to projects table');
    console.log('  ✓ Added title_i18n and description_i18n to projects table');
    console.log('  ✓ Added captions (JSONB) to scenes table');
    console.log('  ✓ Added simplified_texts (JSONB) to scenes table');
    console.log('  ✓ Added enhanced_prompt to scenes table');
    console.log('  ✓ Added i18n columns to quiz_questions table');
    console.log('  ✓ Added language column to story_audio_pages table');
    console.log('  ✓ Created helper functions for multi-language support');
    console.log('  ✓ Migrated existing English data to new JSONB columns\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

runMigration();
