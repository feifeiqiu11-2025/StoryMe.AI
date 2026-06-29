import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qxeiajnmprinwydlozlq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZWlham5tcHJpbnd5ZGxvemxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDM3NzMzMiwiZXhwIjoyMDc1OTUzMzMyfQ.1malSqCJtVm4OsxCXntLAh-6qtwVnLayIdXAlt3Gu3Q';

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase.from('projects').select('*').limit(1);

if (error) {
  console.log('Error:', error);
} else if (data && data.length > 0) {
  console.log('✅ Database query successful');
  console.log('\nAvailable columns:', Object.keys(data[0]).join(', '));
  console.log('\nColumn checks:');
  console.log('  - cover_image_url:', 'cover_image_url' in data[0] ? '✅ EXISTS' : '❌ MISSING');
  console.log('  - author_name:', 'author_name' in data[0] ? '✅ EXISTS' : '❌ MISSING');
  console.log('  - author_age:', 'author_age' in data[0] ? '✅ EXISTS' : '❌ MISSING');
} else {
  console.log('⚠️ No projects found in database');
}
