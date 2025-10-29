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
            content: language === 'zh' || language === 'zh-CN' || language === 'zh-TW'
              ? `你是一位专门为3-8岁儿童服务的阅读导师。用简单、有趣、适合年龄的方式解释汉字和词语。`
              : `You are a super fun reading buddy for kids aged 3-8! You explain words in the simplest, most exciting way possible.`
          },
          {
            role: 'user',
            content: language === 'zh' || language === 'zh-CN' || language === 'zh-TW'
              ? `一个${child_age}岁的孩子正在读故事，点击了这个句子中的词语"${word}"：
"${sentence}"

请提供：
1. 简单有趣的解释（1-2句话，用${child_age}岁孩子能懂的语言，要活泼有趣）
2. 一个新的例句（适合${child_age}岁孩子的阅读水平，不要使用故事原句）
3. 一个代表这个词的表情符号

只用JSON格式回复：
{
  "definition": "你的解释",
  "example_sentence": "你的例句",
  "visual_aid_emoji": "表情"
}

让解释简短、有趣，让${child_age}岁的孩子容易理解！`
              : `A ${child_age}-year-old is reading and tapped on "${word}" in this sentence:
"${sentence}"

Create a FUN mini-lesson! Provide:
1. A SHORT, exciting definition (1 sentence max, use simple words a ${child_age}-year-old knows)
2. A fun example sentence (simple and playful, NOT from the story)
3. A perfect emoji for this word

Respond ONLY with valid JSON:
{
  "definition": "your super short definition",
  "example_sentence": "your fun example",
  "visual_aid_emoji": "emoji"
}

Make it SHORT, FUN, and perfect for a ${child_age}-year-old!`
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
