'use client';

import { useState, useEffect } from 'react';
import { validateScript, validateCharacterReferences, extractCharacterNames } from '@/lib/scene-parser';
import { Character } from '@/lib/types/story';
import { StoryTemplateId } from '@/lib/types/story';
import { STORY_TEMPLATES } from '@/lib/ai/story-templates';
import TemplateCategoryCards from './TemplateCategoryCards';

interface ScriptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  characters: Character[];
  selectedTemplate?: StoryTemplateId | null;
  onTemplateChange?: (templateId: StoryTemplateId | null) => void;
  onCoachClick?: () => void;
}

export default function ScriptInput({
  value,
  onChange,
  disabled,
  characters,
  selectedTemplate,
  onTemplateChange,
  onCoachClick,
}: ScriptInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [detectedCharacters, setDetectedCharacters] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Detect characters in the script
    if (value.trim() && characters.length > 0) {
      const allDetectedChars = new Set<string>();
      const lines = value.split('\n').filter(line => line.trim().length > 0);

      lines.forEach(line => {
        const foundChars = extractCharacterNames(line, characters);
        foundChars.forEach(char => allDetectedChars.add(char));
      });

      setDetectedCharacters(allDetectedChars);
    } else {
      setDetectedCharacters(new Set());
    }
  }, [value, characters]);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    setError(null);
    setWarnings([]);
  };

  const handleBlur = () => {
    if (value.trim()) {
      const validation = validateScript(value);
      if (!validation.valid) {
        setError(validation.error || 'Invalid script');
        return;
      }

      // Validate character references
      const charValidation = validateCharacterReferences(value, characters);
      if (!charValidation.valid) {
        setError(charValidation.error || 'Invalid character references');
      } else if (charValidation.warnings) {
        setWarnings(charValidation.warnings);
      }
    }
  };

  const sceneCount = value
    ? value.split('\n').filter(line => line.trim().length > 0).length
    : 0;

  // Dynamic placeholder based on selected template
  const getPlaceholder = (): string => {
    if (characters.length === 0) {
      return 'Add characters first, then describe your story scenes here';
    }

    if (selectedTemplate && STORY_TEMPLATES[selectedTemplate]) {
      return STORY_TEMPLATES[selectedTemplate].placeholderHint;
    }

    // Default placeholder when no template selected
    const charName = characters[0]?.name || 'Connor';
    return `Enter each scene on a new line, for example:\n\n${charName} playing at the playground on a sunny day\n${charName} swinging on the swing, laughing happily`;
  };

  const canCoach = value.trim().length > 0 && !disabled;

  return (
    <div className="w-full space-y-3">
      {/* Template Category Cards */}
      {onTemplateChange && (
        <TemplateCategoryCards
          selectedTemplate={selectedTemplate ?? null}
          onTemplateChange={onTemplateChange}
          disabled={disabled}
        />
      )}

      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Story Scenes
        </label>
        {onCoachClick && (
          <button
            type="button"
            onClick={onCoachClick}
            disabled={!canCoach}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
              border transition-all
              ${canCoach
                ? 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300 hover:shadow-sm'
                : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
              }
            `}
            title="Get writing suggestions and story coaching"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Writing Coach
          </button>
        )}
      </div>

      {/* Character chips */}
      {characters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-600">Available characters:</span>
          {characters.map(char => (
            <span
              key={char.id}
              className={`text-xs px-2 py-1 rounded-full ${
                detectedCharacters.has(char.name)
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}
            >
              {char.name || 'Unnamed'}
            </span>
          ))}
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={getPlaceholder()}
        className={`
          w-full min-h-[200px] p-4 border rounded-lg font-mono text-sm
          text-gray-900 placeholder:text-gray-400 bg-white
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-300' : 'border-gray-300'}
        `}
        rows={10}
      />

      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {characters.length === 0
            ? 'Add characters first to start writing scenes'
            : 'Mention character names in each scene (3-15 scenes recommended)'}
        </div>
        <div className={`font-medium ${sceneCount > 20 ? 'text-red-600' : sceneCount > 15 ? 'text-orange-600' : 'text-gray-600'}`}>
          {sceneCount} scene{sceneCount !== 1 ? 's' : ''} {sceneCount > 20 ? '(MAX 20)' : ''}
        </div>
      </div>

      {/* Max 20 scenes warning */}
      {sceneCount > 20 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700 font-medium">
            Maximum 20 scenes allowed per story
          </p>
          <p className="text-xs text-red-600 mt-1">
            You have {sceneCount} scenes. Please remove {sceneCount - 20} scene{sceneCount - 20 > 1 ? 's' : ''} before continuing.
          </p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning, idx) => (
            <div key={idx} className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
