// Script to set an artist to pending_review status for testing
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get all artists
  const { data: artists, error } = await supabase
    .from('little_artists')
    .select('id, name, status')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching artists:', error);
    return;
  }

  console.log('\nCurrent artists:');
  artists.forEach((artist, i) => {
    console.log(`${i + 1}. ${artist.name} (${artist.id}) - Status: ${artist.status}`);
  });

  // Set the first artist to pending_review
  if (artists.length > 0) {
    const artistToUpdate = artists[0];
    console.log(`\nSetting ${artistToUpdate.name} to pending_review...`);

    const { error: updateError } = await supabase
      .from('little_artists')
      .update({
        status: 'pending_review',
        submitted_at: new Date().toISOString()
      })
      .eq('id', artistToUpdate.id);

    if (updateError) {
      console.error('Error updating artist:', updateError);
    } else {
      console.log('✅ Artist updated successfully!');
      console.log(`\nYou can now test the review flow at:`);
      console.log(`http://localhost:3001/test-email-review`);
    }
  } else {
    console.log('\nNo artists found in database.');
  }
}

main();
