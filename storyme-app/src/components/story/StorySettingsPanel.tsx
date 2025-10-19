'use client';

import { StoryTone, ExpansionLevel } from '@/lib/types/story';
import ExpansionLevelSelector from './ExpansionLevelSelector';

interface StorySettingsPanelProps {
  readingLevel: number;
  onReadingLevelChange: (level: number) => void;
  storyTone: StoryTone;
  onStoryToneChange: (tone: StoryTone) => void;
  expansionLevel: ExpansionLevel;
  onExpansionLevelChange: (level: ExpansionLevel) => void;
  disabled?: boolean;
}

const toneOptions: Array<{
  value: StoryTone;
  label: string;
  icon: string;
  description: string;
}> = [
  { value: 'playful', label: 'Playful', icon: '🎈', description: 'Fun and giggly' },
  { value: 'educational', label: 'Educational', icon: '🎓', description: 'Learning-focused' },
  { value: 'adventure', label: 'Adventure', icon: '⚔️', description: 'Brave and exciting' },
  { value: 'gentle', label: 'Gentle', icon: '🌸', description: 'Calm and soothing' },
  { value: 'silly', label: 'Silly', icon: '🤪', description: 'Wacky and absurd' },
  { value: 'mystery', label: 'Mystery', icon: '🔍', description: 'Curious and wondering' },
  { value: 'friendly', label: 'Friendly', icon: '🤝', description: 'Social and kind' },
  { value: 'brave', label: 'Brave', icon: '🦁', description: 'Courageous and strong' },
];

const readingLevelLabels: Record<number, { emoji: string; label: string; example: string }> = {
  3: {
    emoji: '👶',
    label: 'Age 3',
    example: 'Emma plays. She is happy!'
  },
  4: {
    emoji: '👧',
    label: 'Age 4',
    example: 'Emma plays outside. She has fun!'
  },
  5: {
    emoji: '🧒',
    label: 'Age 5',
    example: 'Emma went to the park. She had so much fun!'
  },
  6: {
    emoji: '👦',
    label: 'Age 6',
    example: 'Emma was playing at the sunny park with her friends.'
  },
  7: {
    emoji: '📖',
    label: 'Age 7',
    example: 'Emma discovered a magical playground where all the swings sparkled.'
  },
  8: {
    emoji: '📚',
    label: 'Age 8',
    example: 'Emma explored the enchanted park and found a secret garden full of colorful flowers.'
  },
};

export default function StorySettingsPanel({
  readingLevel,
  onReadingLevelChange,
  storyTone,
  onStoryToneChange,
  expansionLevel,
  onExpansionLevelChange,
  disabled = false,
}: StorySettingsPanelProps) {
  return (
    <div className="w-full space-y-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Story Settings</h3>
        <span className="text-sm text-gray-500">Customize your storybook</span>
      </div>

      {/* Reading Level Slider */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Reading Age
        </label>

        {/* Slider */}
        <div className="relative px-2">
          <input
            type="range"
            min={3}
            max={8}
            step={1}
            value={readingLevel}
            onChange={(e) => onReadingLevelChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-purple-600"
          />

          {/* Age markers */}
          <div className="flex justify-between mt-2 px-1">
            {[3, 4, 5, 6, 7, 8].map((age) => (
              <button
                key={age}
                onClick={() => !disabled && onReadingLevelChange(age)}
                disabled={disabled}
                className={`flex flex-col items-center gap-1 transition-all ${
                  readingLevel === age
                    ? 'scale-110'
                    : 'opacity-50 hover:opacity-75'
                } disabled:cursor-not-allowed`}
              >
                <span className="text-2xl">{readingLevelLabels[age].emoji}</span>
                <span className="text-xs font-medium text-gray-600">
                  {readingLevelLabels[age].label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Example text */}
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <div className="text-xs font-medium text-purple-900 mb-1">
            Text complexity example:
          </div>
          <div className="text-sm text-purple-800 italic">
            "{readingLevelLabels[readingLevel].example}"
          </div>
        </div>
      </div>

      {/* Story Tone Selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Story Tone
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {toneOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => !disabled && onStoryToneChange(option.value)}
              disabled={disabled}
              className={`
                flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                ${
                  storyTone === option.value
                    ? 'border-purple-500 bg-purple-50 shadow-md scale-105'
                    : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-25'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={option.description}
            >
              <span className="text-3xl">{option.icon}</span>
              <span className="text-xs font-medium text-gray-700">
                {option.label}
              </span>
              <span className="text-[10px] text-gray-500 text-center leading-tight">
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Expansion Level Selector */}
      <ExpansionLevelSelector
        value={expansionLevel}
        readingLevel={readingLevel}
        onChange={onExpansionLevelChange}
      />

      {/* Summary */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Your story will be created for{' '}
          <span className="font-semibold text-gray-900">
            {readingLevel}-year-olds
          </span>{' '}
          with a{' '}
          <span className="font-semibold text-gray-900">
            {storyTone}
          </span>{' '}
          tone.
        </div>
      </div>
    </div>
  );
}
