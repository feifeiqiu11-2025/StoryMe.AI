# StoryMe POC - Quick Start Guide

## What We Built

A fully functional proof-of-concept to test character consistency in AI-generated story images using Fal.ai.

## Project Location

```
/home/gulbrand/Feifei/StoryMe/poc/
```

## Quick Start (5 minutes)

### 1. Get Fal.ai API Key

```bash
# Go to: https://fal.ai/dashboard
# Sign up (free tier available)
# Navigate to API Keys
# Create and copy your API key
```

### 2. Configure Environment

```bash
cd /home/gulbrand/Feifei/StoryMe/poc
```

Edit `.env.local` and replace the API key:
```bash
FAL_KEY=your_actual_fal_api_key_here
```

### 3. Run the App

```bash
npm run dev
```

Visit: http://localhost:3000

## How to Use

1. **Upload a character photo** (any child photo, illustration, or even a pet)
2. **Enter story scenes** (one per line) or click "Load Example Script"
3. **Click "Generate Story Images"**
4. **Wait 2-5 minutes** for generation (depends on number of scenes)
5. **Rate each image** for consistency (👍/👎)
6. **Review the consistency score**

## What to Test

### Test Case 1: Basic Consistency
```
Emma standing in her backyard looking at the stars
Emma sitting in a spaceship cockpit pressing buttons
Emma floating in space waving at Earth
Emma landing on the moon planting a flag
Emma back home holding a toy spaceship
```

### Test Case 2: Different Angles
```
Child standing facing the camera smiling
Same child from the side looking at a tree
Child from behind walking away
Close-up of child's face laughing
Child far away in a field
```

### Test Case 3: Different Settings
```
Character in a forest
Character at the beach
Character in a city
Character in space
Character underwater
```

## Success Metrics

After testing, evaluate:

- **Consistency Score**: % of good ratings (target: ≥75%)
- **Generation Speed**: Time per image (target: <60s)
- **Quality**: Overall image quality and coherence
- **Error Rate**: Failed generations (target: <10%)

## What's Next?

Based on results:

### If Consistency ≥75% ✅
→ Proceed with full MVP development
→ Add GPT-4 for story text generation
→ Add authentication and database
→ Build subscription system
→ Timeline: 8-12 weeks

### If Consistency 50-75% ⚠️
→ Test LoRA training approach (better consistency)
→ Try different Fal.ai models
→ Adjust prompting strategies
→ Consider hybrid approach

### If Consistency <50% ❌
→ Pivot to pre-made character library
→ Consider alternative AI providers
→ Explore human illustrator + AI hybrid

## Cost Analysis

During POC testing:
- Each image: ~$0.04-0.08
- 5-scene story: ~$0.20-0.40
- 10-scene story: ~$0.40-0.80
- Budget $20-50 for comprehensive testing

## Troubleshooting

**Build fails?**
```bash
npm install
npm run build
```

**Can't upload images?**
```bash
mkdir -p public/uploads
```

**Generation fails?**
- Check Fal.ai API key in `.env.local`
- Verify you have credits in Fal.ai dashboard
- Check console for error messages

**Images don't look consistent?**
- This is what we're testing! Rate them honestly
- Try different reference photos
- Document which types work best

## Project Structure

```
poc/
├── app/
│   ├── api/
│   │   ├── upload/          # Handle image uploads
│   │   └── generate-images/ # Call Fal.ai API
│   └── page.tsx             # Main POC interface
├── components/
│   ├── ImageUpload.tsx      # Drag & drop upload
│   ├── ScriptInput.tsx      # Scene input
│   ├── GenerationProgress.tsx # Progress tracker
│   └── ImageGallery.tsx     # Results display
└── lib/
    ├── fal-client.ts        # Fal.ai integration
    ├── scene-parser.ts      # Parse scenes
    └── types.ts             # TypeScript types
```

## Technical Details

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **AI Provider**: Fal.ai (FLUX model with image-to-image)
- **Deployment Ready**: Vercel-compatible

## Deployment (Optional)

To deploy to Vercel:

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main

# Deploy on Vercel
# 1. Import project at vercel.com
# 2. Add FAL_KEY environment variable
# 3. Deploy
```

## Support & Documentation

- Full README: `/home/gulbrand/Feifei/StoryMe/poc/README.md`
- Fal.ai Docs: https://fal.ai/docs
- Technical Proposal: See previous conversation for full architecture

## Key Decision Points

After running tests, answer:

1. Is character consistency good enough for production?
2. What is the actual cost per story?
3. Is generation speed acceptable for users?
4. What types of characters work best?
5. Should we proceed with this approach?

---

**Ready to test?** Just run `npm run dev` and open http://localhost:3000

Good luck! 🚀
