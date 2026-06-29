# Quiz Audio Integration - Implementation Summary

## Overview
Quiz audio is now automatically generated together with story audio. When a user clicks "Generate Audio" for a story that has quiz questions, the system generates:
1. **Story audio** (cover + all scenes)
2. **Transition audio** ("Let's see if our little readers and listeners are paying attention!")
3. **Quiz audio** (all questions with options A, B, C, D)

---

## User Experience

### Before Quiz Integration
1. User creates story → Saves with quiz
2. User clicks "Generate Audio" → Only story scenes get audio
3. Quiz has no audio ❌

### After Quiz Integration
1. User creates story → Saves with quiz
2. User clicks "Generate Audio" → Story + Transition + Quiz all get audio ✅
3. Single click, complete audio experience

---

## Audio Generation Flow

### Example: 3-Scene Story with 3 Quiz Questions

**Audio Pages Generated:**

| Page # | Type | Content |
|--------|------|---------|
| 1 | cover | "The Lost Puppy, by Emma, age 6" |
| 2 | scene | "Once upon a time, there was a little puppy..." |
| 3 | scene | "The puppy wandered into the forest..." |
| 4 | scene | "Finally, the puppy found his way home!" |
| 5 | **quiz_transition** | **"Let's see if our little readers and listeners are paying attention!"** |
| 6 | **quiz_question** | **"Question 1: What was the puppy looking for? A: His home. B: A bone. C: A friend. D: Water."** |
| 7 | **quiz_question** | **"Question 2: Where did the puppy go? A: The park. B: The forest. C: The beach. D: The city."** |
| 8 | **quiz_question** | **"Question 3: How did the story end? A: The puppy was lost. B: The puppy found his home. C: The puppy made friends. D: The puppy went to sleep."** |

**Total: 8 audio pages** (1 cover + 3 scenes + 1 transition + 3 quiz questions)

---

## Technical Implementation

### 1. Database Schema

#### story_audio_pages (Updated)
```sql
CREATE TABLE story_audio_pages (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  page_number INTEGER,
  page_type VARCHAR(50), -- 'cover', 'scene', 'quiz_transition', 'quiz_question'
  scene_id UUID REFERENCES scenes(id),
  quiz_question_id UUID REFERENCES quiz_questions(id), -- NEW
  text_content TEXT,
  audio_url TEXT,
  audio_filename TEXT,
  voice_id VARCHAR(50),
  tone VARCHAR(50),
  generation_status VARCHAR(20),
  error_message TEXT
);

-- Index for quiz question lookups
CREATE INDEX idx_story_audio_pages_quiz_question_id
  ON story_audio_pages(quiz_question_id);
```

#### quiz_questions (Already has audio columns)
```sql
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  question_order INTEGER,
  question TEXT,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer TEXT,
  explanation TEXT,
  question_audio_url TEXT,      -- Updated by audio generation
  option_a_audio_url TEXT,      -- Future: separate audio per option
  option_b_audio_url TEXT,
  option_c_audio_url TEXT,
  option_d_audio_url TEXT,
  audio_generated BOOLEAN        -- Updated to TRUE when audio ready
);
```

---

### 2. API Changes

#### `/api/generate-story-audio` (Updated)

**Fetch Query (Updated):**
```typescript
const { data: project } = await supabase
  .from('projects')
  .select(`
    *,
    scenes (id, scene_number, description, caption),
    quiz_questions (
      id, question_order, question,
      option_a, option_b, option_c, option_d,
      correct_answer, explanation
    )
  `)
  .eq('id', projectId)
  .single();
```

