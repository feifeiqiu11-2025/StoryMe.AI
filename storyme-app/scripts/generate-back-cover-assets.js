/**
 * Generate static assets for PDF back cover
 * 1. QR code for website
 * 2. Feature tiles image (if needed in future)
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const WEBSITE_URL = 'https://kindlewoodstudio.ai';
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images');

// Ensure public/images directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

async function generateAssets() {
  try {
    // Generate QR code as PNG file
    const qrPath = path.join(PUBLIC_DIR, 'qr-kindlewood-studio.png');
    await QRCode.toFile(qrPath, WEBSITE_URL, {
      errorCorrectionLevel: 'H', // High error correction for printing
      type: 'png',
      width: 300, // High resolution for print quality
      margin: 2,
      color: {
        dark: '#1F2937',  // Dark gray for printing
        light: '#FFFFFF'  // White background
      }
    });

    console.log('\n✅ QR Code generated successfully!');
    console.log('   Location:', qrPath);
    console.log('   URL:', WEBSITE_URL);
    console.log('\n');

  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

generateAssets();
