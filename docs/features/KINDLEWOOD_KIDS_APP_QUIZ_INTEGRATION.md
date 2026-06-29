# KindleWood Kids App - Quiz Integration Guide
**Step-by-Step Implementation Guide**

---

## ⚠️ Important: Quiz Not Showing in Kids App?

The quiz feature is now live in the backend (KindleWood Studio), but the **KindleWood Kids App needs code changes** to display quiz pages. This guide shows exactly what needs to be implemented.

---

## Overview

Stories published from KindleWood Studio can now include quiz questions. The kids app needs to:
1. ✅ Check if story has quiz (via API)
2. ✅ Fetch quiz questions
3. ✅ Display quiz as additional pages after the story
4. ✅ Play quiz audio narration
5. ✅ Handle kid's answers (show if correct/wrong)

---

## Step 1: Check If Story Has Quiz

### API: Check Publication Status

**Endpoint:** `GET /api/projects/[id]/publish-kids-app`

**Response includes quiz metadata:**
```json
{
  "isPublished": true,
  "status": "live",
  "hasQuiz": true,
  "quizQuestionCount": 3,
  "publishedTo": [
    {
      "childId": "child-uuid",
      "childName": "Connor"
    }
  ],
  "publication": {
    "platform_metadata": {
      "has_quiz": true,
      "quiz_question_count": 3,
      "reading_level": 5,
      "story_tone": "playful"
    }
  }
}
```

### Flutter/Dart Code Example:

```dart
// Check if story has quiz
Future<bool> checkStoryHasQuiz(String projectId) async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/projects/$projectId/publish-kids-app'),
    headers: {'Authorization': 'Bearer $token'},
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['hasQuiz'] == true;
  }

  return false;
}
```

---

## Step 2: Fetch Quiz Questions

### API: Get Quiz Questions

**Endpoint:** `GET /api/projects/[id]/quiz`

**Response:**
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
      "explanation": "Connor is the main character who planned the celebration for Daddy!"
    },
    {
      "id": "eb232dac-b73d-4b53-b34a-0a7e865e3296",
      "question_order": 3,
      "question": "How did Connor feel about the birthday?",
      "option_a": "Happy",
      "option_b": "Sad",
      "option_c": "Angry",
      "option_d": "Tired",
      "correct_answer": "A",
      "explanation": "Connor felt happy because he was celebrating Daddy's special day!"
    }
  ]
}
```

### Flutter/Dart Code Example:

```dart
// Model for quiz question
class QuizQuestion {
  final String id;
  final int questionOrder;
  final String question;
  final String optionA;
  final String optionB;
  final String optionC;
  final String optionD;
  final String correctAnswer; // 'A', 'B', 'C', or 'D'
  final String? explanation;

  QuizQuestion({
    required this.id,
    required this.questionOrder,
    required this.question,
    required this.optionA,
    required this.optionB,
    required this.optionC,
    required this.optionD,
    required this.correctAnswer,
    this.explanation,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      id: json['id'],
      questionOrder: json['question_order'],
      question: json['question'],
      optionA: json['option_a'],
      optionB: json['option_b'],
      optionC: json['option_c'],
      optionD: json['option_d'],
      correctAnswer: json['correct_answer'],
      explanation: json['explanation'],
    );
  }
}

