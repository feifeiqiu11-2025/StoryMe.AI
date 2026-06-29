# Quiz Feature API & Database Schema Documentation
**For KindleWood Kids App Development Team**

---

## Overview

The quiz feature allows stories to have comprehension questions attached to them. Each story can have multiple quiz questions with 4 multiple-choice options (A, B, C, D).

---

## Database Schema

### Table: `quiz_questions`

Stores quiz questions for each story/project.

```sql
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_quiz_questions_project_id ON quiz_questions(project_id);
```

**Column Details:**
- `id`: Unique identifier for the quiz question
- `project_id`: Foreign key to the story/project
- `question_order`: Order of the question (1, 2, 3, etc.)
- `question`: The actual question text
- `option_a`, `option_b`, `option_c`, `option_d`: Four answer choices
- `correct_answer`: Single letter indicating correct answer ('A', 'B', 'C', or 'D')
- `explanation`: Optional explanation of why the answer is correct
- `created_at`: Timestamp when question was created

### Table: `story_audio_pages` (Quiz Audio Support)

Stores audio narration for quiz pages.

**Relevant columns for quiz:**
```sql
ALTER TABLE story_audio_pages
  ADD COLUMN quiz_question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  ADD COLUMN page_type VARCHAR CHECK (page_type IN ('cover', 'scene', 'quiz_transition', 'quiz_question')),
  ALTER COLUMN scene_id DROP NOT NULL;  -- scene_id is nullable for quiz pages
```

**Page Types:**
- `quiz_transition`: Audio for "Let's see if our little readers are paying attention!"
- `quiz_question`: Audio narration of a specific quiz question with all 4 options

---

## API Endpoints

### 1. Get Quiz Questions for a Story

**Endpoint:** `GET /api/projects/[id]/quiz`

**Description:** Retrieves all quiz questions for a specific project/story.

**Request:**
```
GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f/quiz
```

**Response (200 OK):**
```json
{
  "questions": [
    {
      "id": "0234f17d-50ed-422a-9616-ca052f00350c",
      "project_id": "c3c33551-9c51-4132-8c24-825167803c5f",
      "question_order": 1,
      "question": "What did Connor celebrate?",
      "option_a": "Daddy's birthday",
      "option_b": "His own birthday",
      "option_c": "A friend's birthday",
      "option_d": "A holiday",
      "correct_answer": "A",
      "explanation": "Connor celebrated Daddy's birthday, which is why he was so happy!"
    },
    {
      "id": "bc3375b0-bdfd-4f12-b060-f67a00decfe5",
      "question_order": 2,
      "question": "Who is the main character in the story?",
      "option_a": "Connor",
      "option_b": "Mommy",
      "option_c": "A cat",
      "option_d": "A dinosaur",
      "correct_answer": "A",
      "explanation": "Connor is the main character who planned the celebration!"
    }
  ]
}
```

**Response (404 Not Found):**
```json
{
  "error": "Project not found"
}
```

**Response (200 OK - No Quiz):**
```json
{
  "questions": []
}
```

---

### 2. Get Story Audio Pages (Including Quiz Audio)

**Endpoint:** `GET /api/projects/[id]/audio-pages`

**Description:** Retrieves all audio pages for a story, including quiz audio.

**Request:**
```
GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f/audio-pages
```

