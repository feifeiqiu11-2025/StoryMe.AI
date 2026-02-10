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

/**
 * Story Architecture Definition
 *
 * Defines the structural framework for a story template.
 * Used by AI to reorganize scenes into a coherent narrative arc.
 */
export interface StoryArchitecture {
  // Required narrative beats (checkpoints the story must hit)
  requiredBeats: string[];

  // How scenes should flow logically from one to the next
  sceneFlowGuidance: string;

  // Pedagogical checkpoints that must be addressed
  pedagogicalCheckpoints: string[];
}

export interface StoryTemplate {
  id: StoryTemplateId;
  name: string;            // Display label on the card
  tooltip: string;         // Short description shown on hover
  placeholderHint: string; // Dynamic textarea placeholder when this template is selected
  basePrompt: string;      // Pedagogical guidance injected into system prompt (no tone/length/style)
  coachingFocus: string[]; // Aspects the Strengthen coaching checks for
  architecture: StoryArchitecture; // Narrative structure framework (NEW)
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
    architecture: {
      requiredBeats: [
        "Setup: Character in their normal world, establish emotional baseline",
        "Trigger: Emotional challenge or social conflict arises naturally",
        "Response: Character's initial reaction - show specific feelings",
        "Exploration: Character processes the situation (confusion, worry, hope)",
        "Learning: Character gains insight through experience, observation, or help",
        "Resolution: Character applies learning, situation improves",
        "Reflection: End with emotional growth, connection, or confidence"
      ],
      sceneFlowGuidance: `
- Open with character feeling content or engaged (baseline emotion)
- Introduce conflict through misunderstanding, disappointment, change, or fear
- Show character's emotional journey (don't skip the feelings)
- Model healthy choices: asking for help, expressing feelings kindly, trying again
- Resolution shows warmth and reassurance, not shaming
- End with character feeling stronger, connected, or understood`,
      pedagogicalCheckpoints: [
        "At least one scene explicitly names a specific emotion (sad, worried, excited, etc.)",
        "At least one scene shows perspective-taking or empathy (understanding how someone else feels)",
        "At least one scene demonstrates healthy communication (asking questions, expressing feelings, listening)",
        "Resolution shows positive outcome without shaming or punishment",
        "Character experiences emotional growth by the end"
      ]
    },
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
    architecture: {
      requiredBeats: [
        "Setup: Character's normal routine or habit",
        "Challenge: Character skips the habit or faces a choice",
        "Consequence: Show what happens (mild, realistic, not scary)",
        "Explanation: Why the habit matters (health, safety, kindness, responsibility)",
        "Better Choice: Character tries the habit properly",
        "Success: Character experiences positive result",
        "Empowerment: Character feels capable and commits to the habit"
      ],
      sceneFlowGuidance: `
- Begin with character's typical day or routine
- Introduce challenge naturally (forgets, doesn't want to, unsure why it matters)
- Show realistic consequence (tooth hurts, feels tired, mess is hard to clean, etc.)
- Explain WHY in age-appropriate terms (not fear-based)
- Character chooses to try the better way
- Positive outcome reinforces the lesson
- End with character feeling proud and capable`,
      pedagogicalCheckpoints: [
        "The habit or skill is clearly identified (brushing teeth, tidying up, being careful, etc.)",
        "Consequence is realistic and age-appropriate (not scary or punitive)",
        "Explanation shows WHY it matters (health, safety, responsibility, kindness)",
        "Character makes the better choice independently (not forced)",
        "Tone is empowering, not preachy or fear-based"
      ]
    },
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
    architecture: {
      requiredBeats: [
        "Curiosity: Character notices or wonders about something",
        "Discovery: Character finds opportunity to explore (visit, observe, ask)",
        "Observation: Character sees or experiences the topic firsthand",
        "Explanation: Information presented naturally (guide explains, book shows, etc.)",
        "Understanding: Character connects new knowledge to something familiar",
        "Wonder: Character expresses excitement or curiosity about what they learned"
      ],
      sceneFlowGuidance: `
- Start with character's genuine curiosity or question
- Create opportunity for exploration (visit museum, meet expert, read book, observe nature)
- Show character actively observing (not just being told)
- Information delivered through demonstration, comparison, or storytelling
- Use analogies or comparisons to familiar concepts
- End with character feeling curious and excited to learn more`,
      pedagogicalCheckpoints: [
        "Topic is factually accurate (no fantasy explanations for real-world topics)",
        "Information is age-appropriate and uses simple comparisons",
        "Character actively discovers rather than passively receives information",
        "Includes at least one 'Aha!' or 'I learned that...' moment",
        "Ends with curiosity and wonder, not just facts"
      ]
    },
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
    architecture: {
      requiredBeats: [
        "Question: Character faces a problem or wonders how something works",
        "Hypothesis: Character has an idea to try",
        "Test: Character experiments or builds something",
        "Failure: First attempt doesn't work as expected",
        "Learning: Character observes what went wrong and why",
        "New Approach: Character tries a different way based on learning",
        "Discovery: Character succeeds and understands why it worked",
        "Confidence: Character feels proud and capable of figuring things out"
      ],
      sceneFlowGuidance: `
- Open with a problem to solve or question to investigate
- Character proposes an idea (hypothesis)
- Show character actively testing, building, or experimenting
- First attempt fails or has unexpected results (this is KEY)
- Character observes, thinks, and adjusts approach
- Second attempt succeeds because character learned from failure
- End with character feeling like a problem-solver`,
      pedagogicalCheckpoints: [
        "Problem or question is clearly stated",
        "Character demonstrates reasoning or testing (not just luck)",
        "Failure is shown as learning opportunity (not frustrating or shameful)",
        "Character tries a different approach based on observation",
        "Process is more important than perfect outcome",
        "Ends with 'I can figure things out' confidence"
      ]
    },
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
    architecture: {
      requiredBeats: [
        "Want/Goal: Character desires something (toy, treat, experience)",
        "Choice Presented: Character learns the cost or trade-off",
        "Options: Character considers different choices (save, spend now, share)",
        "Decision: Character makes a choice",
        "Consequence: Character experiences the result of their decision",
        "Reflection: Character realizes what they learned about planning or value",
        "Responsibility: Character feels capable of making good choices"
      ],
      sceneFlowGuidance: `
- Start with character wanting something specific
- Introduce real-world context (allowance, birthday money, earned reward)
- Present clear trade-off (spend now vs. save for bigger goal)
- Show character thinking through options
- Character experiences natural consequence (positive or learning moment)
- End with sense of agency and responsibility`,
      pedagogicalCheckpoints: [
        "Financial choice is age-appropriate (allowance, toys, simple goals)",
        "Options are clearly presented (save, spend, share)",
        "Consequences are realistic and balanced (not preachy)",
        "Tone is positive and pressure-free",
        "Character learns about planning, patience, or value",
        "Ends with responsibility and agency, not guilt"
      ]
    },
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
    architecture: {
      requiredBeats: [
        "Normal World: Character in everyday setting",
        "Portal/Trigger: Something magical or unusual happens",
        "Adventure Begins: Character enters new world or situation",
        "Challenge: Character faces obstacle or problem",
        "Creative Solution: Character uses imagination, courage, or cleverness",
        "Climax: Exciting peak moment",
        "Return: Character returns to normal world (or magical world becomes new normal)",
        "Wonder: Character reflects on the adventure with excitement or warmth"
      ],
      sceneFlowGuidance: `
- Open in familiar, relatable setting
- Introduce magical element naturally (discovery, invitation, accident)
- Build sense of wonder and excitement (not fear)
- Challenge is age-appropriate (lost item, helping friend, solving puzzle)
- Character uses creativity and courage to solve problem
- Climax is exciting but not scary
- Resolution brings closure and warmth
- End with sense of possibility and imagination`,
      pedagogicalCheckpoints: [
        "Story has clear beginning (setup), middle (adventure), and end (resolution)",
        "Magical elements are playful and age-appropriate (not dark or scary)",
        "Character demonstrates courage, kindness, or creativity",
        "Challenge is solved through character's actions, not luck",
        "Ends with wonder, warmth, or excitement (not fear or sadness)"
      ]
    },
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
    architecture: {
      requiredBeats: [
        "Setup: Character in everyday situation",
        "Silly Situation: Something unexpected and funny happens",
        "Escalation: Situation gets more ridiculous or playful",
        "Peak Silliness: Funniest or most surprising moment",
        "Resolution: Situation resolves in lighthearted way",
        "Ending: Character (and reader) laugh or smile"
      ],
      sceneFlowGuidance: `
- Start with simple, relatable moment
- Introduce silly twist (exaggeration, mishap, magic gone wrong)
- Build humor through escalation or repetition
- Keep tone light and joyful throughout
- No lesson needed - just fun!
- End with laughter, warmth, or playful surprise`,
      pedagogicalCheckpoints: [
        "Story is genuinely playful or funny (not mean-spirited)",
        "Tone is light and joyful throughout",
        "Situation is silly but not scary or gross",
        "No lesson or moral is required",
        "Ends with laughter, warmth, or happy surprise"
      ]
    },
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

/**
 * Get story architecture by template ID.
 * Returns undefined if template not found.
 */
export function getStoryArchitecture(id: StoryTemplateId): StoryArchitecture | undefined {
  return STORY_TEMPLATES[id]?.architecture;
}