// Fetch quiz questions
Future<List<QuizQuestion>> fetchQuizQuestions(String projectId) async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/projects/$projectId/quiz'),
    headers: {'Authorization': 'Bearer $token'},
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    final questions = (data['questions'] as List)
        .map((q) => QuizQuestion.fromJson(q))
        .toList();

    // Sort by question_order to ensure correct sequence
    questions.sort((a, b) => a.questionOrder.compareTo(b.questionOrder));
    return questions;
  }

  throw Exception('Failed to load quiz questions');
}
```

---

## Step 3: Fetch Quiz Audio

### API: Get Audio Pages (Including Quiz)

**Endpoint:** `GET /api/projects/[id]/audio-pages`

**Response includes quiz audio:**
```json
{
  "pages": [
    {
      "id": "uuid-1",
      "page_number": 1,
      "page_type": "cover",
      "audio_url": "https://storage.url/cover.mp3",
      "audio_duration": 5.2
    },
    {
      "id": "uuid-2",
      "page_number": 2,
      "page_type": "scene",
      "scene_id": "scene-uuid",
      "audio_url": "https://storage.url/scene-1.mp3",
      "audio_duration": 8.5
    },
    {
      "id": "uuid-3",
      "page_number": 3,
      "page_type": "quiz_transition",
      "text_content": "Let's see if our little readers and listeners are paying attention!",
      "audio_url": "https://storage.url/quiz-transition.mp3",
      "audio_duration": 3.8
    },
    {
      "id": "uuid-4",
      "page_number": 4,
      "page_type": "quiz_question",
      "quiz_question_id": "0234f17d-50ed-422a-9616-ca052f00350c",
      "text_content": "Question 1: What did Connor celebrate?. A: Daddy's birthday. B: His own birthday. C: A friend's birthday. D: A holiday.",
      "audio_url": "https://storage.url/quiz-q1.mp3",
      "audio_duration": 12.4
    }
  ]
}
```

### Flutter/Dart Code Example:

```dart
// Model for audio page
class AudioPage {
  final String id;
  final int pageNumber;
  final String pageType; // 'cover', 'scene', 'quiz_transition', 'quiz_question'
  final String? sceneId;
  final String? quizQuestionId;
  final String? audioUrl;
  final double? audioDuration;
  final String? textContent;

  AudioPage({
    required this.id,
    required this.pageNumber,
    required this.pageType,
    this.sceneId,
    this.quizQuestionId,
    this.audioUrl,
    this.audioDuration,
    this.textContent,
  });

  factory AudioPage.fromJson(Map<String, dynamic> json) {
    return AudioPage(
      id: json['id'],
      pageNumber: json['page_number'],
      pageType: json['page_type'],
      sceneId: json['scene_id'],
      quizQuestionId: json['quiz_question_id'],
      audioUrl: json['audio_url'],
      audioDuration: json['audio_duration']?.toDouble(),
      textContent: json['text_content'],
    );
  }

  bool get isQuizPage => pageType == 'quiz_transition' || pageType == 'quiz_question';
}

// Fetch audio pages
Future<List<AudioPage>> fetchAudioPages(String projectId) async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/projects/$projectId/audio-pages'),
    headers: {'Authorization': 'Bearer $token'},
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return (data['pages'] as List)
        .map((p) => AudioPage.fromJson(p))
        .toList();
  }

  throw Exception('Failed to load audio pages');
}

// Get quiz audio specifically
List<AudioPage> getQuizAudio(List<AudioPage> allPages) {
  return allPages
      .where((page) => page.isQuizPage)
      .toList();
}

// Map quiz question ID to audio URL
Map<String, String> mapQuizQuestionToAudio(List<AudioPage> audioPages) {
  final map = <String, String>{};

  for (var page in audioPages) {
    if (page.pageType == 'quiz_question' &&
        page.quizQuestionId != null &&
        page.audioUrl != null) {
      map[page.quizQuestionId!] = page.audioUrl!;
    }
  }

  return map;
}
```

---

## Step 4: Display Quiz in Story Viewer

### Recommended Flow:

1. **Story Pages** (existing carousel)
2. **Quiz Transition Page** (new)
   - Show: "Let's see if our little readers and listeners are paying attention!"
   - Auto-play transition audio
3. **Quiz Question Pages** (new - one per question)
   - Show question and 4 options
   - Allow kid to select answer
   - Auto-play question audio

### Flutter UI Example:

```dart
class StoryViewerPage extends StatefulWidget {
  final String projectId;

  @override
  _StoryViewerPageState createState() => _StoryViewerPageState();
}

