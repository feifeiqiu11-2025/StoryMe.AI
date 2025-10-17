'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Character, CharacterDescription } from '@/lib/types';

interface CharacterManagerProps {
  characters: Character[];
  onCharactersChange: (characters: Character[]) => void;
  disabled?: boolean;
  showAddButton?: boolean;
  onSaveToLibrary?: (character: Character) => void;
}

const MAX_CHARACTERS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function CharacterManager({
  characters,
  onCharactersChange,
  disabled = false,
  showAddButton = true,
  onSaveToLibrary
}: CharacterManagerProps) {
  const [uploadingCharacterId, setUploadingCharacterId] = useState<string | null>(null);
  const [analyzingCharacterId, setAnalyzingCharacterId] = useState<string | null>(null);
  const [analyzedCharacterId, setAnalyzedCharacterId] = useState<string | null>(null);

  const addCharacter = () => {
    if (characters.length >= MAX_CHARACTERS) return;

    const newCharacter: Character = {
      id: `char-${Date.now()}`,
      name: '',
      referenceImage: {
        url: '',
        fileName: '',
      },
      description: {},
      isPrimary: characters.length === 0, // First character is primary
      order: characters.length + 1,
    };

    onCharactersChange([...characters, newCharacter]);
  };

  const removeCharacter = (characterId: string) => {
    const filtered = characters.filter(c => c.id !== characterId);

    // If we removed the primary character, make the first remaining character primary
    if (filtered.length > 0 && !filtered.some(c => c.isPrimary)) {
      filtered[0].isPrimary = true;
    }

    // Update order
    const reordered = filtered.map((c, idx) => ({ ...c, order: idx + 1 }));
    onCharactersChange(reordered);
  };

  const updateCharacter = (characterId: string, updates: Partial<Character>) => {
    const updated = characters.map(c => {
      if (c.id === characterId) {
        // Deep merge to preserve nested objects like referenceImage and description
        return {
          ...c,
          ...updates,
          // Explicitly preserve referenceImage if not being updated
          referenceImage: updates.referenceImage !== undefined
            ? updates.referenceImage
            : c.referenceImage,
          // Merge description instead of replacing
          description: updates.description !== undefined
            ? { ...c.description, ...updates.description }
            : c.description
        };
      }
      return c;
    });
    onCharactersChange(updated);
  };

  const updateDescription = (characterId: string, field: keyof CharacterDescription, value: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const updatedDescription = {
      ...character.description,
      [field]: value,
    };

    updateCharacter(characterId, { description: updatedDescription });
  };

  const setPrimaryCharacter = (characterId: string) => {
    const updated = characters.map(c => ({
      ...c,
      isPrimary: c.id === characterId,
    }));
    onCharactersChange(updated);
  };

  const handleImageUpload = async (characterId: string, file: File) => {
    setUploadingCharacterId(characterId);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('characterId', characterId);

    try {
      // Upload image first
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      // Store the referenceImage data locally to preserve it during analysis
      const referenceImage = {
        url: data.url,
        fileName: file.name,
      };

      // Update character with image URL
      updateCharacter(characterId, {
        referenceImage,
      });

      // Clear uploading state immediately after image is set
      setUploadingCharacterId(null);

      // Auto-analyze image immediately after upload
      setAnalyzingCharacterId(characterId);

      try {
        const analysisResponse = await fetch('/api/analyze-character-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: data.url,
          }),
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          if (analysisData.success && analysisData.analysis) {
            // Update character with BOTH description AND referenceImage to preserve it
            const updates = {
              referenceImage, // Explicitly include the referenceImage we uploaded
              description: {
                hairColor: analysisData.analysis.hairColor || '',
                skinTone: analysisData.analysis.skinTone || '',
                clothing: analysisData.analysis.clothing || '',
                age: analysisData.analysis.age || '',
                otherFeatures: analysisData.analysis.otherFeatures || '',
              }
            };

            updateCharacter(characterId, updates);

            // Show brief success message
            setAnalyzedCharacterId(characterId);
            setTimeout(() => setAnalyzedCharacterId(null), 3000);
          }
        } else {
          console.warn('Image analysis failed, continuing without auto-fill');
        }
      } catch (analysisError) {
        console.warn('Image analysis error:', analysisError);
        // Continue silently - user can still fill in manually
      } finally {
        setAnalyzingCharacterId(null);
      }

    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
      setUploadingCharacterId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Story Characters</h2>
        <span className="text-sm text-gray-500">{characters.length} / {MAX_CHARACTERS}</span>
      </div>

      {/* Character Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            onRemove={() => removeCharacter(character.id)}
            onUpdate={(updates) => updateCharacter(character.id, updates)}
            onUpdateDescription={(field, value) => updateDescription(character.id, field, value)}
            onSetPrimary={() => setPrimaryCharacter(character.id)}
            onImageUpload={(file) => handleImageUpload(character.id, file)}
            isUploading={uploadingCharacterId === character.id}
            isAnalyzing={analyzingCharacterId === character.id}
            showAnalyzedBadge={analyzedCharacterId === character.id}
            disabled={disabled}
            onSaveToLibrary={onSaveToLibrary}
          />
        ))}
      </div>

      {/* Add Character Button */}
      {showAddButton && characters.length < MAX_CHARACTERS && (
        <button
          onClick={addCharacter}
          disabled={disabled}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Character
        </button>
      )}

      {characters.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          Add at least one character to start creating your story
        </p>
      )}
    </div>
  );
}

