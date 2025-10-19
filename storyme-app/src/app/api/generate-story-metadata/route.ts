/**
 * Generate Story Metadata API
 * Uses Claude AI to generate a compelling title and description for a story
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { script, readingLevel, storyTone, characterNames } = await request.json();

    if (!script) {
      return NextResponse.json(
        { error: 'Story script is required' },
        { status: 400 }
      );
    }

    console.log('🎨 Generating story metadata with AI...');

    // Build the prompt for Claude
    const prompt = `You are a creative children's book editor. Based on the following story, generate a catchy, age-appropriate title and a brief description.

Story Details:
- Reading Age: ${readingLevel || 5} years old
- Story Tone: ${storyTone || 'playful'}
- Characters: ${characterNames?.join(', ') || 'Unknown'}

Story Script:
${script}

Please generate:
1. A catchy, memorable title (3-8 words) that captures the essence of the story
2. A brief, engaging description (1-2 sentences, 20-40 words) that would entice a parent or child to read the story

Format your response as JSON:
{
  "title": "The proposed title",
  "description": "The brief description"
}

Important:
- Make the title exciting and age-appropriate for ${readingLevel}-year-olds
- The description should highlight the main adventure or theme
- Keep it simple and fun
- Do NOT use quotation marks in the title or description`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.8,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract the response
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    console.log('Raw AI response:', responseText);

    // Parse the JSON response
    let metadata;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback: extract title and description manually
      const titleMatch = responseText.match(/"title":\s*"([^"]+)"/);
      const descMatch = responseText.match(/"description":\s*"([^"]+)"/);

      metadata = {
        title: titleMatch ? titleMatch[1] : 'My Amazing Story',
        description: descMatch ? descMatch[1] : 'A wonderful adventure awaits!',
      };
    }

    console.log('✅ Generated metadata:', metadata);

    return NextResponse.json({
      title: metadata.title || 'My Amazing Story',
      description: metadata.description || 'A wonderful adventure awaits!',
    });

  } catch (error) {
    console.error('Error generating story metadata:', error);

    // Return fallback values instead of error
    return NextResponse.json({
      title: 'My Amazing Story',
      description: 'A wonderful adventure full of fun and excitement!',
      warning: 'AI generation failed, using default values',
    });
  }
}