class _StoryViewerPageState extends State<StoryViewerPage> {
  List<StoryPage> storyPages = [];
  List<QuizQuestion> quizQuestions = [];
  List<AudioPage> audioPages = [];
  int currentPageIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadStoryData();
  }

  Future<void> _loadStoryData() async {
    // 1. Load story pages (existing code)
    final pages = await fetchStoryPages(widget.projectId);

    // 2. Check if story has quiz
    final hasQuiz = await checkStoryHasQuiz(widget.projectId);

    if (hasQuiz) {
      // 3. Fetch quiz questions
      final questions = await fetchQuizQuestions(widget.projectId);

      // 4. Fetch audio pages
      final audio = await fetchAudioPages(widget.projectId);

      setState(() {
        storyPages = pages;
        quizQuestions = questions;
        audioPages = audio;
      });
    } else {
      setState(() {
        storyPages = pages;
      });
    }
  }

  // Build combined page list: story pages + quiz pages
  List<Widget> _buildAllPages() {
    final allPages = <Widget>[];

    // Add story pages
    for (var page in storyPages) {
      allPages.add(_buildStoryPage(page));
    }

    // Add quiz pages if quiz exists
    if (quizQuestions.isNotEmpty) {
      // Add transition page
      allPages.add(_buildQuizTransitionPage());

      // Add question pages
      for (var question in quizQuestions) {
        allPages.add(_buildQuizQuestionPage(question));
      }
    }

    return allPages;
  }

  Widget _buildQuizTransitionPage() {
    // Find transition audio
    final transitionAudio = audioPages.firstWhere(
      (p) => p.pageType == 'quiz_transition',
      orElse: () => null,
    );

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF3E5F5), Color(0xFFE1BEE7)], // Purple gradient
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '🧠',
              style: TextStyle(fontSize: 80),
            ),
            SizedBox(height: 24),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                "Let's see if our little readers and listeners are paying attention!",
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.purple[900],
                ),
              ),
            ),
            if (transitionAudio?.audioUrl != null)
              SizedBox(height: 32),
              // Auto-play transition audio
              AudioPlayerWidget(audioUrl: transitionAudio!.audioUrl!),
          ],
        ),
      ),
    );
  }

  Widget _buildQuizQuestionPage(QuizQuestion question) {
    // Find audio for this question
    final questionAudio = audioPages.firstWhere(
      (p) => p.quizQuestionId == question.id,
      orElse: () => null,
    );

    return QuizQuestionWidget(
      question: question,
      audioUrl: questionAudio?.audioUrl,
      onAnswerSelected: (selectedAnswer) {
        _handleAnswerSelected(question, selectedAnswer);
      },
    );
  }

  void _handleAnswerSelected(QuizQuestion question, String selectedAnswer) {
    // Check if answer is correct
    final isCorrect = selectedAnswer == question.correctAnswer;

    // Show feedback to kid
    showDialog(
      context: context,
      builder: (context) => AnswerFeedbackDialog(
        isCorrect: isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PageView(
        controller: PageController(initialPage: currentPageIndex),
        onPageChanged: (index) {
          setState(() => currentPageIndex = index);
        },
        children: _buildAllPages(),
      ),
    );
  }
}
```

---

## Step 5: Quiz Question Widget

### Flutter Widget Example:

```dart
class QuizQuestionWidget extends StatefulWidget {
  final QuizQuestion question;
  final String? audioUrl;
  final Function(String) onAnswerSelected;

  @override
  _QuizQuestionWidgetState createState() => _QuizQuestionWidgetState();
}

