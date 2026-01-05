/**
 * Expansion Level Selector Component
 * Allows users to choose how much AI should expand their story
 */

'use client';

import { ExpansionLevel } from '@/lib/types/story';

interface ExpansionLevelSelectorProps {
  value: ExpansionLevel;
  readingLevel: number;
  onChange: (level: ExpansionLevel) => void;
  disabled?: boolean;
}

export default function ExpansionLevelSelector({
  value,
  readingLevel,
  onChange,
  disabled = false,
}: ExpansionLevelSelectorProps) {
  const getExpectedSceneCount = (level: ExpansionLevel): string => {
    if (level === 'minimal') return 'Same as your script';

    if (level === 'smart') {
      if (readingLevel <= 4) return '6-8 scenes';
      if (readingLevel <= 6) return '8-10 scenes';
      return '10-12 scenes';
    }

    return '12-15 scenes';
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        AI Story Enhancement
      </label>

      {/* Responsive 3-card layout - stacks on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Minimal (Default) */}
        <button
          type="button"
          onClick={() => !disabled && onChange('minimal')}
          disabled={disabled}
          className={`relative flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all text-left ${
            value === 'minimal'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-start gap-2.5 mb-2">
            {/* Custom radio circle */}
            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
              value === 'minimal'
                ? 'border-blue-500 bg-blue-500'
                : 'border-gray-300 bg-white'
            }`}>
              {value === 'minimal' && (
                <div className="w-2 h-2 rounded-full bg-white"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">Minimal</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                  Default
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-snug mb-1.5 pl-7">
            AI only improves captions for clarity. Your story stays the same.
          </p>
          <p className="text-sm text-gray-400 mt-auto pl-7">
            {getExpectedSceneCount('minimal')}
          </p>
        </button>

        {/* Smart Expansion */}
        <button
          type="button"
          onClick={() => !disabled && onChange('smart')}
          disabled={disabled}
          className={`relative flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all text-left ${
            value === 'smart'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-start gap-2.5 mb-2">
            {/* Custom radio circle */}
            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
              value === 'smart'
                ? 'border-purple-500 bg-purple-500'
                : 'border-gray-300 bg-white'
            }`}>
              {value === 'smart' && (
                <div className="w-2 h-2 rounded-full bg-white"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">Smart</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                  Recommended
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-snug mb-1.5 pl-7">
            AI expands with more scenes and transitions for age {readingLevel}.
          </p>
          <p className="text-sm text-gray-400 mt-auto pl-7">
            {getExpectedSceneCount('smart')}
          </p>
        </button>

        {/* Rich Expansion */}
        <button
          type="button"
          onClick={() => !disabled && onChange('rich')}
          disabled={disabled}
          className={`relative flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all text-left ${
            value === 'rich'
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-start gap-2.5 mb-2">
            {/* Custom radio circle */}
            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
              value === 'rich'
                ? 'border-orange-500 bg-orange-500'
                : 'border-gray-300 bg-white'
            }`}>
              {value === 'rich' && (
                <div className="w-2 h-2 rounded-full bg-white"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-gray-900 text-sm">Rich</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-snug mb-1.5 pl-7">
            Full narrative with dialogue and character development.
          </p>
          <p className="text-sm text-gray-400 mt-auto pl-7">
            {getExpectedSceneCount('rich')}
          </p>
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Start with "Minimal" to see how AI enhances your captions. You can always regenerate with more expansion later!
        </p>
      </div>
    </div>
  );
}