**Response (200 OK):**
```json
{
  "pages": [
    {
      "id": "uuid-1",
      "project_id": "c3c33551-9c51-4132-8c24-825167803c5f",
      "page_number": 1,
      "page_type": "cover",
      "scene_id": null,
      "quiz_question_id": null,
      "text_content": "Connor's Birthday Surprise for Daddy...",
      "audio_url": "https://storage.url/cover.mp3",
      "audio_duration": 5.2,
      "voice_id": "nova",
      "tone": "playful",
      "generation_status": "completed"
    },
    {
      "id": "uuid-2",
      "page_number": 2,
      "page_type": "scene",
      "scene_id": "scene-uuid",
      "quiz_question_id": null,
      "text_content": "Connor giggled with joy...",
      "audio_url": "https://storage.url/scene-1.mp3",
      "audio_duration": 8.5,
      "voice_id": "nova",
      "tone": "playful",
      "generation_status": "completed"
    },
    {
      "id": "uuid-3",
      "page_number": 3,
      "page_type": "quiz_transition",
      "scene_id": null,
      "quiz_question_id": null,
      "text_content": "Let's see if our little readers and listeners are paying attention!",
      "audio_url": "https://storage.url/quiz-transition.mp3",
      "audio_duration": 3.8,
      "voice_id": "nova",
      "tone": "playful",
      "generation_status": "completed"
    },
    {
      "id": "uuid-4",
      "page_number": 4,
      "page_type": "quiz_question",
      "scene_id": null,
      "quiz_question_id": "0234f17d-50ed-422a-9616-ca052f00350c",
      "text_content": "Question 1: What did Connor celebrate?. A: Daddy's birthday. B: His own birthday. C: A friend's birthday. D: A holiday.",
      "audio_url": "https://storage.url/quiz-q1.mp3",
      "audio_duration": 12.4,
      "voice_id": "nova",
      "tone": "playful",
      "generation_status": "completed"
    }
  ]
}
```

---

### 3. Get Complete Story Data (Including Quiz)

**Endpoint:** `GET /api/projects/[id]`

**Description:** Retrieves complete story data including scenes and quiz questions.

**Request:**
```
GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f
```

**Response includes:**
```json
{
  "project": {
    "id": "c3c33551-9c51-4132-8c24-825167803c5f",
    "title": "Connor's Birthday Surprise for Daddy",
    "description": "A heartwarming story...",
    "cover_image_url": "https://...",
    "author_name": "Connor",
    "author_age": 5,
    "reading_level": 5,
    "story_tone": "playful",
    "scenes": [
      {
        "id": "scene-uuid",
        "scene_number": 1,
        "description": "Connor giggled with joy...",
        "caption": "Connor celebrates Daddy's birthday",
        "images": [
          {
            "id": "image-uuid",
            "image_url": "https://...",
            "is_primary": true
          }
        ]
      }
    ],
    "quiz_questions": [
      {
        "id": "0234f17d-50ed-422a-9616-ca052f00350c",
        "question_order": 1,
        "question": "What did Connor celebrate?",
        "option_a": "Daddy's birthday",
        "option_b": "His own birthday",
        "option_c": "A friend's birthday",
        "option_d": "A holiday",
        "correct_answer": "A",
        "explanation": "Connor celebrated Daddy's birthday!"
      }
    ]
  }
}
```

---

## Quiz Display Guidelines for Kids App

### 1. **Don't Show Correct Answers**
- Kids should figure out answers on their own
- Don't highlight correct answers in green
- Don't show checkmarks (✓) on correct options
- Don't show explanations until after kid submits their answer

### 2. **Display Quiz After Story**
- Show quiz as additional pages after the story ends
- Use a transition page: "Let's see if our little readers and listeners are paying attention!"
- Then show quiz questions one by one

### 3. **Audio Playback**
- Each quiz question page has its own audio narration
- Audio reads the question and all 4 options aloud
- Format: "Question 1: What did Connor celebrate?. A: Daddy's birthday. B: His own birthday. C: A friend's birthday. D: A holiday."

### 4. **Question Display Format**
```
Question 1 of 3

What did Connor celebrate?

A. Daddy's birthday
B. His own birthday
C. A friend's birthday
D. A holiday
```

### 5. **Answer Submission Flow**
1. Kid selects an answer (A, B, C, or D)
2. Kid clicks "Submit Answer"
3. Show if they got it right or wrong
4. Show the explanation
5. Button to go to next question

### 6. **Quiz Results**
- Track how many questions answered correctly
- Show final score: "You got 2 out of 3 correct! Great job!"
- Optional: Store quiz results in user progress tracking

---

## Example Usage for Kids App

### Fetching Quiz for a Story

```typescript
// Fetch story with quiz
const response = await fetch(`https://kindlewood-studio.vercel.app/api/projects/${storyId}`);
const data = await response.json();

const story = data.project;
const quizQuestions = story.quiz_questions || [];

