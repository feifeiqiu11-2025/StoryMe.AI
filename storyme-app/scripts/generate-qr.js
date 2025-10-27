/**
 * One-time script to generate QR code for KindleWood Studio website
 * Outputs base64 string to embed in PDF back cover
 */

const QRCode = require('qrcode');

const WEBSITE_URL = 'https://kindlewoodstudio.ai';

async function generateQRCode() {
  try {
    // Generate QR code as data URL (base64)
    const qrCodeDataUrl = await QRCode.toDataURL(WEBSITE_URL, {
      errorCorrectionLevel: 'H', // High error correction for printing
      type: 'image/png',
      width: 300, // High resolution for print quality
      margin: 2,
      color: {
        dark: '#1F2937',  // Dark gray for printing
        light: '#FFFFFF'  // White background
      }
    });

    console.log('\n=== QR Code Generated Successfully ===\n');
    console.log('Website URL:', WEBSITE_URL);
    console.log('\nBase64 Data URL (copy this into your component):\n');
    console.log(qrCodeDataUrl);
    console.log('\n=== End of QR Code ===\n');

  } catch (error) {
    console.error('Error generating QR code:', error);
    process.exit(1);
  }
}

generateQRCode();
