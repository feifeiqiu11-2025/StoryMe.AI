# Chinese Language Support - Implementation Summary

## ✅ Completed So Far

### 1. Database Schema Migration
**File**: `storyme-app/supabase/migrations/20251025_add_bilingual_support.sql`

- ✅ Added `content_language` and `supported_languages` to `projects` table
- ✅ Added `title_i18n` and `description_i18n` JSONB columns for multi-language titles
- ✅ Added `captions` and `simplified_texts` JSONB columns to `scenes` table
- ✅ Added `question_i18n`, `option_*_i18n` JSONB columns to `quiz_questions` table
- ✅ Added `language` column to `story_audio_pages` table
- ✅ Created helper functions: `get_caption()` and `supports_language()`
- ✅ Migrated all existing English data to new JSONB format

**Schema Design**:
- **Scenario 1 (Chinese only)**: `supported_languages: ["zh"]`, captions: `{"zh": "..."}`
- **Scenario 2 (Bilingual)**: `supported_languages: ["en", "zh"]`, captions: `{"en": "...", "zh": "..."}`
- **Future-proof**: Easy to add 3rd+ languages without schema changes

### 2. Studio UI - Language Selection
**File**: `storyme-app/src/app/(dashboard)/create/page.tsx`

- ✅ Added `contentLanguage` state (`'en' | 'zh'`)
- ✅ Created beautiful language selection UI (appears after Step 1: Characters)
- ✅ Two radio button options:
  - 🇺🇸 English Story (default)
  - 🇨🇳 Chinese Story / 中文故事
- ✅ Dynamic hints showing example input based on selected language
- ✅ Bilingual Step 2 heading ("Write Story Scenes / 编写故事场景")
- ✅ Pass `language` parameter to all API calls:
  - `/api/enhance-scenes`
  - `/api/generate-story-metadata`
  - `/api/generate-cover`
  - `/api/generate-quiz-preview`
  - `/api/projects/save`

**Visual Design**:
```
┌────────────────────────────────────────────────────────────┐
│  🌍  Choose Story Language                                  │
├────────────────────────────────────────────────────────────┤
│  Select the language for your story...                     │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐       │
│  │ ○ 🇺🇸 English Story │  │ ● 🇨🇳 Chinese Story  │       │
│  │ Write in English...  │  │ 用中文编写场景...      │       │
│  └──────────────────────┘  └──────────────────────┘       │
│                                                             │
│  💡 Tip: 请用中文描述您的场景。例如："一只兔子..."         │
└────────────────────────────────────────────────────────────┘
```

---

## 🚧 Next Steps (Pending)

### 3. Update `/api/enhance-scenes` - DeepSeek Integration
**File**: `storyme-app/src/app/api/enhance-scenes/route.ts`

**Changes needed**:
```typescript
// Add DeepSeek client
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

export async function POST(request: NextRequest) {
  const { scenes, readingLevel, storyTone, language = 'en', characters } = await request.json();

  // Route to appropriate AI model based on language
  const client = language === 'zh' ? deepseek : openai;
  const model = language === 'zh' ? 'deepseek-chat' : 'gpt-4o';

  // Get language-specific system prompt
  const systemPrompt = getSystemPrompt(language, readingLevel, storyTone);

  // Call AI
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(scenes, characters) }
    ],
    temperature: 0.7
  });

  // Parse response
  return NextResponse.json({
    enhancedScenes,
    model_used: model,
    language
  });
}

function getSystemPrompt(language: 'en' | 'zh', readingLevel: number, tone: string) {
  const ageRange = getAgeRange(readingLevel);

  if (language === 'zh') {
    return `你是专业的儿童故事作家。为${ageRange}岁儿童创作${tone}风格的故事。

要求：
1. 为每个场景生成生动的中文字幕（caption）
2. 生成英文图像提示词（enhanced_prompt）- 用于AI图像生成
3. 使用简单、适龄的中文词汇
4. 保持${tone}的故事风格

返回JSON格式：
{
  "scenes": [
    {
      "sceneNumber": 1,
      "caption": "小兔子在森林里寻找新朋友",
      "enhanced_prompt": "A cute white rabbit hopping through a magical forest, looking around with curious eyes, colorful flowers, children's book illustration style"
    }
  ]
}`;
  } else {
    return `You are a children's storybook expert...` // Existing English prompt
  }
}

function getAgeRange(readingLevel: number): string {
  if (readingLevel <= 4) return '3-4';
  if (readingLevel <= 6) return '5-6';
  return '7-8';
}
```

### 4. Update `/api/generate-story-metadata` - Chinese Titles
**File**: `storyme-app/src/app/api/generate-story-metadata/route.ts`

**Changes needed**:
- Accept `language` parameter
- Route to DeepSeek for Chinese, GPT-4o for English
- Generate Chinese titles like "小兔子找朋友" instead of "Little Rabbit Finds Friends"

### 5. Update `/api/generate-cover` - Chinese Cover Text
**File**: `storyme-app/src/app/api/generate-cover/route.ts`

**Changes needed**:
- Include Chinese title in image prompt when `language === 'zh'`
- Example: `Children's storybook cover with Chinese title "小兔子找朋友" displayed prominently...`

### 6. Update `/api/generate-quiz-preview` - Chinese Quizzes
**File**: `storyme-app/src/app/api/generate-quiz-preview/route.ts`