// Check if story has a quiz
if (quizQuestions.length > 0) {
  console.log(`Story has ${quizQuestions.length} quiz questions`);

  // Sort by question_order
  quizQuestions.sort((a, b) => a.question_order - b.question_order);

  // Display quiz after story
  showQuizSection(quizQuestions);
}
```

### Checking Kid's Answer

```typescript
function checkAnswer(question, selectedAnswer: 'A' | 'B' | 'C' | 'D') {
  const isCorrect = selectedAnswer === question.correct_answer;

  return {
    isCorrect,
    explanation: question.explanation,
    correctAnswer: question.correct_answer,
    selectedOption: question[`option_${selectedAnswer.toLowerCase()}`],
    correctOption: question[`option_${question.correct_answer.toLowerCase()}`]
  };
}
```

### Playing Quiz Audio

```typescript
// Fetch audio pages
const audioResponse = await fetch(`https://kindlewood-studio.vercel.app/api/projects/${storyId}/audio-pages`);
const audioData = await audioResponse.json();

// Filter quiz audio pages
const quizAudioPages = audioData.pages.filter(page =>
  page.page_type === 'quiz_transition' || page.page_type === 'quiz_question'
);

// Play transition audio first
const transitionAudio = quizAudioPages.find(p => p.page_type === 'quiz_transition');
if (transitionAudio) {
  playAudio(transitionAudio.audio_url);
}

// Then play each question's audio
for (const question of quizQuestions) {
  const questionAudio = quizAudioPages.find(p =>
    p.quiz_question_id === question.id
  );

  if (questionAudio) {
    playAudio(questionAudio.audio_url);
  }
}
```

---

## Data Validation

### Quiz Question Constraints
- ✅ Each story can have 0 or more quiz questions
- ✅ Questions are ordered by `question_order` (1, 2, 3, ...)
- ✅ Each question must have exactly 4 options (A, B, C, D)
- ✅ Correct answer must be one of: 'A', 'B', 'C', 'D'
- ✅ Explanation is optional but recommended

### Audio Page Constraints
- ✅ `page_type` can be: 'cover', 'scene', 'quiz_transition', 'quiz_question'
- ✅ Quiz pages have `scene_id = null` and `quiz_question_id = UUID` (for quiz_question type)
- ✅ Quiz transition has both `scene_id = null` and `quiz_question_id = null`

---

## Testing Endpoints

### Test Story with Quiz
**Story ID:** `c3c33551-9c51-4132-8c24-825167803c5f`

**Available endpoints:**
- Quiz: `GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f/quiz`
- Audio: `GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f/audio-pages`
- Full Story: `GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f`

**Expected quiz data:**
- 3 questions
- Reading level: 5
- Story tone: playful
- Questions about Connor's birthday story

---

## Migration Scripts (Already Applied)

### 1. Add quiz_question_id column
```sql
ALTER TABLE story_audio_pages
  ADD COLUMN IF NOT EXISTS quiz_question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_story_audio_pages_quiz_question_id
  ON story_audio_pages(quiz_question_id);
```

### 2. Make scene_id nullable
```sql
ALTER TABLE story_audio_pages
  ALTER COLUMN scene_id DROP NOT NULL;
```

### 3. Add quiz page types to CHECK constraint
```sql
ALTER TABLE story_audio_pages
  DROP CONSTRAINT IF EXISTS story_audio_pages_page_type_check;

ALTER TABLE story_audio_pages
  ADD CONSTRAINT story_audio_pages_page_type_check
  CHECK (page_type IN ('cover', 'scene', 'quiz_transition', 'quiz_question'));
```

---

## Security & Permissions

- ✅ All quiz endpoints respect Row Level Security (RLS) policies
- ✅ Kids can only access quizzes for stories they have permission to view
- ✅ Correct answers and explanations are included in the API response (kids app should hide until after submission)
- ✅ No separate authentication needed - use existing Supabase auth

---

## Support & Questions

For any questions about the quiz feature implementation, contact the KindleWood Studio backend team.

**Key Files:**
- Quiz API: `/api/projects/[id]/quiz/route.ts`
- Audio API: `/api/projects/[id]/audio-pages/route.ts`
- Database Schema: `/supabase/migrations/`

---

**Last Updated:** October 22, 2025
**Version:** 1.0
**Status:** ✅ Production Ready
