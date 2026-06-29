#!/bin/bash

# Simple script to run the database migration using Supabase SQL API
# This makes scene_id nullable so quiz audio pages can be inserted

set -e

# Load environment variables
source .env.local 2>/dev/null || true

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_KEY" ]; then
  echo "❌ Missing Supabase credentials"
  echo "Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

echo "🔄 Running database migration..."
echo ""
echo "SQL Command:"
echo "ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;"
echo ""

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|\.supabase\.co||')

# Run the migration using Supabase SQL API
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;"
  }'

echo ""
echo "✅ Migration command sent!"
echo ""
echo "If the above command didn't work, please run this SQL manually in Supabase Dashboard:"
echo "https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
echo ""
echo "SQL to run:"
echo "ALTER TABLE story_audio_pages ALTER COLUMN scene_id DROP NOT NULL;"
echo ""
