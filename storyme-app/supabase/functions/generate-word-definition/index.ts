import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

interface WordDefinitionRequest {
  word: string
  sentence: string
  child_age: number
  language: string
}

interface WordDefinitionResponse {
  word: string
  language: string
  definition: string
  example_sentence: string
  visual_aid_emoji?: string
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { word, sentence, child_age, language }: WordDefinitionRequest = await req.json()

    if (!word || !sentence || !child_age) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: word, sentence, child_age' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating definition for word: "${word}" (age ${child_age})`)

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful reading tutor for young children. You explain words in a simple, fun, and age-appropriate way.`
          },
          {
            role: 'user',
            content: `A ${child_age}-year-old child is reading a story and tapped on the word "${word}" in this sentence:
"${sentence}"

Please provide:
1. A simple, age-appropriate definition (2-3 short sentences that a ${child_age}-year-old can understand)
2. A new example sentence using the word (at a ${child_age}-year-old reading level, NOT the same sentence from the story)
3. A single emoji that represents the word

Respond ONLY with valid JSON in this exact format:
{
  "definition": "your definition here",
  "example_sentence": "your example here",
  "visual_aid_emoji": "emoji"
}

Make it fun, friendly, and easy for a ${child_age}-year-old to understand!`
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const aiContent = openaiData.choices[0].message.content

    // Parse AI response (extract JSON)
    let aiResponse: { definition: string; example_sentence: string; visual_aid_emoji?: string }

    try {
      // Try to parse as direct JSON
      aiResponse = JSON.parse(aiContent)
    } catch {
      // Extract JSON from markdown code blocks if needed
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || aiContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[1] || jsonMatch[0])
      } else {
        throw new Error('Failed to parse AI response')
      }
    }

    const response: WordDefinitionResponse = {
      word: word.toLowerCase(),
      language: language || 'en',
      definition: aiResponse.definition,
      example_sentence: aiResponse.example_sentence,
      visual_aid_emoji: aiResponse.visual_aid_emoji || '📖',
    }

    console.log(`Successfully generated definition for: ${word}`)

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    console.error('Error generating word definition:', error)

    // Return fallback definition
    const { word, language } = await req.json().catch(() => ({ word: 'unknown', language: 'en' }))

    return new Response(
      JSON.stringify({
        word: word?.toLowerCase() || 'unknown',
        language: language || 'en',
        definition: `This is a special word! Ask an adult to help explain what "${word}" means.`,
        example_sentence: `Try using the word "${word}" in your own sentence!`,
        visual_aid_emoji: '📖',
      }),
      {
        status: 200, // Return 200 with fallback instead of error
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
