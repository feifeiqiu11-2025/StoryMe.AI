/**
 * Quick script to check public stories in database
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPublicStories() {
  console.log('Checking for public stories...\n');

  const { data, error } = await supabase
    .from('projects')
    .select('id, title, visibility, status, created_at')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No public stories found');
    return;
  }

  console.log(`Found ${data.length} public stories:\n`);
  data.forEach((story, idx) => {
    console.log(`${idx + 1}. ${story.title}`);
    console.log(`   ID: ${story.id}`);
    console.log(`   Visibility: ${story.visibility}`);
    console.log(`   Status: ${story.status}`);
    console.log(`   Created: ${story.created_at}\n`);
  });
}

checkPublicStories().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
