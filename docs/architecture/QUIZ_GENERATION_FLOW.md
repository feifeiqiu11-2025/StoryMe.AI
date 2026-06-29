# Quiz Generation Flow - Implementation Summary

## Overview
Quiz generation has been refactored to be part of the story creation/save flow, rather than a standalone feature on the story viewer page.

---

## User Flow

### 1. Create Story
- Add characters
- Write scenes
- Configure settings (reading level, tone, expansion)
- Enhance scenes with AI
- Generate images

### 2. Save Story Modal
When user clicks "Save to Library":

**Step 1: Generate Title & Description (AI)**
- Click "Regenerate with AI" to auto-generate metadata
- Or manually enter title and description

**Step 2: Generate Cover Image**
- Click "Generate Cover Preview"
- Review cover → "Try Again" or "Use This Cover"
- Must approve cover before proceeding

**Step 3: Generate Quiz (Optional - NEW)**
After cover is approved, quiz section appears:
- Select difficulty: Easy / Medium / Hard
- Select question count: 3 / 5 / 10 questions
- Click "Generate Quiz"

**Step 4: Preview Quiz**
- Modal shows all generated questions
- Displays correct answers (green highlight)
- Shows explanations
- Options: "Regenerate" or "Use This Quiz"

**Step 5: Save Story**
- Quiz data included in story structure
- Saved to database with project

---

## Technical Implementation

### Frontend (create/page.tsx)

**New State Variables:**
```typescript
const [quizData, setQuizData] = useState<any>(null);
const [generatingQuiz, setGeneratingQuiz] = useState(false);
const [showQuizModal, setShowQuizModal] = useState(false);
const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
const [quizQuestionCount, setQuizQuestionCount] = useState<number>(3);
```

**Quiz Generation Handler:**
```typescript
const handleGenerateQuiz = async () => {
  const response = await fetch('/api/generate-quiz-preview', {
    method: 'POST',
    body: JSON.stringify({
      script: scriptInput,
      readingLevel,
      storyTone,
      difficulty: quizDifficulty,
      questionCount: quizQuestionCount,
      characterNames: characters.map(c => c.name),
    }),
  });
  const data = await response.json();
  setQuizData(data.questions);
  setShowQuizModal(true);
};
```

**Save Story (Updated):**
```typescript
body: JSON.stringify({
  // ... existing fields ...
  quizData: quizData || undefined, // Include quiz if generated
})
```

---

### API Layer

#### NEW: `/api/generate-quiz-preview/route.ts`
- **Purpose**: Generate quiz for preview (no audio, no database)
- **Input**:
  - script
  - readingLevel
  - storyTone
  - difficulty ('easy' | 'medium' | 'hard')
  - questionCount (3 | 5 | 10)
  - characterNames[]
- **Process**:
  - Calls OpenAI GPT-4o-mini
  - Difficulty-based prompts:
    - Easy: Ages 4-6, basic events and characters
    - Medium: Ages 7-9, inference and sequence
    - Hard: Ages 10-12, vocabulary, theme, cause-effect
- **Output**: JSON array of questions

**Question Format:**
```json
{
  "question": "What did Emma do when...?",
  "option_a": "First answer",
  "option_b": "Second answer",
  "option_c": "Third answer",
  "option_d": "Fourth answer",
  "correct_answer": "A",
  "explanation": "Brief explanation"
}
```

#### UPDATED: `/api/projects/save/route.ts`
- Now accepts optional `quizData` parameter
- Passes to ProjectService

---

### Service Layer

#### UPDATED: `ProjectService.saveCompletedStory()`

**New Parameter:**
```typescript
quizData?: Array<{
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation?: string;
}>;
```

**Quiz Saving Logic:**
```typescript
// 5. Save quiz questions if provided
if (data.quizData && data.quizData.length > 0) {
  for (let i = 0; i < data.quizData.length; i++) {
    const question = data.quizData[i];
    await supabase.from('quiz_questions').insert({
      project_id: project.id,
      question_order: i + 1,
      question: question.question,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
    });
  }
}
```

---

## Database Schema

Uses existing `quiz_questions` table from previous migration:

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
  -- Audio fields (for future use)
  question_audio_url TEXT,
  option_a_audio_url TEXT,
  option_b_audio_url TEXT,
  option_c_audio_url TEXT,
  option_d_audio_url TEXT,
  audio_generated BOOLEAN DEFAULT FALSE
);
```

**Note**: Audio fields exist but are not populated in this flow. Audio generation can be added later as a post-save enhancement (similar to story audio generation).

---

## Benefits of New Approach

### ✅ Integrated Flow
- Quiz is part of story creation, not a separate step
- Natural progression: scenes → cover → quiz → save

### ✅ User Control
- Choose difficulty level (easy/medium/hard)
- Choose question count (3/5/10)
- Preview before committing
- Can regenerate if unsatisfied

### ✅ Data Structure
- Quiz saved with story (similar to PDF concept)
- No separate publishing flow needed
- Retrieval is simple: query by project_id

### ✅ Flexibility
- Quiz is optional (can skip)
- Can be added to existing stories later via viewer page (if needed)
- Audio generation can be added as enhancement

---

## Future Enhancements

### 1. Audio Generation
Add TTS audio for quiz questions after save:
- Transition audio: "Let's see if you were paying attention!"
- Question audio
- Option audio (A, B, C, D)

### 2. Edit Quiz
Allow editing quiz questions in story viewer:
- Add/remove questions
- Edit question text or options
- Regenerate specific questions

### 3. Quiz Analytics
Track quiz attempts in Kids App:
- Which questions are most difficult
- Success rate per story
- Badge awarding based on quiz completion

### 4. Multiple Difficulty Levels
Allow saving multiple quiz versions:
- Easy version for younger kids
- Hard version for older kids
- Kids App auto-selects based on child's age

---

## Testing Checklist

- [x] Create story with images
- [x] Open save modal
- [x] Generate cover image
- [x] Approve cover
- [ ] Generate quiz (3 questions, easy)
- [ ] Preview quiz → Verify questions display correctly
- [ ] Regenerate quiz → Verify new questions generated
- [ ] Approve quiz
- [ ] Save story
- [ ] Verify quiz questions saved to database
- [ ] Load story in viewer → Verify quiz data present

---

## Files Modified

### Frontend
- `src/app/(dashboard)/create/page.tsx`
  - Added quiz generation state
  - Added quiz UI in save modal
  - Added quiz preview modal
  - Updated save handler to include quiz data

### Backend
- `src/app/api/generate-quiz-preview/route.ts` (NEW)
  - Quiz generation endpoint (preview only)

- `src/app/api/projects/save/route.ts` (UPDATED)
  - Accepts quizData parameter

- `src/lib/services/project.service.ts` (UPDATED)
  - saveCompletedStory() accepts and saves quiz data

---

## Summary

Quiz generation is now a seamless part of the story creation experience:
1. ✅ Integrated into save flow (after cover)
2. ✅ User controls difficulty and question count
3. ✅ Preview before saving
4. ✅ Saved with story structure
5. ⚠️ Audio generation deferred (can be added as enhancement)

This approach aligns with the user's vision: "saved story will have quiz page in there too, same thing as download PDF".
