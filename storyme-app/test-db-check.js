const https = require('https');

const url = 'https://qxeiajnmprinwydlozlq.supabase.co/rest/v1/projects?select=*&limit=1';
const options = {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZWlham5tcHJpbnd5ZGxvemxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDM3NzMzMiwiZXhwIjoyMDc1OTUzMzMyfQ.1malSqCJtVm4OsxCXntLAh-6qtwVnLayIdXAlt3Gu3Q',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZWlham5tcHJpbnd5ZGxvemxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDM3NzMzMiwiZXhwIjoyMDc1OTUzMzMyfQ.1malSqCJtVm4OsxCXntLAh-6qtwVnLayIdXAlt3Gu3Q'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    if (projects.length > 0) {
      console.log('\n✅ Database query successful\n');
      console.log('Available columns:', Object.keys(projects[0]).join(', '));
      console.log('\nColumn checks:');
      console.log('  - cover_image_url:', 'cover_image_url' in projects[0] ? '✅ EXISTS' : '❌ MISSING');
      console.log('  - author_name:', 'author_name' in projects[0] ? '✅ EXISTS' : '❌ MISSING');
      console.log('  - author_age:', 'author_age' in projects[0] ? '✅ EXISTS' : '❌ MISSING');
    } else {
      console.log('⚠️ No projects found');
    }
  });
}).on('error', (e) => console.error(e));