**Page Construction Logic:**
```typescript
const pages: AudioPage[] = [];

// 1. Cover page
pages.push({
  pageNumber: 1,
  pageType: 'cover',
  textContent: coverText,
});

// 2. Scene pages
scenes.forEach((scene, index) => {
  pages.push({
    pageNumber: index + 2,
    pageType: 'scene',
    textContent: scene.caption || scene.description,
    sceneId: scene.id,
  });
});

// 3. Quiz pages (if quiz exists)
if (quizQuestions.length > 0) {
  // 3a. Transition page
  pages.push({
    pageNumber: pages.length + 1,
    pageType: 'quiz_transition',
    textContent: "Let's see if our little readers and listeners are paying attention!",
  });

  // 3b. Question pages
  quizQuestions.forEach((question, index) => {
    const questionText =
      `Question ${index + 1}: ${question.question}. ` +
      `A: ${question.option_a}. ` +
      `B: ${question.option_b}. ` +
      `C: ${question.option_c}. ` +
      `D: ${question.option_d}.`;

    pages.push({
      pageNumber: pages.length + 1,
      pageType: 'quiz_question',
      textContent: questionText,
      quizQuestionId: question.id,
    });
  });
}
```

**Audio Generation Loop (Updated):**
```typescript
for (const page of pages) {
  // 1. Create audio page record
  const { data: audioPage } = await supabase
    .from('story_audio_pages')
    .insert({
      project_id: projectId,
      page_number: page.pageNumber,
      page_type: page.pageType,
      scene_id: page.sceneId,
      quiz_question_id: page.quizQuestionId, // NEW
      text_content: page.textContent,
      voice_id: voiceConfig.voice,
      tone: tone,
      generation_status: 'generating',
    })
    .select()
    .single();

  // 2. Generate audio with OpenAI TTS
  const mp3Response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voiceConfig.voice,
    input: page.textContent,
    speed: voiceConfig.speed,
  });

  // 3. Upload to storage
  const buffer = Buffer.from(await mp3Response.arrayBuffer());
  const filename = `${projectId}/page-${page.pageNumber}-${Date.now()}.mp3`;
  await supabase.storage
    .from('story-audio-files')
    .upload(filename, buffer);

  const { data: { publicUrl } } = supabase.storage
    .from('story-audio-files')
    .getPublicUrl(filename);

  // 4. Update audio page with URL
  await supabase
    .from('story_audio_pages')
    .update({
      audio_url: publicUrl,
      audio_filename: filename,
      generation_status: 'completed',
    })
    .eq('id', audioPage.id);

  // 5. NEW: If quiz question, also update quiz_questions table
  if (page.pageType === 'quiz_question' && page.quizQuestionId) {
    await supabase
      .from('quiz_questions')
      .update({
        question_audio_url: publicUrl,
        audio_generated: true,
      })
      .eq('id', page.quizQuestionId);
  }
}
```

---

## Voice Configuration

Uses same voice as story (based on `story_tone`):

```typescript
const VOICE_CONFIG = {
  playful: { voice: 'nova', speed: 0.85 },
  educational: { voice: 'nova', speed: 0.80 },
  adventurous: { voice: 'nova', speed: 0.85 },
  calming: { voice: 'shimmer', speed: 0.75 },
  mysterious: { voice: 'shimmer', speed: 0.80 },
  silly: { voice: 'nova', speed: 0.90 },
  default: { voice: 'nova', speed: 0.85 },
};
```

All quiz audio uses the **same voice and speed** as the story for consistency.

---

## Kids App Integration

### Reading Mode with Quiz Audio

**Sequence:**
1. User opens story in Kids App
2. Taps "Read Mode" or "Listen Mode"
3. System fetches `story_audio_pages` ordered by `page_number`
4. Plays through all pages sequentially:
   - Story scenes
   - **Transition** ("Let's see if...")
   - **Quiz questions** (full question + options)
5. After each quiz question audio plays, show interactive quiz UI