class _QuizQuestionWidgetState extends State<QuizQuestionWidget> {
  String? selectedAnswer;
  bool hasSubmitted = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF3E5F5), Color(0xFFBBDEFB)],
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            children: [
              // Question number badge
              Container(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.purple[600],
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Question ${widget.question.questionOrder}',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),

              SizedBox(height: 32),

              // Question text
              Text(
                widget.question.question,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[900],
                ),
              ),

              SizedBox(height: 48),

              // Answer options
              Expanded(
                child: ListView(
                  children: [
                    _buildOptionButton('A', widget.question.optionA),
                    SizedBox(height: 16),
                    _buildOptionButton('B', widget.question.optionB),
                    SizedBox(height: 16),
                    _buildOptionButton('C', widget.question.optionC),
                    SizedBox(height: 16),
                    _buildOptionButton('D', widget.question.optionD),
                  ],
                ),
              ),

              // Submit button
              if (selectedAnswer != null && !hasSubmitted)
                ElevatedButton(
                  onPressed: () {
                    setState(() => hasSubmitted = true);
                    widget.onAnswerSelected(selectedAnswer!);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple[600],
                    padding: EdgeInsets.symmetric(horizontal: 48, vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                  ),
                  child: Text(
                    'Submit Answer',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ),

              // Audio player (auto-play when page loads)
              if (widget.audioUrl != null)
                AudioPlayerWidget(
                  audioUrl: widget.audioUrl!,
                  autoPlay: true,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOptionButton(String letter, String text) {
    final isSelected = selectedAnswer == letter;
    final isCorrect = hasSubmitted && letter == widget.question.correctAnswer;
    final isWrong = hasSubmitted && isSelected && !isCorrect;

    Color borderColor;
    Color backgroundColor;

    if (hasSubmitted) {
      if (isCorrect) {
        borderColor = Colors.green;
        backgroundColor = Colors.green[50]!;
      } else if (isWrong) {
        borderColor = Colors.red;
        backgroundColor = Colors.red[50]!;
      } else {
        borderColor = Colors.grey[300]!;
        backgroundColor = Colors.white;
      }
    } else if (isSelected) {
      borderColor = Colors.purple[400]!;
      backgroundColor = Colors.purple[50]!;
    } else {
      borderColor = Colors.grey[300]!;
      backgroundColor = Colors.white;
    }

    return GestureDetector(
      onTap: hasSubmitted ? null : () {
        setState(() => selectedAnswer = letter);
      },
      child: Container(
        padding: EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: backgroundColor,
          border: Border.all(color: borderColor, width: 3),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            // Letter badge
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isCorrect ? Colors.green : (isWrong ? Colors.red : Colors.grey[700]),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  letter,
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                  ),
                ),
              ),
            ),

            SizedBox(width: 16),

            // Option text
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 18,
                  color: Colors.grey[900],
                  fontWeight: isCorrect ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ),

            // Checkmark or X for correct/wrong
            if (hasSubmitted && isCorrect)
              Icon(Icons.check_circle, color: Colors.green, size: 32),
            if (hasSubmitted && isWrong)
              Icon(Icons.cancel, color: Colors.red, size: 32),
          ],
        ),
      ),
    );
  }
}
```

---

## Step 6: Answer Feedback Dialog

```dart
class AnswerFeedbackDialog extends StatelessWidget {
  final bool isCorrect;
  final String correctAnswer;
  final String? explanation;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Emoji feedback
          Text(
            isCorrect ? '🎉' : '💭',
            style: TextStyle(fontSize: 80),
          ),

          SizedBox(height: 16),

