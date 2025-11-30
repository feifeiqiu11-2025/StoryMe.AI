#!/usr/bin/env node
/**
 * List available Gemini models
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key.trim()] = value;
        }
      }
    });
  } catch (e) {}
}

loadEnvFile(path.join(__dirname, '../../../../.env.local'));

async function main() {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  console.log('📋 Available Gemini Models:\n');

  try {
    // List models using the REST API directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    const data = await response.json();

    if (data.models) {
      const imageModels = data.models.filter(m =>
        m.name.includes('image') ||
        m.name.includes('vision') ||
        m.name.includes('flash') ||
        m.name.includes('pro')
      );

      console.log('Models that might support image generation:\n');
      imageModels.forEach(m => {
        console.log(`  ${m.name}`);
        console.log(`    Display: ${m.displayName}`);
        console.log(`    Methods: ${m.supportedGenerationMethods?.join(', ') || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
