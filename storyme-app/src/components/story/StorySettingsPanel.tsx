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
}> = [
  { value: 'playful', label: 'Playful', icon: '🎈' },
  { value: 'friendly', label: 'Friendly', icon: '🤗' },
  { value: 'adventure', label: 'Adventure', icon: '⚔️' },
  { value: 'brave', label: 'Brave', icon: '🦁' },
  { value: 'educational', label: 'Educational', icon: '🎓' },
  { value: 'silly', label: 'Silly', icon: '🤪' },
];

const readingLevelLabels: Record<number, { emoji: string; label: string; example: string }> = {
  1: {
    emoji: '🍼',
    label: 'Age 1',
    example: 'Dog!'
  },
  2: {
    emoji: '👶',
    label: 'Age 2',
    example: 'Mommy. Ball.'
  },
  3: {
    emoji: '👧',
    label: 'Age 3',
    example: 'Emma plays. She is happy!'
  },
  4: {
    emoji: '🧒',
    label: 'Age 4',
    example: 'Emma plays outside. She has fun!'
  },
  5: {
    emoji: '👦',
    label: 'Age 5',
    example: 'Emma went to the park. She had so much fun!'
  },
  6: {
    emoji: '📖',
    label: 'Age 6',
    example: 'Emma was playing at the sunny park with her friends.'
  },
  7: {
    emoji: '📚',
    label: 'Age 7',
    example: 'Emma discovered a magical playground where all the swings sparkled.'
  },
  8: {
    emoji: '🎓',
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
            min={1}
            max={8}
            step={1}
            value={readingLevel}
            onChange={(e) => onReadingLevelChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-purple-600"
          />

          {/* Age markers */}
          <div className="flex justify-between mt-2 px-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((age) => (
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

      {/* Expansion Level Selector */}
      <ExpansionLevelSelector
        value={expansionLevel}
        readingLevel={readingLevel}
        onChange={onExpansionLevelChange}
      />
    </div>
  );
}
