/**
 * Character Image Analysis API
 *
 * Uses OpenAI GPT-4 Vision to analyze uploaded character images
 * and extract character description details.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    console.log('Analyzing character image...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      temperature: 0.3, // Lower temperature for more consistent analysis
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing images of people and characters for children's storybooks.
Analyze the image and extract specific physical characteristics.
Return ONLY a JSON object with these exact fields:
{
  "hairColor": "description of hair color",
  "skinTone": "description of skin tone",
  "age": "approximate age or age range",
  "clothing": "description of clothing",
  "otherFeatures": "any other notable features like glasses, accessories, facial features"
}

Be specific and descriptive. If you're unsure about something, make your best estimation.
Do not include any explanatory text, only the JSON object.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this character image and provide a detailed physical description suitable for a children\'s storybook character.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'low' // Use low detail for faster processing
              }
            }
          ]
        }
      ]
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('AI Analysis Response:', content);

    // Parse the JSON response
    try {
      // Extract JSON from the response (sometimes AI adds extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const requiredFields = ['hairColor', 'skinTone', 'age', 'clothing', 'otherFeatures'];
      const missingFields = requiredFields.filter(field => !analysis[field]);

      if (missingFields.length > 0) {
        console.warn('Missing fields in analysis:', missingFields);
        // Fill in missing fields with defaults
        missingFields.forEach(field => {
          analysis[field] = '';
        });
      }

      console.log('✓ Character analysis complete:', analysis);

      return NextResponse.json({
        success: true,
        analysis
      });

    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content);

      // Return a fallback response
      return NextResponse.json({
        success: true,
        analysis: {
          hairColor: '',
          skinTone: '',
          age: '',
          clothing: '',
          otherFeatures: 'Unable to analyze automatically. Please enter details manually.'
        }
      });
    }

  } catch (error: any) {
    console.error('Character image analysis error:', error);

    // Handle specific OpenAI errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'OpenAI API key is invalid or missing' },
        { status: 500 }
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }

    if (error.code === 'invalid_image_url') {
      return NextResponse.json(
        { error: 'Invalid image URL. Please upload a valid image.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
