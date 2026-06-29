const https = require('https');

const url = 'https://qxeiajnmprinwydlozlq.supabase.co/rest/v1/projects?select=id,title,author_name,author_age,cover_image_url,created_at&order=created_at.desc&limit=3';
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
    console.log('\n📊 Last 3 saved projects:\n');
    projects.forEach((p, i) => {
      console.log(`${i + 1}. ${p.title}`);
      console.log(`   Created: ${new Date(p.created_at).toLocaleString()}`);
      console.log(`   Author Name: ${p.author_name || 'NULL'}`);
      console.log(`   Author Age: ${p.author_age || 'NULL'}`);
      console.log(`   Cover URL: ${p.cover_image_url ? '✅ ' + p.cover_image_url.substring(0, 50) + '...' : '❌ NULL'}`);
      console.log('');
    });
  });
}).on('error', (e) => console.error(e));