          // Correct/Incorrect message
          Text(
            isCorrect ? 'Great job!' : 'Not quite!',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: isCorrect ? Colors.green : Colors.orange,
            ),
          ),

          SizedBox(height: 16),

          // Explanation
          if (explanation != null)
            Text(
              explanation!,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.grey[700]),
            ),

          SizedBox(height: 24),

          // Next button
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.purple[600],
              padding: EdgeInsets.symmetric(horizontal: 32, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            child: Text(
              'Continue',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## Step 7: Quiz Progress Tracking (Optional)

Track how many questions the kid got correct:

```dart
class QuizProgress {
  final int totalQuestions;
  final int correctAnswers;
  final List<String> answeredQuestionIds;

  QuizProgress({
    required this.totalQuestions,
    this.correctAnswers = 0,
    this.answeredQuestionIds = const [],
  });

  double get score => totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

  bool get isComplete => answeredQuestionIds.length == totalQuestions;

  QuizProgress copyWith({
    int? totalQuestions,
    int? correctAnswers,
    List<String>? answeredQuestionIds,
  }) {
    return QuizProgress(
      totalQuestions: totalQuestions ?? this.totalQuestions,
      correctAnswers: correctAnswers ?? this.correctAnswers,
      answeredQuestionIds: answeredQuestionIds ?? this.answeredQuestionIds,
    );
  }
}

// Usage in state management
class StoryViewerState {
  QuizProgress? quizProgress;

  void recordAnswer(String questionId, bool isCorrect) {
    if (quizProgress == null) return;

    quizProgress = quizProgress!.copyWith(
      correctAnswers: quizProgress!.correctAnswers + (isCorrect ? 1 : 0),
      answeredQuestionIds: [...quizProgress!.answeredQuestionIds, questionId],
    );

    // Show completion dialog if all questions answered
    if (quizProgress!.isComplete) {
      _showQuizCompletionDialog();
    }
  }

  void _showQuizCompletionDialog() {
    // Show: "You got 2 out of 3 correct! Great job!"
  }
}
```

---

## Testing Checklist

After implementing the above, test these scenarios:

### ✅ Story WITHOUT Quiz:
- [ ] Story loads normally
- [ ] No quiz pages appear
- [ ] No errors in console

### ✅ Story WITH Quiz (3 questions):
- [ ] Story pages load (e.g., 1 cover + 1 scene = 2 pages)
- [ ] Quiz transition page appears after story (page 3)
- [ ] 3 quiz question pages appear (pages 4, 5, 6)
- [ ] Total pages = 2 story + 1 transition + 3 questions = 6 pages
- [ ] Can swipe through all pages

### ✅ Quiz Audio:
- [ ] Transition audio plays automatically
- [ ] Each quiz question audio plays when page loads
- [ ] Audio reads question + all 4 options

### ✅ Quiz Interaction:
- [ ] Can tap to select an answer (A, B, C, or D)
- [ ] Selected answer highlights (purple border)
- [ ] Submit button appears after selecting
- [ ] Clicking submit shows feedback dialog
- [ ] Correct answer shows green checkmark
- [ ] Wrong answer shows red X + reveals correct answer
- [ ] Explanation displays in feedback dialog

### ✅ Quiz Progress:
- [ ] Track correct answers across all questions
- [ ] Show completion message: "You got 2 out of 3 correct!"

---

## Example: Test Story with Quiz

**Story ID:** `c3c33551-9c51-4132-8c24-825167803c5f`

**API Endpoints to test:**
- Quiz status: `GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f/publish-kids-app`
- Quiz questions: `GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f/quiz`
- Audio pages: `GET /api/projects/c3c33551-9c51-4132-8c24-825167803c5f/audio-pages`

**Expected:**
- 3 quiz questions about Connor's birthday
- Reading level: 5
- Tone: playful
- Has quiz transition + 3 question audio files

---

## Summary: What Kids App Needs to Do

### Required Changes:

1. **Fetch quiz questions** when loading story
   - Use `GET /api/projects/[id]/quiz`
   - Parse response into `QuizQuestion` models

2. **Fetch quiz audio** when loading story
   - Use `GET /api/projects/[id]/audio-pages`
   - Filter for `quiz_transition` and `quiz_question` page types
   - Map question IDs to audio URLs

3. **Add quiz pages to story carousel**
   - After story pages, add transition page
   - Then add one page per quiz question
   - Allow swiping through all pages

4. **Display quiz questions**
   - Show question text
   - Show 4 options (A, B, C, D)
   - Auto-play question audio
   - Allow kid to select answer
   - Show submit button

5. **Handle answer submission**
   - Check if selected answer matches `correct_answer`
   - Show feedback dialog (correct/incorrect)
   - Display explanation
   - Track progress (optional)

---

## Support

For questions or issues with quiz integration:
- Reference: `QUIZ_API_DOCUMENTATION.md`
- Backend API: All endpoints are live in production
- Test story ID: `c3c33551-9c51-4132-8c24-825167803c5f`

---

**Last Updated:** October 22, 2025
**Version:** 1.0
**Status:** ✅ Backend Ready - Waiting for Kids App Implementation
