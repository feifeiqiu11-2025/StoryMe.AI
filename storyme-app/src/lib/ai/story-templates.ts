/**
 * Story Templates / Categories
 *
 * Each template provides pedagogical guidance for story generation.
 * Templates define WHAT kind of story (subject matter & learning approach).
 * They do NOT define tone, scene count, or style — those come from Story Settings.
 *
 * Prompt layering:
 *   Final prompt = generic guardrails
 *                + template base prompt (if selected)
 *                + user's script (core)
 *                + setting modifiers (tone, expansion, reading level)
 */

export type StoryTemplateId =
  | 'sel'
  | 'life_skills'
  | 'knowledge'
  | 'stem'
  | 'finance'
  | 'fiction'
  | 'just_for_fun';

export interface StoryTemplate {
  id: StoryTemplateId;
  name: string;            // Display label on the card
  tooltip: string;         // Short description shown on hover
  placeholderHint: string; // Dynamic textarea placeholder when this template is selected
  basePrompt: string;      // Pedagogical guidance injected into system prompt (no tone/length/style)
  coachingFocus: string[]; // Aspects the Strengthen coaching checks for
}

export const DEFAULT_TEMPLATE_ID: StoryTemplateId = 'sel';

/**
 * Generic base prompt used when no template is selected (freeform mode).
 * Provides basic quality guardrails without category-specific pedagogy.
 */
export const GENERIC_BASE_PROMPT = `This is a children's story. Requirements:
- Age-appropriate and safe content
- Clear narrative structure (beginning, middle, end)
- Positive or constructive resolution
- No scary, threatening, or harmful elements`;

export const STORY_TEMPLATES: Record<StoryTemplateId, StoryTemplate> = {
  sel: {
    id: 'sel',
    name: 'Social & Emotional Learning',
    tooltip: 'Feelings, friendships, and understanding others',
    placeholderHint: 'What feeling or friendship challenge should your character face?\ne.g., Emma feels left out when her best friend plays with someone new...',
    basePrompt: `This is a Social & Emotional Learning (SEL) story.
Requirements:
- Help the child recognize feelings and understand others
- Model healthy communication and respectful boundaries
- Show choices, consequences, and learning
- Avoid shame, fear, or labels
- End with reassurance, connection, or confidence`,
    coachingFocus: [
      'identifying and naming emotions',
      'showing empathy or perspective-taking',
      'demonstrating healthy communication',
      'showing choices and their consequences',
      'ending with connection or confidence',
    ],
  },

  life_skills: {
    id: 'life_skills',
    name: 'Life Skills & Health',
    tooltip: 'Habits, routines, safety, and self-care',
    placeholderHint: 'What daily habit or life skill should your character learn?\ne.g., Dino learns why brushing teeth every night matters...',
    basePrompt: `This is a Life Skills & Health story.
Requirements:
- Realistic and age-appropriate
- Explain why the habit or rule matters
- Show cause, effect, and better choices
- Use gentle guidance, not fear or punishment
- End with empowerment and consistency`,
    coachingFocus: [
      'explaining why the habit matters',
      'showing cause and effect',
      'demonstrating a better choice',
      'using gentle guidance instead of fear',
      'ending with empowerment',
    ],
  },

  knowledge: {
    id: 'knowledge',
    name: 'Knowledge & World Exploration',
    tooltip: 'Animals, nature, space, and cultures',
    placeholderHint: 'What topic should your character explore and learn about?\ne.g., Emma visits the ocean and discovers how dolphins communicate...',
    basePrompt: `This is a Knowledge & World Exploration story.
Requirements:
- Factually accurate and age-appropriate
- Explain concepts through observation and explanation
- Use simple comparisons or categories when helpful
- Avoid fantasy explanations for real topics
- End with curiosity and understanding`,
    coachingFocus: [
      'factual accuracy',
      'explaining concepts through observation',
      'using comparisons to make ideas accessible',
      'building curiosity about the topic',
      'ending with understanding or wonder',
    ],
  },

  stem: {
    id: 'stem',
    name: 'STEM Thinking',
    tooltip: 'Problem-solving, science, and how things work',
    placeholderHint: 'What problem should your character solve or experiment with?\ne.g., Dino tries to build a bridge strong enough to cross the river...',
    basePrompt: `This is a STEM Thinking story.
Requirements:
- Embed thinking moments naturally in the story
- Show reasoning, problem-solving, or testing
- Avoid quizzes or worksheet-style questions
- Encourage curiosity and confidence in thinking
- End with a sense of "I can figure things out"`,
    coachingFocus: [
      'showing a problem or question to investigate',
      'demonstrating reasoning or testing',
      'showing what happens when something fails',
      'trying a different approach',
      'ending with discovery or confidence',
    ],
  },

  finance: {
    id: 'finance',
    name: 'Finance & Value',
    tooltip: 'Saving, spending, sharing, and planning',
    placeholderHint: 'What money or value lesson should your character experience?\ne.g., Emma wants a new toy but learns to save her allowance first...',
    basePrompt: `This is a Finance & Value story.
Requirements:
- Use child-relevant examples (allowance, toys, goals)
- Show choices and outcomes clearly
- Emphasize balance: save, spend, share
- Keep tone positive and pressure-free
- End with a sense of responsibility and agency`,
    coachingFocus: [
      'presenting a clear financial choice',
      'showing consequences of different decisions',
      'balancing saving, spending, and sharing',
      'keeping the tone pressure-free',
      'ending with responsibility or agency',
    ],
  },

  fiction: {
    id: 'fiction',
    name: 'Fiction & Fantasy',
    tooltip: 'Imaginative adventures and creativity',
    placeholderHint: 'What imaginative adventure should your character go on?\ne.g., Dino discovers a magical door in the garden that leads to a candy kingdom...',
    basePrompt: `This is a Fiction & Fantasy story.
Requirements:
- Imaginative, playful, and age-safe
- Clear beginning, adventure, and resolution
- Avoid scary or threatening elements
- End with comfort, wonder, or excitement`,
    coachingFocus: [
      'having a clear beginning and setup',
      'building an exciting adventure or challenge',
      'creating a satisfying resolution',
      'using imaginative and vivid details',
      'ending with wonder or excitement',
    ],
  },

  just_for_fun: {
    id: 'just_for_fun',
    name: 'Just for Fun',
    tooltip: 'Silly, playful, no lesson needed',
    placeholderHint: 'What fun or silly situation should your character get into?\ne.g., Emma accidentally turns her cat into a giant marshmallow...',
    basePrompt: `This is a Just for Fun story.
Requirements:
- Light, playful, and joyful
- Simple, engaging language
- No lesson required
- End with laughter, warmth, or surprise`,
    coachingFocus: [
      'keeping the story light and fun',
      'using playful or surprising moments',
      'having an engaging setup',
      'building to a funny or warm ending',
      'keeping language simple and joyful',
    ],
  },
};

/**
 * Get template by ID, returns undefined if not found.
 */
export function getStoryTemplate(id: StoryTemplateId): StoryTemplate {
  return STORY_TEMPLATES[id];
}

/**
 * Get all templates as an ordered array for UI rendering.
 */
export function getTemplateList(): StoryTemplate[] {
  const order: StoryTemplateId[] = [
    'sel',
    'life_skills',
    'knowledge',
    'stem',
    'finance',
    'fiction',
    'just_for_fun',
  ];
  return order.map(id => STORY_TEMPLATES[id]);
}
