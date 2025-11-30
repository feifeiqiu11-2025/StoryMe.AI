#!/usr/bin/env node

/**
 * Script to run database migration to add animated_preview_url column
 * This adds support for storing Gemini-generated 3D character previews
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env.local
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex);
          let value = trimmed.substring(eqIndex + 1);
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (err) {
    console.log('Could not load .env.local:', err.message);
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('\nPlease run this SQL manually in Supabase Dashboard → SQL Editor:');
  console.log('\nALTER TABLE character_library ADD COLUMN IF NOT EXISTS animated_preview_url TEXT;\n');
  process.exit(1);
}

// Create Supabase client with service role key (has admin privileges)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Running database migration to add animated_preview_url column...\n');

  const migrationSQL = 'ALTER TABLE character_library ADD COLUMN IF NOT EXISTS animated_preview_url TEXT;';

  console.log('📄 Migration SQL:');
  console.log(migrationSQL);
  console.log('\n');

  try {
    // Try using the SQL Editor API endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'OPTIONS',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      }
    });

    // For Supabase, we need to run DDL commands through the dashboard
    // or use the database connection directly
    console.log('⚠️  Supabase REST API does not support DDL (ALTER TABLE) commands directly.\n');
    console.log('📋 Please run this SQL manually in Supabase Dashboard:\n');

    // Extract project ref from URL
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    console.log(`   Dashboard URL: https://supabase.com/dashboard/project/${projectRef}/sql\n`);
    console.log('   SQL to run:');
    console.log('   ----------------------------------------');
    console.log('   ALTER TABLE character_library');
    console.log('   ADD COLUMN IF NOT EXISTS animated_preview_url TEXT;');
    console.log('   ----------------------------------------\n');

    // Try to verify if the column already exists
    console.log('🔍 Checking if column already exists...\n');

    const { data, error } = await supabase
      .from('character_library')
      .select('animated_preview_url')
      .limit(1);

    if (error) {
      if (error.message.includes('animated_preview_url')) {
        console.log('❌ Column does NOT exist yet. Please run the SQL above.\n');
      } else {
        console.log('⚠️  Could not verify column existence:', error.message);
      }
    } else {
      console.log('✅ Column already exists! No migration needed.\n');
    }

  } catch (err) {
    console.error('Error:', err.message);
    console.log('\n📋 Please run this SQL manually in Supabase Dashboard:\n');
    console.log('ALTER TABLE character_library ADD COLUMN IF NOT EXISTS animated_preview_url TEXT;\n');
  }
}

runMigration();
