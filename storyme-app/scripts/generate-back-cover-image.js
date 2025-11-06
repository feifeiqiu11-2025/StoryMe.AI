/**
 * Generate a high-quality 8" x 10" back cover image for PDF
 * Uses Puppeteer to render HTML/CSS to PNG
 * Matches landing page design exactly
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images');

// Ensure public/images directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 8" x 10" at 300 DPI for high-quality printing
const WIDTH = 8 * 300;  // 2400px
const HEIGHT = 10 * 300; // 3000px

// Read QR code as base64
const qrCodePath = path.join(PUBLIC_DIR, 'qr-kindlewood-studio.png');
const qrCodeBase64 = fs.readFileSync(qrCodePath).toString('base64');
const qrCodeDataUrl = `data:image/png;base64,${qrCodeBase64}`;

const backCoverHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Arial, sans-serif;
      background: white;
      display: flex;
      flex-direction: column;
    }

    /* Header - 8% */
    .header {
      height: 8%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px;
    }

    .header h1 {
      font-size: 70px;
      font-weight: 700;
      color: #1F2937;
      letter-spacing: 1px;
      text-align: center;
    }

    .gradient-text {
      background: linear-gradient(90deg, #fbbf24, #f59e0b, #ef4444, #ec4899, #8b5cf6, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* QR Section - 15% */
    .qr-section {
      height: 15%;
      background: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 35px;
    }

    .qr-code {
      width: 260px;
      height: 260px;
      margin-bottom: 18px;
    }

    .qr-text {
      font-size: 38px;
      font-weight: 700;
      color: #4F46E5;
      margin-bottom: 8px;
    }

    .qr-url {
      font-size: 30px;
      color: #6B7280;
      font-weight: 600;
    }

    /* Features Section - 67% */
    .features-section {
      height: 67%;
      background: white;
      padding: 35px 130px;
    }

    .features-title {
      font-size: 44px;
      font-weight: 700;
      color: #1F2937;
      text-align: center;
      margin-bottom: 28px;
    }

    .features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 22px;
      height: calc(100% - 80px);
      max-width: 1900px;
      margin: 0 auto;
    }

    /* Match landing page card design exactly */
    .feature-tile {
      background: white;
      border: 2px solid #E0E7FF;
      border-radius: 16px;
      padding: 34px;
      display: flex;
      align-items: flex-start;
      gap: 22px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
    }

    .emoji-box {
      flex-shrink: 0;
      width: 72px;
      height: 72px;
      border-radius: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 42px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .feature-title {
      font-size: 42px;
      font-weight: 700;
      color: #1F2937;
      margin-bottom: 14px;
      line-height: 1.15;
    }

    .feature-description {
      font-size: 38px;
      color: #4B5563;
      line-height: 1.35;
    }

    /* Gradient colors for emoji boxes */
    .pink-gradient { background: linear-gradient(135deg, #f9a8d4 0%, #fb7185 100%); }
    .purple-gradient { background: linear-gradient(135deg, #c084fc 0%, #ec4899 100%); }
    .blue-gradient { background: linear-gradient(135deg, #60a5fa 0%, #22d3ee 100%); }
    .teal-gradient { background: linear-gradient(135deg, #5eead4 0%, #22d3ee 100%); }
    .green-gradient { background: linear-gradient(135deg, #4ade80 0%, #10b981 100%); }
    .orange-gradient { background: linear-gradient(135deg, #fb923c 0%, #ef4444 100%); }
    .indigo-gradient { background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%); }
    .violet-gradient { background: linear-gradient(135deg, #a78bfa 0%, #a855f7 100%); }

    /* Footer - 10% */
    .footer {
      height: 10%;
      background: #F3F4F6;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 25px;
    }

    .footer-text {
      font-size: 24px;
      color: #6B7280;
      margin-bottom: 8px;
    }

    .footer-email {
      font-size: 28px;
      font-weight: 700;
      color: #4F46E5;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>📚 Kindle<span class="gradient-text">Wood</span> Studio ✨</h1>
  </div>

  <!-- QR Code Section -->
  <div class="qr-section">
    <img src="${qrCodeDataUrl}" class="qr-code" alt="QR Code">
    <div class="qr-text">Scan to Learn More</div>
    <div class="qr-url">https://kindlewoodstudio.ai</div>
  </div>

  <!-- Features Section -->
  <div class="features-section">
    <div class="features-title">Why Kids, Families & Educators Love KindleWood Studio</div>
    <div class="features-grid">
      <div class="feature-tile">
        <div class="emoji-box pink-gradient">💖</div>
        <div class="content">
          <div class="feature-title">Your Child Is the Story</div>
          <div class="feature-description">Upload a photo once, and your child becomes the hero of every adventure.</div>
        </div>
      </div>

      <div class="feature-tile">
        <div class="emoji-box purple-gradient">🎤</div>
        <div class="content">
          <div class="feature-title">Real Voices, Real Connection</div>
          <div class="feature-description">Record your own voice to narrate. No AI voice can replace a parent's "once upon a time."</div>
        </div>
      </div>

      <div class="feature-tile">
        <div class="emoji-box blue-gradient">🧠</div>
        <div class="content">
          <div class="feature-title">Fun, Bilingual Learning</div>
          <div class="feature-description">Interactive reading in English and Chinese. Kids tap words, take quizzes, and learn through play.</div>
        </div>
      </div>

      <div class="feature-tile">
        <div class="emoji-box teal-gradient">🌱</div>
        <div class="content">
          <div class="feature-title">Created by Families</div>
          <div class="feature-description">Teachers co-create educational storybooks while parents personalize with family characters.</div>
        </div>
      </div>

      <div class="feature-tile">
        <div class="emoji-box green-gradient">🛡️</div>
        <div class="content">
          <div class="feature-title">Safe, Ad-Free Reading</div>
          <div class="feature-description">No ads or outside links. Your child only sees stories shared by you or trusted teachers.</div>
        </div>
      </div>

      <div class="feature-tile">
        <div class="emoji-box orange-gradient">🏆</div>
        <div class="content">
          <div class="feature-title">Celebrate Progress</div>
          <div class="feature-description">Set goals, earn badges, and celebrate milestones together as your child grows.</div>
        </div>
      </div>

      <div class="feature-tile">
        <div class="emoji-box indigo-gradient">🌍</div>
        <div class="content">
          <div class="feature-title">Stories Everywhere</div>
          <div class="feature-description">Read at home, listen on Spotify, or print as keepsake books for bedtime to car rides.</div>
        </div>
      </div>

      <div class="feature-tile">
        <div class="emoji-box violet-gradient">🌟</div>
        <div class="content">
          <div class="feature-title">Empower Young Authors</div>
          <div class="feature-description">Schools publish classroom collections and inspire confident storytellers in both languages.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-text">© 2025 KindleWood Studio. All rights reserved.</div>
    <div class="footer-email">Admin@KindleWoodStudio.ai</div>
  </div>
</body>
</html>
`;

async function generateBackCoverImage() {
  console.log('\n🎨 Generating back cover image...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set viewport to exact 8" x 10" at 300 DPI
    await page.setViewport({
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
    });

    // Load the HTML content
    await page.setContent(backCoverHTML, {
      waitUntil: 'networkidle0'
    });

    // Generate the screenshot
    const outputPath = path.join(PUBLIC_DIR, 'pdf-back-cover.png');
    await page.screenshot({
      path: outputPath,
      type: 'png',
      fullPage: false,
    });

    console.log('✅ Back cover image generated successfully!');
    console.log(`   Location: ${outputPath}`);
    console.log(`   Size: ${WIDTH}px x ${HEIGHT}px (8" x 10" @ 300 DPI)`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Error generating back cover image:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generateBackCoverImage();
