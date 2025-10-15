'use client';

import { useState, useEffect } from 'react';
import { validateScript, getSampleScript, validateCharacterReferences, extractCharacterNames } from '@/lib/scene-parser';
import { Character } from '@/lib/types';

interface ScriptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  characters: Character[];
}

export default function ScriptInput({ value, onChange, disabled, characters }: ScriptInputProps) {
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

  const loadSample = () => {
    const sample = getSampleScript();
    onChange(sample);
    setError(null);
    setWarnings([]);
  };

  const sceneCount = value
    ? value.split('\n').filter(line => line.trim().length > 0).length
    : 0;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Story Scenes
        </label>
        <button
          type="button"
          onClick={loadSample}
          disabled={disabled}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          Load Example Script
        </button>
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
        placeholder={`Enter each scene on a new line, for example:

${characters.length > 0
  ? `${characters[0]?.name || 'Connor'} playing at the playground on a sunny day
${characters[0]?.name || 'Connor'} swinging on the swing, laughing happily`
  : 'Add characters first, then describe your story scenes here'}`}
        className={`
          w-full min-h-[200px] p-4 border rounded-lg font-mono text-sm
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-300' : 'border-gray-300'}
        `}
        rows={10}
      />

      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {characters.length === 0
            ? '⚠️ Add characters first to start writing scenes'
            : 'ℹ️ Mention character names in each scene (3-15 scenes recommended)'}
        </div>
        <div className={`font-medium ${sceneCount > 15 ? 'text-red-600' : 'text-gray-600'}`}>
          {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning, idx) => (
            <div key={idx} className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
