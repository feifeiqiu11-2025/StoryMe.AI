# StoryMe POC - Character Consistency Test

A proof-of-concept application to test character consistency in AI-generated story images using Fal.ai.

## Overview

This POC validates whether Fal.ai can maintain consistent character appearance across multiple story scenes. Users upload a character photo and enter scene descriptions, then the system generates images for each scene while attempting to maintain character consistency.

## Features

- 📸 Character photo upload with drag & drop
- 📝 Story scene script input with validation
- 🎨 AI-powered image generation with character consistency
- 📊 Real-time progress tracking
- ⭐ Rating system for consistency evaluation
- 📥 Download individual or all generated images

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **AI**: Fal.ai (FLUX models with image-to-image)
- **File Upload**: react-dropzone
- **Deployment**: Vercel-ready

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Fal.ai account with API key

### 1. Get Fal.ai API Key

1. Go to https://fal.ai/dashboard
2. Sign up or log in
3. Navigate to "Keys" section
4. Create a new API key
5. Copy the key

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

1. Open `.env.local` file
2. Replace `your_fal_api_key_here` with your actual Fal.ai API key:

```bash
FAL_KEY=your_actual_api_key_here
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload Character Photo**
   - Drag & drop or click to upload a photo
   - Supports JPG, PNG, WEBP (max 10MB)
   - This will be used as the character reference

2. **Enter Story Scenes**
   - Write each scene on a new line
   - 3-15 scenes recommended
   - Click "Load Example Script" for a sample
   - Example:
     ```
     Emma standing in her backyard, looking up at the stars
     Emma in a spaceship cockpit, pressing colorful buttons
     Emma floating in space, waving at Earth below
     ```

3. **Generate Images**
   - Click "Generate Story Images"
   - Wait while images are generated (30-60 seconds per image)
   - View progress in real-time

4. **Review Results**
   - Compare generated images with reference photo
   - Rate each image (👍 Good / 👎 Poor)
   - Download images individually or all at once
   - View consistency score

## Project Structure

```
poc/
├── app/
│   ├── api/
│   │   ├── upload/route.ts          # Image upload endpoint
│   │   └── generate-images/route.ts # Image generation endpoint
│   ├── page.tsx                     # Main POC page
│   └── layout.tsx                   # Root layout
├── components/
│   ├── ImageUpload.tsx              # Character photo upload
│   ├── ScriptInput.tsx              # Scene script input
│   ├── GenerationProgress.tsx       # Progress tracker
│   └── ImageGallery.tsx             # Results display
├── lib/
│   ├── types.ts                     # TypeScript types
│   ├── scene-parser.ts              # Script parsing utilities
│   └── fal-client.ts                # Fal.ai API wrapper
└── public/
    └── uploads/                     # Temporary upload storage
```

## Testing

### Test Cases to Run

1. **Basic Consistency**: Simple 5-scene story with clear actions
2. **Complex Scenes**: Different angles, distances, lighting
3. **Art Styles**: Test different prompting styles
4. **Edge Cases**: Multiple characters, pets, unusual compositions

### Success Metrics

- Character consistency score: Target ≥75%
- Generation time: Target <60 seconds per image
- Error rate: Target <10%
- User satisfaction: Target ≥70% good ratings

## Cost Estimation

Based on Fal.ai pricing:
- Image generation: ~$0.04-0.08 per image
- 5-scene story: ~$0.20-0.40
- 10-scene story: ~$0.40-0.80

## Troubleshooting

### "FAL_KEY environment variable is not set"
- Make sure `.env.local` exists and contains `FAL_KEY=your_key`
- Restart the dev server after adding the key

### Upload not working
- Check that `public/uploads` directory exists
- Verify file size is under 10MB
- Try a different image format

### Generation failing
- Check Fal.ai API key is valid
- Check API credits in Fal.ai dashboard
- Look at console for detailed error messages

### Images look different
- This is expected - the POC tests consistency
- Rate images to document consistency levels
- Try different reference photos
- Adjust prompts in `lib/fal-client.ts`

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variable: `FAL_KEY=your_api_key`
4. Deploy

```bash
# or use Vercel CLI
vercel deploy
```

## Next Steps After POC

Based on results, decide:

1. **If consistency ≥75%**: Proceed with full MVP
2. **If 50-75%**: Try LoRA training approach
3. **If <50%**: Consider pre-made character library

## License

POC for internal evaluation

## Support

For issues or questions:
- Check Fal.ai docs: https://fal.ai/docs
- Review console logs for errors
- Test with sample script first
