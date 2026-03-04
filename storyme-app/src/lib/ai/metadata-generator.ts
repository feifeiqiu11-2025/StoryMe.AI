/**
 * Story Metadata Generator
 * Reusable function to generate title and description for stories
 * Extracted from /api/generate-story-metadata for reuse in /api/enhance-scenes
 */

import { getModelForLanguage, logModelUsage } from './deepseek-client';

export interface StoryMetadataInput {
  script: string;
  readingLevel?: number;
  storyTone?: string;
  characterNames?: string[];
  language?: 'en' | 'zh';
}

export interface StoryMetadata {
  title: string;
  description: string;
}

/**
 * Generate story title and description using AI
 * @param input - Story context for metadata generation
 * @returns Promise with title and description
 */
export async function generateStoryMetadata(
  input: StoryMetadataInput
): Promise<StoryMetadata> {
  const {
    script,
    readingLevel = 5,
    storyTone = 'playful',
    characterNames = [],
    language = 'en'
  } = input;

  if (!script || !script.trim()) {
    throw new Error('Story script is required for metadata generation');
  }

  console.log(`🎨 Generating story metadata with AI (language: ${language})...`);

  // Get appropriate AI model for language
  const { client, model } = getModelForLanguage(language);

  // Build the prompt based on language
  const prompt = language === 'zh'
    ? `你是一位富有创意的儿童图书编辑。根据以下故事，生成一个独特的、适合年龄的标题和简短描述。

故事详情：
- 阅读年龄：${readingLevel} 岁
- 故事基调：${storyTone}
- 角色：${characterNames.join('、') || '未知'}

故事脚本：
${script}

请生成：
1. 一个独特、令人难忘的标题（3-8个字）
2. 一个简短、引人入胜的描述（1-2句话，20-40个字）

标题创作要求：
- 先找出这个故事里最独特的元素：一个关键物品、一个转折点、一个特别的地方、一种情感，或一个只有这个故事才有的细节
- 围绕这个独特元素来构建标题，而不是用通用的描述
- 每次变换不同的标题风格，例如：
  * 故事中的关键物品或地点（如"月亮上的小花园"）
  * 角色的独特特征或情感（如"最勇敢的小蜗牛"）
  * 故事的转折点或悬念（如"当星星掉进了池塘"）
  * 有趣的画面或场景（如"穿雨靴的猫"）
- 避免每次都用"XX的冒险"、"XX的旅程"这类套路
- 适合${readingLevel}岁的孩子
- 标题和描述中不要使用引号

仅以这种确切格式的JSON对象响应：
{"title": "建议的标题", "description": "简短的描述"}`
    : `You are a creative children's book editor. Based on the following story, generate a unique, age-appropriate title and a brief description.

Story Details:
- Reading Age: ${readingLevel} years old
- Story Tone: ${storyTone}
- Characters: ${characterNames.join(', ') || 'Unknown'}

Story Script:
${script}

Please generate:
1. A unique, memorable title (3-8 words) rooted in what makes THIS story specific
2. A brief, engaging description (1-2 sentences, 20-40 words) that would entice a parent or child to read the story

How to create the title:
- First, identify what is SPECIFIC and UNIQUE to this story: a key object, a turning point, a special place, an emotion, or a detail that only this story has
- Build the title around that specific element, not around a generic theme
- Vary the title style each time. Consider approaches like:
  * A key object or place from the story (e.g., "The Moonlit Treehouse", "Green Eggs and Ham")
  * A character's unique trait or feeling (e.g., "The Very Hungry Caterpillar", "Curious George")
  * The story's turning point or a surprising moment (e.g., "When the Stars Fell into the Pond")
  * A vivid image or scene (e.g., "Cloudy with a Chance of Meatballs", "The Snowy Day")
  * A playful question or phrase (e.g., "If You Give a Mouse a Cookie", "Where the Wild Things Are")
- The title should make you curious about THIS story — it should NOT sound like it could be about any children's story
- Do NOT always fall back on "[Name]'s Adventure" or "[Name]'s Quest" patterns
- Age-appropriate for ${readingLevel}-year-olds
- Do NOT use quotation marks in the title or description

Respond with ONLY a JSON object in this exact format:
{"title": "The proposed title", "description": "The brief description"}`;

  const systemMessage = language === 'zh'
    ? '你是一位富有创意的儿童图书编辑，生成吸引人的标题和描述。始终只返回有效的JSON。'
    : 'You are a creative children\'s book editor who generates catchy titles and descriptions. Always respond with valid JSON only.';

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: systemMessage,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.8,
  });

  const responseText = completion.choices[0].message.content || '';
  console.log('Raw AI response:', responseText);

  // Log model usage
  logModelUsage(language, model, completion.usage);

  // Parse the JSON response
  let metadata: StoryMetadata;
  try {
    metadata = JSON.parse(responseText);
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

  return {
    title: metadata.title || 'My Amazing Story',
    description: metadata.description || 'A wonderful adventure awaits!',
  };
}