interface CharacterCardProps {
  character: Character;
  onRemove: () => void;
  onUpdate: (updates: Partial<Character>) => void;
  onUpdateDescription: (field: keyof CharacterDescription, value: string) => void;
  onSetPrimary: () => void;
  onImageUpload: (file: File) => void;
  isUploading: boolean;
  isAnalyzing: boolean;
  showAnalyzedBadge: boolean;
  disabled: boolean;
  onSaveToLibrary?: (character: Character) => void;
}

function CharacterCard({
  character,
  onRemove,
  onUpdate,
  onUpdateDescription,
  onSetPrimary,
  onImageUpload,
  isUploading,
  isAnalyzing,
  showAnalyzedBadge,
  disabled,
  onSaveToLibrary,
}: CharacterCardProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onImageUpload(acceptedFiles[0]);
      }
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled: disabled || isUploading,
  });

  return (
    <div className={`bg-white rounded-lg border-2 p-4 space-y-3 ${
      character.isPrimary ? 'border-blue-500 shadow-md' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={character.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Character name"
            disabled={disabled}
            className="font-semibold text-lg text-gray-900 placeholder:text-gray-400 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1 disabled:opacity-50"
          />
          {character.isPrimary && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Primary</span>
          )}
        </div>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="text-red-500 hover:text-red-700 text-sm disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      {/* Image Upload */}
      <div className="relative">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          } ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Uploading and analyzing...</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
              <p className="text-sm text-gray-500">
                AI is analyzing appearance details
              </p>
            </div>
          ) : character.referenceImage?.url ? (
            <div className="space-y-2">
              <div className="relative group bg-gray-50 rounded overflow-hidden" style={{ height: '160px' }}>
                <img
                  src={character.referenceImage.url}
                  alt={character.name || 'Character'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    console.error('Image failed to load:', character.referenceImage.url);
                  }}
                  onLoad={(e) => {
                    console.log('Image loaded successfully:', character.referenceImage.url);
                    console.log('Image dimensions:', e.currentTarget.naturalWidth, 'x', e.currentTarget.naturalHeight);
                  }}
                />
                <div className="absolute inset-0 bg-transparent group-hover:bg-black group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center pointer-events-none">
                  <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium drop-shadow-lg transition-opacity">
                    Click to change
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 truncate">{character.referenceImage.fileName}</p>
            </div>
          ) : (
            <div className="space-y-1 py-2">
              <div className="text-sm text-gray-500">
                {isDragActive ? 'Drop photo here' : 'Click or drag photo'}
              </div>
              <p className="text-sm text-gray-500">
                AI will analyze appearance details
              </p>
            </div>
          )}
        </div>

        {/* AI Analyzing Overlay Badge */}
        {isAnalyzing && character.referenceImage.url && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg pointer-events-none">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
              <span className="text-sm text-purple-600 font-medium">AI analyzing...</span>
            </div>
          </div>
        )}

        {/* AI Analyzed Badge */}
        {showAnalyzedBadge && (
          <div className="absolute -top-2 -right-2 bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full shadow-sm animate-bounce">
            ✨ AI analyzed
          </div>
        )}
      </div>

      {/* Description Fields */}
      <div className="space-y-2">
        <input
          type="text"
          value={character.description.hairColor || ''}
          onChange={(e) => onUpdateDescription('hairColor', e.target.value)}
          placeholder="Hair color (e.g., brown, blonde)"
          disabled={disabled}
          className="w-full text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
        />
        <input
          type="text"
          value={character.description.skinTone || ''}
          onChange={(e) => onUpdateDescription('skinTone', e.target.value)}
          placeholder="Skin tone"
          disabled={disabled}
          className="w-full text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
        />
        <input
          type="text"
          value={character.description.clothing || ''}
          onChange={(e) => onUpdateDescription('clothing', e.target.value)}
          placeholder="Clothing (e.g., blue shirt, red jacket)"
          disabled={disabled}
          className="w-full text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
        />
        <input
          type="text"
          value={character.description.age || ''}
          onChange={(e) => onUpdateDescription('age', e.target.value)}
          placeholder="Age (e.g., 8 years old)"
          disabled={disabled}
          className="w-full text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
        />
        <input
          type="text"
          value={character.description.otherFeatures || ''}
          onChange={(e) => onUpdateDescription('otherFeatures', e.target.value)}
          placeholder="Other features"
          disabled={disabled}
          className="w-full text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
        />
      </div>

      {/* Set as Primary */}
      {!character.isPrimary && (
        <button
          onClick={onSetPrimary}
          disabled={disabled}
          className="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 rounded transition-colors disabled:opacity-50"
        >
          Set as Primary Character
        </button>
      )}

      {/* Save to Library - only show if character is not already from library */}
      {onSaveToLibrary && !character.isFromLibrary && (
        <button
          onClick={() => onSaveToLibrary(character)}
          disabled={disabled || !character.name || !character.referenceImage.url}
          className="w-full text-sm bg-green-100 hover:bg-green-200 text-green-700 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={!character.name || !character.referenceImage.url ? 'Add name and image to save' : 'Save character to library'}
        >
          💾 Save to Library
        </button>
      )}
    </div>
  );
}