**Query for Audio Pages:**
```typescript
const { data: audioPages } = await supabase
  .from('story_audio_pages')
  .select('*')
  .eq('project_id', projectId)
  .order('page_number', { ascending: true });

// Example result:
// [
//   { page_number: 1, page_type: 'cover', audio_url: '...' },
//   { page_number: 2, page_type: 'scene', audio_url: '...' },
//   { page_number: 3, page_type: 'scene', audio_url: '...' },
//   { page_number: 4, page_type: 'scene', audio_url: '...' },
//   { page_number: 5, page_type: 'quiz_transition', audio_url: '...' },
//   { page_number: 6, page_type: 'quiz_question', quiz_question_id: 'uuid', audio_url: '...' },
//   { page_number: 7, page_type: 'quiz_question', quiz_question_id: 'uuid', audio_url: '...' },
//   { page_number: 8, page_type: 'quiz_question', quiz_question_id: 'uuid', audio_url: '...' },
// ]
```

**Fetching Quiz Details:**
```typescript
// For each quiz_question page, fetch full question details
const { data: quizQuestions } = await supabase
  .from('quiz_questions')
  .select('*')
  .eq('project_id', projectId)
  .order('question_order', { ascending: true });

// Match quiz_question_id from audio page to get full details
```

---

## Migration Required

Run this SQL before testing:

```bash
cd storyme-app
npx supabase db push
```

**Migration file:** `supabase/migrations/20251022_add_quiz_question_id_to_audio_pages.sql`

```sql
ALTER TABLE story_audio_pages
  ADD COLUMN IF NOT EXISTS quiz_question_id UUID
  REFERENCES quiz_questions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_story_audio_pages_quiz_question_id
  ON story_audio_pages(quiz_question_id);
```

---

## Testing Checklist

### Studio (Web App)
- [ ] Create story with 2-3 scenes
- [ ] Generate images
- [ ] Save story with cover
- [ ] Generate quiz (3 questions, easy difficulty)
- [ ] Save story
- [ ] Navigate to story viewer
- [ ] Click "Generate Audio"
- [ ] Verify success message shows: "Generated audio for X pages" (scenes + 1 transition + quiz questions)
- [ ] Check database: `story_audio_pages` should have quiz_transition and quiz_question pages
- [ ] Check database: `quiz_questions` should have `question_audio_url` and `audio_generated = true`

### Kids App (Flutter)
- [ ] Open story with quiz in Kids App
- [ ] Enter reading mode
- [ ] Play through all pages
- [ ] Verify transition audio plays: "Let's see if..."
- [ ] Verify quiz question audio plays: "Question 1: ..."
- [ ] Verify quiz UI appears after question audio
- [ ] Test answering questions
- [ ] Verify badge awarded on completion

---

## Future Enhancements

### 1. Separate Option Audio (Optional)
Instead of reading "A: option_a. B: option_b..." in one audio file, generate separate audio for each option:

```typescript
// Generate 5 audio files per quiz question:
// 1. question_audio_url: "What did the puppy do?"
// 2. option_a_audio_url: "A: Found his home"
// 3. option_b_audio_url: "B: Got lost in the forest"
// 4. option_c_audio_url: "C: Made a friend"
// 5. option_d_audio_url: "D: Ate a bone"
```

**Benefits:**
- More interactive quiz UI
- Can highlight each option as it's read
- Easier for young kids to follow

**Implementation:**
- Update audio generation loop to create 5 TTS calls per question
- Store each URL in respective column
- Kids App plays them sequentially with UI highlights

### 2. Explanation Audio
Add audio for the explanation shown after answering:

```typescript
question_explanation_audio_url: "That's right! The puppy found his way home at the end of the story."
```

### 3. Adaptive Speed
Slow down quiz questions even more for younger kids:

```typescript
const quizSpeed = voiceConfig.speed * 0.9; // 10% slower for quiz
```

---

## Summary

✅ **Single-click audio generation**: Story + Quiz all at once
✅ **Consistent voice**: Same narrator throughout
✅ **Automatic transition**: Seamless flow from story to quiz
✅ **Database integration**: Quiz questions track audio status
✅ **Kids App ready**: Full reading mode support with quiz

The quiz is now a fully integrated part of the story experience, with audio that flows naturally from the narrative to the comprehension questions!
