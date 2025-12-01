#!/usr/bin/env node

/**
 * Script to generate PDF back cover image
 * Usage: node scripts/generate-pdf-back-cover.js
 *
 * This generates /public/images/pdf-back-cover.png from the HTML template
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateBackCover() {
  const htmlPath = path.join(__dirname, '../public/images/pdf-back-cover-generator.html');
  const outputPath = path.join(__dirname, '../public/images/pdf-back-cover.png');

  console.log('🎨 Generating PDF back cover image...');
  console.log(`   Source: ${htmlPath}`);
  console.log(`   Output: ${outputPath}`);

  // Check if HTML file exists
  if (!fs.existsSync(htmlPath)) {
    console.error('❌ HTML template not found:', htmlPath);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
  });

  try {
    const page = await browser.newPage();

    // Set viewport to exact A5 dimensions
    await page.setViewport({
      width: 420,
      height: 595,
      deviceScaleFactor: 2, // Higher resolution
    });

    // Navigate to the HTML file
    await page.goto(`file://${htmlPath}`, {
      waitUntil: 'networkidle0',
    });

    // Wait for images to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take screenshot
    await page.screenshot({
      path: outputPath,
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: 420,
        height: 595,
      },
    });

    console.log('✅ Successfully generated:', outputPath);
  } catch (error) {
    console.error('❌ Error generating image:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generateBackCover();
