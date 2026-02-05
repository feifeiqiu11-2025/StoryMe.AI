'use client';

import { StoryTone, ExpansionLevel, ClothingConsistency } from '@/lib/types/story';
import ExpansionLevelSelector from './ExpansionLevelSelector';

export interface StorySettingsPanelProps {
  readingLevel: number;
  onReadingLevelChange: (level: number) => void;
  storyTone: StoryTone;
  onStoryToneChange: (tone: StoryTone) => void;
  clothingConsistency?: ClothingConsistency;
  onClothingConsistencyChange?: (mode: ClothingConsistency) => void;
  expansionLevel?: ExpansionLevel;
  onExpansionLevelChange?: (level: ExpansionLevel) => void;
  // Bilingual options (only shown for English content)
  contentLanguage?: 'en' | 'zh';
  generateChineseTranslation?: boolean;
  onGenerateChineseTranslationChange?: (value: boolean) => void;
  disabled?: boolean;
}

const toneOptions: Array<{
  value: StoryTone;
  label: string;
  icon: string;
}> = [
  { value: 'playful', label: 'Playful', icon: '🎈' },
  { value: 'friendly', label: 'Friendly', icon: '🤗' },
  { value: 'adventure', label: 'Adventure', icon: '⚔️' },
  { value: 'educational', label: 'Educational', icon: '🎓' },
];

/**
 * Internal Lexile mapping for reading ages 1-12.
 * Used for tooltip display and AI prompt context.
 */
const readingLevelLabels: Record<number, {
  emoji: string;
  label: string;
  example: string;
  lexile: string;
  grade: string;
}> = {
  1: {
    emoji: '🍼',
    label: 'Age 1',
    example: 'Dog!',
    lexile: '~100L',
    grade: 'Pre-K',
  },
  2: {
    emoji: '👶',
    label: 'Age 2',
    example: 'Mommy. Ball.',
    lexile: '~200L',
    grade: 'Pre-K',
  },
  3: {
    emoji: '👧',
    label: 'Age 3',
    example: 'Emma plays. She is happy!',
    lexile: '~300L',
    grade: 'Pre-K',
  },
  4: {
    emoji: '🧒',
    label: 'Age 4',
    example: 'Emma plays outside. She has fun!',
    lexile: '~350L',
    grade: 'Pre-K',
  },
  5: {
    emoji: '👦',
    label: 'Age 5',
    example: 'Emma went to the park. She had so much fun!',
    lexile: '~400L',
    grade: 'K',
  },
  6: {
    emoji: '📖',
    label: 'Age 6',
    example: 'Emma was playing at the sunny park with her friends.',
    lexile: '~500L',
    grade: 'Grade 1',
  },
  7: {
    emoji: '📚',
    label: 'Age 7',
    example: 'Emma discovered a magical playground where all the swings sparkled.',
    lexile: '~600L',
    grade: 'Grade 2',
  },
  8: {
    emoji: '🎓',
    label: 'Age 8',
    example: 'Emma explored the enchanted park and found a secret garden full of colorful flowers.',
    lexile: '~700L',
    grade: 'Grade 3',
  },
  9: {
    emoji: '🔬',
    label: 'Age 9',
    example: 'Emma hesitated at the forest edge, wondering if she was brave enough to find the hidden waterfall.',
    lexile: '~800L',
    grade: 'Grade 4',
  },
  10: {
    emoji: '🌍',
    label: 'Age 10',
    example: 'The ancient map revealed a path no one in town remembered, but Emma was determined to follow it.',
    lexile: '~900L',
    grade: 'Grade 5',
  },
  11: {
    emoji: '🔭',
    label: 'Age 11',
    example: 'As the last light faded behind the mountains, Emma realized the journey had changed her in ways she hadn\'t expected.',
    lexile: '~1000L',
    grade: 'Grade 6',
  },
  12: {
    emoji: '🎯',
    label: 'Age 12',
    example: 'The old library held secrets that the town council preferred forgotten, but curiosity, Emma decided, was stronger than caution.',
    lexile: '~1050L',
    grade: 'Grade 7',
  },
};