**Changes needed**:
- Accept `language` parameter
- Route to DeepSeek for Chinese quiz questions
- Chinese prompt example: "基于以下故事，生成3个选择题..."

### 7. Update `/api/projects/save` - Store Language
**File**: `storyme-app/src/app/api/projects/save/route.ts` (or similar)

**Changes needed**:
```typescript
const { contentLanguage, ...rest } = await request.json();

// Save to database
const { data, error } = await supabase
  .from('projects')
  .insert({
    ...projectData,
    content_language: contentLanguage,
    supported_languages: [contentLanguage], // Scenario 1: single language
    title_i18n: { [contentLanguage]: title },
    description_i18n: { [contentLanguage]: description }
  });

// Save scenes with multi-language captions
await supabase.from('scenes').insert(
  scenes.map(scene => ({
    ...scene,
    captions: { [contentLanguage]: scene.caption },
    simplified_texts: { [contentLanguage]: scene.simplified_text },
    enhanced_prompt: scene.enhanced_prompt // Always English
  }))
);

// Save quiz questions with multi-language text
await supabase.from('quiz_questions').insert(
  quizData.map(q => ({
    ...q,
    question_i18n: { [contentLanguage]: q.question },
    option_a_i18n: { [contentLanguage]: q.option_a },
    // ... other options
  }))
);
```

### 8. Audio Generation - Chinese TTS
**File**: `storyme-app/src/app/api/generate-story-audio/route.ts`

**Changes needed**:
- Detect language from project metadata
- Use appropriate voice settings:
  - English: `{ voice: 'nova', speed: 0.85 }`
  - Chinese: `{ voice: 'shimmer', speed: 0.70 }` (or test other voices)
- Store audio with language suffix: `audio/zh/page-1.mp3`

---

## 📦 Environment Setup Required

### DeepSeek API Key
Add to `.env.local` and Vercel:
```bash
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
```

**Get API Key**: https://platform.deepseek.com/

---

## 🧪 Testing Plan

### Scenario 1: Chinese Story End-to-End
1. ✅ Select "Chinese Story / 中文故事"
2. ✅ Write scenes in Chinese: "小兔子在森林里找朋友"
3. ⏳ Click "Enhance Scenes" → DeepSeek generates Chinese captions
4. ⏳ Review captions (all in Chinese)
5. ⏳ Generate images (using English prompts from DeepSeek)
6. ⏳ Generate cover (with Chinese title)
7. ⏳ Generate quiz (Chinese questions)
8. ⏳ Save story → Database stores `content_language: 'zh'`
9. ⏳ View in Flutter app (Chinese captions, Chinese audio)

### Database Validation
```sql
-- Check saved Chinese story
SELECT
  id,
  content_language,
  supported_languages,
  title_i18n,
  description_i18n
FROM projects
WHERE content_language = 'zh'
LIMIT 1;

-- Check Chinese captions
SELECT
  scene_number,
  captions->>'zh' AS chinese_caption,
  enhanced_prompt
FROM scenes
WHERE project_id = 'your-project-uuid';

-- Check Chinese quiz
SELECT
  question_i18n->>'zh' AS chinese_question,
  option_a_i18n->>'zh' AS option_a
FROM quiz_questions
WHERE project_id = 'your-project-uuid';
```

---

## 📊 Cost Comparison

| Language | AI Model    | Cost per Story | Savings |
|----------|-------------|----------------|---------|
| English  | GPT-4o      | $0.42         | -       |
| Chinese  | DeepSeek V3 | $0.08         | 80%     |

**Note**: Verify current DeepSeek pricing at https://platform.deepseek.com/pricing

---

## 🔄 Future: Scenario 2 (Bilingual)

The database schema is already ready for Scenario 2. To enable:

1. Change UI from radio buttons to checkboxes (allow both languages)
2. Call both AI models in parallel:
   - GPT-4o for English captions
   - DeepSeek for Chinese captions
3. Save both to database:
   ```json
   {
     "supported_languages": ["en", "zh"],
     "captions": {
       "en": "Little rabbit was looking for friends",
       "zh": "小兔子在森林里寻找新朋友"
     }
   }
   ```
4. Flutter app displays both captions or toggle button

---

## 📝 Files Modified

1. ✅ `storyme-app/supabase/migrations/20251025_add_bilingual_support.sql` (NEW)
2. ✅ `storyme-app/src/app/(dashboard)/create/page.tsx` (MODIFIED)
3. ⏳ `storyme-app/src/app/api/enhance-scenes/route.ts` (TODO)
4. ⏳ `storyme-app/src/app/api/generate-story-metadata/route.ts` (TODO)
5. ⏳ `storyme-app/src/app/api/generate-cover/route.ts` (TODO)
6. ⏳ `storyme-app/src/app/api/generate-quiz-preview/route.ts` (TODO)
7. ⏳ `storyme-app/src/app/api/projects/save/route.ts` (TODO)
8. ⏳ `storyme-app/src/app/api/generate-story-audio/route.ts` (TODO)

---

## ✅ Ready for Review

The Phase 1 UI is complete and ready for testing. You can now:
1. Run the migration SQL to update the database schema
2. Test the UI locally (language selection appears after adding characters)
3. Provide DeepSeek API key
4. I'll implement the backend API updates

Would you like me to continue with implementing the backend APIs?
