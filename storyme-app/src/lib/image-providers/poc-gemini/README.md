# Gemini Image Generation POC

## Purpose
Validate Google Gemini 3 Pro Image API for character-consistent story image generation.

## Key Features to Test
1. **Multi-character consistency** - Can we pass Connor + Carter reference photos and get consistent output?
2. **Human-animal separation** - Does Gemini avoid hybrid creatures when humans interact with animals?
3. **Art style consistency** - Can we maintain children's book illustration style across scenes?
4. **Cost/performance** - Is $0.039/image acceptable? What's the latency?

## Test Scenarios
1. Single character (Connor) in different scenes
2. Two characters (Connor + Carter) in same scene
3. Characters with animals (zoo scene)
4. Multiple scenes for a short story (5 scenes)

## Success Criteria
- [ ] Character faces/features remain recognizable across scenes
- [ ] Clothing stays consistent (as defined in character description)
- [ ] No human-animal hybrid issues
- [ ] Generation time < 30 seconds per image
- [ ] Cost is predictable and within budget

## Setup
1. Get Gemini API key from https://aistudio.google.com/apikey
2. Add to `.env.local`: `GEMINI_API_KEY=your_key_here`
3. Run test: `npx ts-node src/lib/image-providers/poc-gemini/test-gemini.ts`

## Decision Matrix
| Outcome | Action |
|---------|--------|
| All criteria pass | Integrate Gemini as primary provider |
| Partial pass (consistency good, cost high) | Use Gemini for multi-char scenes only |
| Consistency issues | Try Ideogram Character instead |
| API issues (rate limits, errors) | Stay with improved FLUX LoRA |