export default function StorySettingsPanel({
  readingLevel,
  onReadingLevelChange,
  storyTone,
  onStoryToneChange,
  clothingConsistency = 'consistent',
  onClothingConsistencyChange,
  expansionLevel = 'as_written',
  onExpansionLevelChange,
  contentLanguage = 'en',
  generateChineseTranslation = false,
  onGenerateChineseTranslationChange,
  disabled = false,
}: StorySettingsPanelProps) {
  const currentLevel = readingLevelLabels[readingLevel];

  return (
    <div className="w-full space-y-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Story Settings</h3>
        <span className="text-sm text-gray-500">Customize your storybook</span>
      </div>

      {/* Reading Level Selector */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
          <label className="block text-sm font-semibold text-gray-700">
            Reading Age
          </label>
          <p className="text-sm text-purple-700 italic">
            &ldquo;{currentLevel.example}&rdquo;
          </p>
        </div>

        {/* Slider with number labels */}
        <div className="space-y-1">
          <div className="relative px-2">
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={readingLevel}
              onChange={(e) => !disabled && onReadingLevelChange(Number(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600 disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>
          {/* Number labels under slider */}
          <div className="flex justify-between px-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => !disabled && onReadingLevelChange(age)}
                disabled={disabled}
                className={`
                  w-6 text-center text-xs font-semibold transition-all rounded-full leading-5
                  ${readingLevel === age
                    ? 'text-purple-700 bg-purple-100'
                    : 'text-gray-400 hover:text-purple-600'
                  }
                  ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {age}
              </button>
            ))}
          </div>
        </div>

        {/* Lexile + grade info */}
        <div className="text-xs text-gray-500 text-center">
          {currentLevel.lexile} Lexile &middot; {currentLevel.grade}
        </div>
      </div>

      {/* Story Tone Selector */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Story Tone
        </label>

        <div className="flex gap-2">
          {toneOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => !disabled && onStoryToneChange(option.value)}
              disabled={disabled}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 transition-all min-w-0
                ${
                  storyTone === option.value
                    ? 'border-purple-500 bg-purple-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-25'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <span className="text-2xl">{option.icon}</span>
              <span className="text-xs font-medium text-gray-700 truncate w-full text-center">
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Character Clothing Consistency */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Character Clothing
        </label>

        <div className="grid grid-cols-2 gap-3">
          {/* Consistent Option (Default) */}
          <button
            type="button"
            onClick={() => !disabled && onClothingConsistencyChange?.('consistent')}
            disabled={disabled}
            className={`relative flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all text-left ${
              clothingConsistency === 'consistent'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-2.5 mb-2">
              <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                clothingConsistency === 'consistent'
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300 bg-white'
              }`}>
                {clothingConsistency === 'consistent' && (
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">Consistent</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                    Default
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-snug pl-7">
              Same outfit throughout all scenes
            </p>
          </button>

          {/* Scene-Based Option */}
          <button
            type="button"
            onClick={() => !disabled && onClothingConsistencyChange?.('scene-based')}
            disabled={disabled}
            className={`relative flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all text-left ${
              clothingConsistency === 'scene-based'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-2.5 mb-2">
              <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                clothingConsistency === 'scene-based'
                  ? 'border-purple-500 bg-purple-500'
                  : 'border-gray-300 bg-white'
              }`}>
                {clothingConsistency === 'scene-based' && (
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900 text-sm">Scene-Based</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-snug pl-7">
              AI adapts to scene context
            </p>
          </button>
        </div>
      </div>

      {/* Expansion Level Selector */}
      {onExpansionLevelChange && (
        <ExpansionLevelSelector
          value={expansionLevel}
          readingLevel={readingLevel}
          onChange={onExpansionLevelChange}
        />
      )}

      {/* Chinese Captions Checkbox (Only for English stories) */}
      {contentLanguage === 'en' && onGenerateChineseTranslationChange && (
        <div className="flex items-center gap-3 pt-2">
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              id="bilingual-checkbox-settings"
              checked={generateChineseTranslation}
              onChange={(e) => onGenerateChineseTranslationChange(e.target.checked)}
              disabled={disabled}
              className="peer w-5 h-5 appearance-none bg-white border-2 border-gray-400 rounded cursor-pointer checked:bg-purple-600 checked:border-purple-600 focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
            <svg
              className="absolute w-3 h-3 left-1 top-1 pointer-events-none hidden peer-checked:block text-white"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <label htmlFor="bilingual-checkbox-settings" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
            Generate Chinese Captions for Bilingual Book
          </label>
        </div>
      )}
    </div>
  );
}
