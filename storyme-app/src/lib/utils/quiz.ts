/**
 * Quiz utility functions
 */

const OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d'] as const;
const LETTERS = ['A', 'B', 'C', 'D'] as const;

type OptionKey = (typeof OPTION_KEYS)[number];

interface QuizQuestion {
  option_a: string;
  option_b: string;
  option_c: string;
  option_d?: string | null;
  correct_answer: string;
  [key: string]: any;
}

/**
 * Shuffles quiz answer options so the correct answer isn't always in the same position.
 * Uses Fisher-Yates shuffle. Preserves all other fields on the question object.
 */
export function shuffleQuizOptions<T extends QuizQuestion>(question: T): T {
  const correctLetter = question.correct_answer.toUpperCase();
  const correctKey = `option_${correctLetter.toLowerCase()}` as OptionKey;
  const correctText = question[correctKey] as string;

  // Collect non-null options
  const options: { key: OptionKey; text: string }[] = [];
  for (const key of OPTION_KEYS) {
    const text = question[key];
    if (text != null && text !== '') {
      options.push({ key, text });
    }
  }

  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  // Build shuffled result
  const shuffled: Record<string, any> = { ...question };
  for (let i = 0; i < OPTION_KEYS.length; i++) {
    if (i < options.length) {
      shuffled[OPTION_KEYS[i]] = options[i].text;
    } else {
      shuffled[OPTION_KEYS[i]] = null;
    }
  }

  // Update correct_answer to the new position
  const newIndex = options.findIndex((o) => o.text === correctText);
  shuffled.correct_answer = LETTERS[newIndex];

  return shuffled as T;
}
