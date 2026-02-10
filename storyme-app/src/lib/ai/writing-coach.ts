/**
 * Writing Coach Prompt Builder
 *
 * Builds a combined prompt that returns two coaching layers:
 * 1. Polish: grammar, conciseness, clarity corrections (Grok-style inline edits)
 * 2. Strengthen: template-aware guiding questions (asks questions, doesn't give answers)
 *
 * The AI returns structured JSON with both sections in a single call,
 * since both need to read the full script + context.
 */

import { StoryTemplateId } from '@/lib/types/story';
import { STORY_TEMPLATES, GENERIC_BASE_PROMPT, getStoryArchitecture } from './story-templates';

export interface WritingCoachInput {
  script: string;
  templateId?: StoryTemplateId | null;
  characters: { name: string; description: string }[];
  readingLevel: number;
}

export interface PolishChange {
  original: string;
  revised: string;
  type: 'grammar' | 'conciseness' | 'clarity' | 'expression';
}

export interface WritingCoachResult {
  polish: {
    revisedScript: string;
    changes: PolishChange[];
  };
  strengthen: {
    tips: string[];
    focus: string;
  };
}

/**
 * Build the combined coaching prompt.
 * Returns a system prompt and user prompt pair.
 */
export function buildCoachPrompt(input: WritingCoachInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { script, templateId, characters, readingLevel } = input;

  const characterContext = characters.length > 0
    ? `Characters in this story: ${characters.map(c => `${c.name} (${c.description})`).join(', ')}`
    : 'No specific characters defined yet.';

  // Get template coaching focus and architecture if a template is selected
  let strengthenInstructions: string;
  let templateName: string;

  if (templateId && STORY_TEMPLATES[templateId]) {
    const template = STORY_TEMPLATES[templateId];
    const architecture = getStoryArchitecture(templateId);
    templateName = template.name;

    // Build architecture-aware strengthen instructions
    const architectureContext = architecture ? `
STORY ARCHITECTURE FOR THIS TEMPLATE:
The story should follow this narrative structure:
${architecture.requiredBeats.map((beat, i) => `${i + 1}. ${beat}`).join('\n')}

Scene Flow:
${architecture.sceneFlowGuidance}

Pedagogical Checkpoints:
${architecture.pedagogicalCheckpoints.map((cp, i) => `• ${cp}`).join('\n')}

` : '';

    strengthenInstructions = `This is a "${template.name}" story. Based on this category, check if the script addresses these aspects:
${template.coachingFocus.map((f, i) => `${i + 1}. ${f}`).join('\n')}

${architectureContext}
YOUR TASK:
1. Read the user's script carefully
2. Identify which story beats/checkpoints are present
3. Identify which beats/checkpoints are MISSING or weak
4. Generate 9 specific, age-appropriate questions that guide the child to strengthen their story based on what's MISSING or could be improved
5. Reference actual characters and events from their script in your questions
6. Focus on the narrative structure and pedagogical aspects that the script doesn't yet address well

IMPORTANT: Ask questions that help them add missing beats or strengthen weak ones. For example:
- "Your story has a great setup, but what challenge could [Character] face?"
- "How does [Character] feel when [event] happens?"
- "What does [Character] learn by the end?"`;
  } else {
    templateName = 'General';
    strengthenInstructions = `This is a freeform story (no specific category selected). Check for general story structure:
1. Does it have a clear beginning that sets up the situation?
2. Does it have an engaging middle with events or challenges?
3. Does it have a satisfying ending?
4. Are characters involved in meaningful actions?
5. Are there sensory details or emotions?

Generate 9 specific, age-appropriate questions that guide the child to strengthen their story.`;
  }

  const systemPrompt = `You are a writing coach for children ages 7-12. Your job is to help young writers improve their story scripts in TWO ways:

1. POLISH: Fix grammar, spelling, and punctuation. Improve conciseness and clarity. Also suggest better word choices or more expressive/vivid phrasing where the meaning stays the same but the writing becomes stronger or more logical.
2. STRENGTHEN: Ask guiding QUESTIONS that help the child think about their story more deeply. NEVER give answers or rewrite the story — only ask questions.

CRITICAL RULES FOR POLISH:
- Fix genuine grammar, spelling, and punctuation issues.
- Suggest better ways to express ideas — use more vivid, precise, or logical wording when appropriate.
- Capitalize character names and proper nouns consistently.
- Keep the child's voice and intent. Don't over-rewrite.
- IMPORTANT: The revisedScript MUST preserve the original line-by-line structure. Each scene must remain on its own separate line, separated by newline characters (\\n). Do NOT merge multiple scenes into one line. The number of non-empty lines in revisedScript must match the original.

CRITICAL RULES FOR STRENGTHEN:
- Ask SPECIFIC questions about THIS script, not generic advice.
- Reference actual characters and events from the script.
- Questions must be age-appropriate for ${readingLevel}-year-olds — use concrete, simple language.
- NEVER patronize. Treat the child as a capable writer who can improve.

${characterContext}

You MUST return valid JSON in this exact format:
{
  "polish": {
    "revisedScript": "the full script with corrections applied, preserving original line breaks",
    "changes": [
      {
        "original": "exact text that was changed",
        "revised": "the corrected text",
        "type": "grammar" | "conciseness" | "clarity" | "expression"
      }
    ]
  },
  "strengthen": {
    "tips": [
      "Question 1 about this specific script?",
      "Question 2 about this specific script?",
      "Question 3 about this specific script?",
      "... up to 9 questions total"
    ],
    "focus": "${templateName}"
  }
}

The "type" field for each change should be:
- "grammar" for spelling, punctuation, capitalization, tense fixes
- "clarity" for restructuring confusing sentences
- "conciseness" for removing unnecessary words
- "expression" for suggesting more vivid, precise, or logical phrasing

Return ONLY the JSON object. No markdown, no code blocks, no explanation.`;

  const userPrompt = `Here is the child's story script (each line is one scene):

"""
${script}
"""

${strengthenInstructions}

Please provide both POLISH corrections and STRENGTHEN questions for this script.`;

  return { systemPrompt, userPrompt };
}
