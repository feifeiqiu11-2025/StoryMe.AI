#!/bin/bash
# Setup script for Gemini POC

echo "🔧 Setting up Gemini Image POC..."

# Navigate to project root
cd "$(dirname "$0")/../../../.."

# Install Google Generative AI SDK
echo "📦 Installing @google/generative-ai..."
npm install @google/generative-ai

# Check if GEMINI_API_KEY is set
if grep -q "GEMINI_API_KEY" .env.local 2>/dev/null; then
    echo "✅ GEMINI_API_KEY found in .env.local"
else
    echo "⚠️  GEMINI_API_KEY not found in .env.local"
    echo "   Please add: GEMINI_API_KEY=your_key_here"
    echo "   Get a key from: https://aistudio.google.com/apikey"
fi

# Create test output directory
mkdir -p src/lib/image-providers/poc-gemini/test-output

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Ensure GEMINI_API_KEY is in .env.local"
echo "2. Update test character image URLs in test-gemini.ts"
echo "3. Run: npx ts-node src/lib/image-providers/poc-gemini/test-gemini.ts"
