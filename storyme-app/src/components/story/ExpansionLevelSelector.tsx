/**
 * Expansion Level Selector Component
 * Allows users to choose how much AI should expand their story
 *
 * Options:
 * - As Written: captions use the user's script verbatim, AI only generates image prompts
 * - Light Expansion: enhance captions + may add scenes (never reduces count)
 * - Rich: full creative expansion with dialogue, character arcs, 12-15 scenes
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
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        AI Story Enhancement
      </label>

      {/* Responsive 3-card layout - stacks on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* As Written (Default) */}
        <button
          type="button"
          onClick={() => !disabled && onChange('as_written')}
          disabled={disabled}
          className={`relative flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all text-left ${
            value === 'as_written'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-start gap-2.5 mb-2">
            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
              value === 'as_written'
                ? 'border-blue-500 bg-blue-500'
                : 'border-gray-300 bg-white'
            }`}>
              {value === 'as_written' && (
                <div className="w-2 h-2 rounded-full bg-white"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">As Written</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                  Default
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-snug pl-7">
            Keep your script as-is. AI only generates images.
          </p>
        </button>

        {/* Light Expansion */}
        <button
          type="button"
          onClick={() => !disabled && onChange('light')}
          disabled={disabled}
          className={`relative flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all text-left ${
            value === 'light'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-start gap-2.5 mb-2">
            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
              value === 'light'
                ? 'border-purple-500 bg-purple-500'
                : 'border-gray-300 bg-white'
            }`}>
              {value === 'light' && (
                <div className="w-2 h-2 rounded-full bg-white"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">Light Expansion</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                  Recommended
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-snug pl-7">
            AI enhances captions and may add scenes for age {readingLevel}.
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
          <p className="text-sm text-gray-600 leading-snug pl-7">
            Full narrative with dialogue and character development.
          </p>
        </button>
      </div>
    </div>
  );
}
