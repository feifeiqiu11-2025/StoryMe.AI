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
}

export default function ExpansionLevelSelector({
  value,
  readingLevel,
  onChange,
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
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700">
        ✨ AI Story Enhancement
      </label>

      <div className="space-y-3">
        {/* Minimal (Default) */}
        <label className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-blue-300 hover:bg-blue-50/50 relative">
          <input
            type="radio"
            name="expansionLevel"
            value="minimal"
            checked={value === 'minimal'}
            onChange={(e) => onChange(e.target.value as ExpansionLevel)}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                Minimal - Keep My Story
              </span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Default
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              AI only improves captions for clarity and age-appropriateness. Your story structure stays exactly the same.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Expected: {getExpectedSceneCount('minimal')}
            </p>
          </div>
          {value === 'minimal' && (
            <div className="absolute -right-1 -top-1 bg-blue-600 text-white rounded-full p-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </label>

        {/* Smart Expansion */}
        <label className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-purple-300 hover:bg-purple-50/50 relative">
          <input
            type="radio"
            name="expansionLevel"
            value="smart"
            checked={value === 'smart'}
            onChange={(e) => onChange(e.target.value as ExpansionLevel)}
            className="mt-1 h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                Smart - Let AI Expand
              </span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                Recommended
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              AI expands your story with more scenes, transitions, and details based on reading level {readingLevel}.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Expected: {getExpectedSceneCount('smart')}
            </p>
          </div>
          {value === 'smart' && (
            <div className="absolute -right-1 -top-1 bg-purple-600 text-white rounded-full p-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </label>

        {/* Rich Expansion */}
        <label className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-orange-300 hover:bg-orange-50/50 relative">
          <input
            type="radio"
            name="expansionLevel"
            value="rich"
            checked={value === 'rich'}
            onChange={(e) => onChange(e.target.value as ExpansionLevel)}
            className="mt-1 h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                Rich - Full Creative Expansion
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              AI creates a fully developed narrative with dialogue, character development, and rich storytelling.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Expected: {getExpectedSceneCount('rich')}
            </p>
          </div>
          {value === 'rich' && (
            <div className="absolute -right-1 -top-1 bg-orange-600 text-white rounded-full p-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </label>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Start with "Minimal" to see how AI enhances your captions. You can always regenerate with more expansion later!
        </p>
      </div>
    </div>
  );
}
