'use client';

import { useState } from 'react';
import { EnhancedScene } from '@/lib/types/story';

interface EnhancementPreviewProps {
  enhancedScenes: EnhancedScene[];
  onCaptionEdit: (sceneNumber: number, newCaption: string) => void;
  onRegenerateAll: () => void;
  onProceedToGenerate: () => void;
  isGenerating?: boolean;
  readingLevel: number;
  storyTone: string;
}

export default function EnhancementPreview({
  enhancedScenes,
  onCaptionEdit,
  onRegenerateAll,
  onProceedToGenerate,
  isGenerating = false,
  readingLevel,
  storyTone,
}: EnhancementPreviewProps) {
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editedCaption, setEditedCaption] = useState<string>('');

  const handleStartEdit = (scene: EnhancedScene) => {
    setEditingScene(scene.sceneNumber);
    setEditedCaption(scene.caption);
  };

  const handleSaveEdit = (sceneNumber: number) => {
    onCaptionEdit(sceneNumber, editedCaption);
    setEditingScene(null);
    setEditedCaption('');
  };

  const handleCancelEdit = () => {
    setEditingScene(null);
    setEditedCaption('');
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Scene Enhancement Preview
            </h2>
            <p className="text-sm text-gray-600">
              Review AI-enhanced scenes before generating images. Each scene has been optimized for{' '}
              <span className="font-semibold">age {readingLevel}</span> with a{' '}
              <span className="font-semibold">{storyTone}</span> tone.
            </p>
          </div>
          <button
            onClick={onRegenerateAll}
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🔄 Regenerate All
          </button>
        </div>
      </div>

      {/* Scene Cards */}
      <div className="space-y-4">
        {enhancedScenes.map((scene) => (
          <div
            key={scene.sceneNumber}
            className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
          >
            {/* Scene Header */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Scene {scene.sceneNumber}
                </h3>
                {scene.characterNames && scene.characterNames.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Characters:</span>
                    {scene.characterNames.map((name, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Scene Content */}
            <div className="p-4 space-y-4">
              {/* Original Input */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  Your Original Input
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm text-gray-700 italic">
                    "{scene.raw_description}"
                  </p>
                </div>
              </div>

              {/* Enhanced Prompt */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  Enhanced Image Prompt (for AI)
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-gray-800">
                    {scene.enhanced_prompt}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This detailed description will be used to generate the image
                </p>
              </div>

              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Story Caption (Age {readingLevel}, {storyTone})
                  </div>
                  {editingScene !== scene.sceneNumber && (
                    <button
                      onClick={() => handleStartEdit(scene)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>

                {editingScene === scene.sceneNumber ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedCaption}
                      onChange={(e) => setEditedCaption(e.target.value)}
                      className="w-full p-3 border border-purple-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      rows={3}
                      placeholder="Edit caption..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(scene.sceneNumber)}
                        className="px-3 py-1 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                    <p className="text-base text-gray-900 font-medium leading-relaxed">
                      {scene.caption}
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-1">
                  This text will appear in your storybook PDF
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {enhancedScenes.length} scene{enhancedScenes.length !== 1 ? 's' : ''} ready for image generation
        </div>
        <button
          onClick={onProceedToGenerate}
          disabled={isGenerating}
          className="px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
        >
          {isGenerating ? (
            <>
              <span className="inline-block animate-spin mr-2">⏳</span>
              Generating Images...
            </>
          ) : (
            <>
              🎨 Generate Images →
            </>
          )}
        </button>
      </div>
    </div>
  );
}
