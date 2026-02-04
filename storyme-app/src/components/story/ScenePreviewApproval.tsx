/**
 * Scene Preview & Approval Component
 * Shows enhanced scenes before expensive image generation
 * User can review and approve/reject before committing
 */

'use client';

import React, { useState } from 'react';
import { EnhancedScene } from '@/lib/types/story';

// Art style type
type ArtStyleType = 'pixar' | 'classic';

interface ScenePreviewApprovalProps {
  enhancedScenes: EnhancedScene[];
  originalSceneCount: number;
  userCharacters: string[];
  onApprove: () => void;
  onBack: () => void;
  onCaptionEdit?: (sceneNumber: number, newCaption: string) => void;
  onCaptionChineseEdit?: (sceneNumber: number, newCaptionChinese: string) => void;  // NEW
  onImagePromptEdit?: (sceneNumber: number, newPrompt: string) => void;  // NEW: For image prompt editing
  onScenesUpdate?: (updatedScenes: EnhancedScene[]) => void;
  isGenerating: boolean;
  // NEW: Handlers for cover metadata editing
  onTitleEdit?: (newTitle: string) => void;
  onDescriptionEdit?: (newDescription: string) => void;
  // Settings for new scene enhancement
  readingLevel?: number;
  storyTone?: string;
  expansionLevel?: string;
  contentLanguage?: 'en' | 'zh';
  generateChineseTranslation?: boolean;  // NEW: For bilingual stories
  // Art style and image provider settings
  artStyle?: ArtStyleType;
  onArtStyleChange?: (style: ArtStyleType) => void;
  imageProvider?: 'flux' | 'gemini';
  onImageProviderChange?: (provider: 'flux' | 'gemini') => void;
}

export default function ScenePreviewApproval({
  enhancedScenes,
  originalSceneCount,
  userCharacters,
  onApprove,
  onBack,
  onCaptionEdit,
  onCaptionChineseEdit,
  onImagePromptEdit,
  onScenesUpdate,
  isGenerating,
  onTitleEdit,
  onDescriptionEdit,
  readingLevel = 5,
  storyTone = 'playful',
  expansionLevel = 'minimal',
  contentLanguage = 'en',
  generateChineseTranslation = false,
  artStyle = 'classic',
  onArtStyleChange,
  imageProvider = 'gemini',
  onImageProviderChange,
}: ScenePreviewApprovalProps) {
  // Add Scene Modal State
  const [showAddSceneModal, setShowAddSceneModal] = useState(false);
  const [insertAfterSceneNumber, setInsertAfterSceneNumber] = useState(0);
  const [newSceneDescription, setNewSceneDescription] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [isEnhancingNewScene, setIsEnhancingNewScene] = useState(false);
  const [addSceneError, setAddSceneError] = useState('');

  // Re-enhance All State
  const [isReEnhancing, setIsReEnhancing] = useState(false);
  // Find characters that AI added (not in user's original list)
  const allCharacters = new Set<string>();
  enhancedScenes.forEach(scene => {
    scene.characterNames?.forEach(name => allCharacters.add(name));
  });

  const newCharacters = Array.from(allCharacters).filter(
    char => !userCharacters.some(userChar =>
      userChar.toLowerCase() === char.toLowerCase()
    )
  );

  const sceneCountIncreased = enhancedScenes.length > originalSceneCount;

  // Delete scene handler
  const handleDeleteScene = (sceneNumber: number) => {
    if (!onScenesUpdate) return;

    // Prevent deleting cover (Scene 0)
    if (sceneNumber === 0) {
      alert('Cannot delete the cover. The story must have a cover.');
      return;
    }

    if (enhancedScenes.length <= 1) {
      alert('Cannot delete the only scene. Stories must have at least one scene.');
      return;
    }

    if (!confirm(`Delete Scene ${sceneNumber}? This cannot be undone.`)) {
      return;
    }

    // Remove scene and re-number
    const updatedScenes = enhancedScenes
      .filter(s => s.sceneNumber !== sceneNumber)
      .map((s, index) => ({
        ...s,
        sceneNumber: index + 1 // Re-number sequentially
      }));

    onScenesUpdate(updatedScenes);
  };

  // Add scene handler
  const handleAddSceneClick = (afterSceneNumber: number) => {
    if (enhancedScenes.length >= 20) {
      alert('Maximum 20 scenes allowed per story.');
      return;
    }

    setInsertAfterSceneNumber(afterSceneNumber);
    setNewSceneDescription('');
    setSelectedCharacters([]);
    setAddSceneError('');
    setShowAddSceneModal(true);
  };

  // Confirm add scene - call API to enhance
  const handleConfirmAddScene = async () => {
    if (!onScenesUpdate) return;

    if (!newSceneDescription.trim()) {
      setAddSceneError('Please enter a scene description');
      return;
    }

    if (newSceneDescription.trim().length < 10) {
      setAddSceneError('Please provide more detail (at least 10 characters)');
      return;
    }

    setIsEnhancingNewScene(true);
    setAddSceneError('');

    try {
      // Call API to enhance the new scene
      const response = await fetch('/api/enhance-single-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneDescription: newSceneDescription.trim(),
          characterNames: selectedCharacters,
          readingLevel,
          storyTone,
          expansionLevel,
          language: contentLanguage
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to enhance scene');
      }

      const data = await response.json();

      // Insert new scene at correct position
      const newScene: EnhancedScene = {
        sceneNumber: insertAfterSceneNumber + 1, // Will be re-numbered
        raw_description: newSceneDescription.trim(),
        enhanced_prompt: data.enhanced_prompt,
        caption: data.caption,
        characterNames: selectedCharacters
      };

      // Insert and re-number all scenes
      const updatedScenes = [
        ...enhancedScenes.slice(0, insertAfterSceneNumber),
        newScene,
        ...enhancedScenes.slice(insertAfterSceneNumber)
      ].map((s, index) => ({
        ...s,
        sceneNumber: index + 1
      }));

      onScenesUpdate(updatedScenes);
      setShowAddSceneModal(false);

    } catch (error) {
      console.error('Failed to add scene:', error);
      setAddSceneError(error instanceof Error ? error.message : 'Failed to add scene. Please try again.');
    } finally {
      setIsEnhancingNewScene(false);
    }
  };

  // Re-enhance all scenes handler
  const handleReEnhanceAll = async () => {
    if (!onScenesUpdate) return;

    if (!confirm(`Re-enhance all ${enhancedScenes.length} scenes? This will update captions and image prompts based on your current story settings. Scene count will stay at ${enhancedScenes.length}.`)) {
      return;
    }

    setIsReEnhancing(true);

    try {
      // Process each scene individually using the enhance-single-scene API
      // to preserve scene count and just update captions/prompts
      const enhancedResults = await Promise.all(
        enhancedScenes.map(async (scene) => {
          try {
            const response = await fetch('/api/enhance-single-scene', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sceneDescription: scene.raw_description || scene.caption,
                characterNames: scene.characterNames || [],
                readingLevel,
                storyTone,
                expansionLevel,
                language: contentLanguage
              })
            });

            if (!response.ok) {
              console.warn(`Failed to enhance scene ${scene.sceneNumber}, keeping original`);
              return scene; // Keep original on error
            }

            const data = await response.json();

            // Return enhanced scene with same scene number
            return {
              ...scene,
              enhanced_prompt: data.enhanced_prompt,
              caption: data.caption,
            };
          } catch (error) {
            console.error(`Error enhancing scene ${scene.sceneNumber}:`, error);
            return scene; // Keep original on error
          }
        })
      );

      // Update with enhanced results, maintaining scene order and count
      onScenesUpdate(enhancedResults);

      console.log(`✓ Re-enhanced ${enhancedResults.length} scenes (kept count at ${enhancedScenes.length})`);

    } catch (error) {
      console.error('Failed to re-enhance scenes:', error);
      alert('Failed to re-enhance scenes. Please try again.');
    } finally {
      setIsReEnhancing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            📖 Enhanced Scene Preview
          </h1>
          <p className="text-gray-600">
            Review your AI-enhanced story before generating images. This helps you save costs by ensuring the story is perfect first!
          </p>

          {/* Summary Stats */}
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <div className="text-sm text-blue-700 font-medium">Total Scenes</div>
              <div className="text-2xl font-bold text-blue-900">
                {enhancedScenes.length}
                {sceneCountIncreased && (
                  <span className="text-sm text-blue-600 ml-2">
                    (+{enhancedScenes.length - originalSceneCount} added)
                  </span>
                )}
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
              <div className="text-sm text-purple-700 font-medium">Characters</div>
              <div className="text-2xl font-bold text-purple-900">
                {allCharacters.size}
                {newCharacters.length > 0 && (
                  <span className="text-sm text-purple-600 ml-2">
                    (+{newCharacters.length} new)
                  </span>
                )}
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <div className="text-sm text-green-700 font-medium">Estimated Time</div>
              <div className="text-2xl font-bold text-green-900">
                {Math.ceil(enhancedScenes.length * 0.4)}-{Math.ceil(enhancedScenes.length * 0.5)} min
              </div>
            </div>
          </div>

          {/* New Characters Alert */}
          {newCharacters.length > 0 && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-800">
                    AI Added Minor Characters
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {newCharacters.join(', ')}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    These supporting characters will help tell the story. They'll appear with generic, age-appropriate appearance.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scene List */}
        <div className="space-y-4">
          {enhancedScenes.map((scene, index) => (
            <React.Fragment key={scene.sceneNumber}>
              <div className="bg-white rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow relative">
              <div className="flex items-start gap-4">
                {/* Scene Number */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {scene.isCover ? '📖' : scene.sceneNumber}
                  </div>
                </div>

                {/* Scene Content */}
                <div className="flex-1 min-w-0">
                  {/* Cover-specific rendering */}
                  {scene.isCover ? (
                    <>
                      {/* Story Title - Editable (updates on blur for better UX) */}
                      <div className="bg-blue-50 rounded-lg p-3 mb-3">
                        <label className="text-sm font-medium text-blue-700 mb-1 block">
                          📝 Story Title:
                        </label>
                        {onTitleEdit ? (
                          <input
                            type="text"
                            defaultValue={scene.storyTitle || ''}
                            onBlur={(e) => {
                              const newValue = e.target.value.trim();
                              if (newValue !== scene.storyTitle) {
                                onTitleEdit(newValue);
                              }
                            }}
                            className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold text-lg"
                            placeholder="Enter story title..."
                          />
                        ) : (
                          <div className="text-lg font-bold text-gray-900">
                            {scene.storyTitle || 'Untitled Story'}
                          </div>
                        )}
                      </div>

                      {/* Story Description - Editable (updates on blur for better UX) */}
                      <div className="bg-purple-50 rounded-lg p-3 mb-3">
                        <label className="text-sm font-medium text-purple-700 mb-1 block">
                          📝 Story Description:
                        </label>
                        {onDescriptionEdit ? (
                          <textarea
                            defaultValue={scene.storyDescription || ''}
                            onBlur={(e) => {
                              const newValue = e.target.value.trim();
                              if (newValue !== scene.storyDescription) {
                                onDescriptionEdit(newValue);
                              }
                            }}
                            rows={2}
                            className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                            placeholder="Enter story description..."
                          />
                        ) : (
                          <div className="text-gray-700">
                            {scene.storyDescription || 'No description'}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Regular Scene Title */
                    scene.title && (
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {scene.title}
                      </h3>
                    )
                  )}

                  {/* Caption - Editable (skip for cover) */}
                  {!scene.isCover && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      📝 Story Caption:
                    </label>
                    {onCaptionEdit ? (
                      <textarea
                        value={scene.caption}
                        onChange={(e) => {
                          onCaptionEdit(scene.sceneNumber, e.target.value);
                          // Auto-resize textarea based on content
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onFocus={(e) => {
                          // Set initial height on focus
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        disabled={isGenerating}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 leading-relaxed overflow-hidden"
                        rows={1}
                        style={{ minHeight: '2.5rem' }}
                      />
                    ) : (
                      <p className="text-gray-900 leading-relaxed">
                        {scene.caption}
                      </p>
                    )}
                  </div>
                  )}

                  {/* Chinese Caption - Editable (NEW - Bilingual Support) - Skip for cover */}
                  {!scene.isCover && generateChineseTranslation && (
                    <div className="bg-purple-50 rounded-lg p-3 mb-3 border border-purple-200">
                      <label className="text-sm font-medium text-purple-700 mb-1 flex items-center gap-2">
                        <span>🇨🇳</span>
                        <span>Chinese Caption (中文):</span>
                      </label>
                      {onCaptionChineseEdit ? (
                        <textarea
                          value={scene.caption_chinese || ''}
                          onChange={(e) => {
                            onCaptionChineseEdit(scene.sceneNumber, e.target.value);
                            // Auto-resize textarea based on content
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onFocus={(e) => {
                            // Set initial height on focus
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          disabled={isGenerating}
                          placeholder="Chinese translation will appear here..."
                          className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 leading-relaxed overflow-hidden"
                          rows={1}
                          style={{ minHeight: '2.5rem' }}
                        />
                      ) : (
                        <p className="text-gray-900 leading-relaxed">
                          {scene.caption_chinese || <span className="text-gray-400 italic">No Chinese translation</span>}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Characters in Scene */}
                  {scene.characterNames && scene.characterNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="text-xs text-gray-500">Characters:</span>
                      {scene.characterNames.map((char, idx) => {
                        const isNew = newCharacters.includes(char);
                        return (
                          <span
                            key={idx}
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              isNew
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {char}
                            {isNew && ' (NEW)'}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Image Prompt Preview - Editable */}
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      View/Edit image generation prompt
                    </summary>
                    {onImagePromptEdit ? (
                      <textarea
                        value={scene.enhanced_prompt}
                        onChange={(e) => {
                          onImagePromptEdit(scene.sceneNumber, e.target.value);
                          // Auto-resize textarea based on content
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onFocus={(e) => {
                          // Set initial height on focus
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        disabled={isGenerating}
                        className="w-full text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed overflow-hidden"
                        rows={3}
                        style={{ minHeight: '3rem' }}
                      />
                    ) : (
                      <p className="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded">
                        {scene.enhanced_prompt}
                      </p>
                    )}
                  </details>
                </div>
              </div>

              {/* Action buttons - bottom right */}
              {onScenesUpdate && !isGenerating && (
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                  {/* Delete button */}
                  {enhancedScenes.length > 1 && (
                    <button
                      onClick={() => handleDeleteScene(scene.sceneNumber)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Delete this scene"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}

                  {/* Add scene button */}
                  <button
                    onClick={() => handleAddSceneClick(scene.sceneNumber)}
                    disabled={enhancedScenes.length >= 20}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={enhancedScenes.length >= 20 ? "Maximum 20 scenes reached" : `Add a new scene after this one`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            </React.Fragment>
          ))}
        </div>

        {/* Max scenes warning */}
        {enhancedScenes.length >= 20 && onScenesUpdate && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠️ Maximum 20 scenes reached. Delete a scene to add new ones.
            </p>
          </div>
        )}

        {/* Re-enhance All Scenes Section - Moved to right after scene review */}
        {onScenesUpdate && (
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">✨</div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">
                  Made changes to your scenes?
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Re-enhance all scenes to update captions and image prompts based on your edits. Scene count stays the same.
                </p>
                <button
                  onClick={handleReEnhanceAll}
                  disabled={isReEnhancing || isGenerating}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-lg hover:from-purple-700 hover:to-blue-700 font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isReEnhancing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Re-enhancing {enhancedScenes.length} scenes...
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      Re-enhance All {enhancedScenes.length} Scenes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 bg-white rounded-2xl shadow-xl p-6">
          {/* Art Style Selection - Custom Radio Buttons */}
          {onArtStyleChange && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Art Style</h4>
              <div className="flex gap-4">
                {/* 3D Pixar Option */}
                <button
                  type="button"
                  onClick={() => !isGenerating && onArtStyleChange('pixar')}
                  disabled={isGenerating}
                  className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                    artStyle === 'pixar'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {/* Custom radio circle */}
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    artStyle === 'pixar'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {artStyle === 'pixar' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">3D Pixar Style</div>
                    <p className="text-sm text-gray-500">Modern 3D animation look</p>
                  </div>
                </button>

                {/* Classic 2D Option */}
                <button
                  type="button"
                  onClick={() => !isGenerating && onArtStyleChange('classic')}
                  disabled={isGenerating}
                  className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                    artStyle === 'classic'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {/* Custom radio circle */}
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    artStyle === 'classic'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {artStyle === 'classic' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">Classic Storybook 2D</div>
                    <p className="text-sm text-gray-500">Traditional watercolor illustration</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Image Generation Engine Toggle - For comparing Fal.ai vs Gemini */}
          {onImageProviderChange && (
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Image Generation Engine</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {imageProvider === 'gemini'
                      ? 'Gemini Nano Banana: Better quality and character consistency from photos'
                      : 'Fal.ai FLUX: Fast generation with text-based character descriptions'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${imageProvider === 'flux' ? 'text-purple-600' : 'text-gray-400'}`}>
                    Fal.ai
                  </span>
                  <button
                    type="button"
                    onClick={() => onImageProviderChange(imageProvider === 'gemini' ? 'flux' : 'gemini')}
                    disabled={isGenerating}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 ${
                      imageProvider === 'gemini' ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        imageProvider === 'gemini' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-medium ${imageProvider === 'gemini' ? 'text-purple-600' : 'text-gray-400'}`}>
                    Gemini
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <button
              onClick={onBack}
              disabled={isGenerating}
              className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Back to Edit
            </button>

            <button
              onClick={onApprove}
              disabled={isGenerating}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl hover:from-green-700 hover:to-teal-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating Images...
                </span>
              ) : (
                <>
                  ✓ Approve & Generate {enhancedScenes.length} Images →
                </>
              )}
            </button>
          </div>

          <div className="mt-4 text-center text-sm text-gray-500">
            <p>
              💡 Once you approve, we'll generate {enhancedScenes.length} AI images. This will take approximately{' '}
              {Math.ceil(enhancedScenes.length * 0.4)}-{Math.ceil(enhancedScenes.length * 0.5)} minutes.
            </p>
          </div>
        </div>

        {/* Add Scene Modal */}
        {showAddSceneModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Add New Scene After Scene {insertAfterSceneNumber}
                </h3>
                <button
                  onClick={() => setShowAddSceneModal(false)}
                  disabled={isEnhancingNewScene}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Scene Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scene Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newSceneDescription}
                    onChange={(e) => setNewSceneDescription(e.target.value)}
                    disabled={isEnhancingNewScene}
                    rows={4}
                    placeholder="Describe what happens in this scene..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                  />
                </div>

                {/* Character Selection */}
                {userCharacters.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Characters in this scene (optional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {userCharacters.map(char => (
                        <label key={char} className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedCharacters.includes(char)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCharacters([...selectedCharacters, char]);
                              } else {
                                setSelectedCharacters(selectedCharacters.filter(c => c !== char));
                              }
                            }}
                            disabled={isEnhancingNewScene}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{char}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  💡 AI will enhance your description to create detailed image prompts and age-appropriate captions using your story settings.
                </div>

                {/* Error Message */}
                {addSceneError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700 font-medium">⚠️ {addSceneError}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleConfirmAddScene}
                  disabled={!newSceneDescription.trim() || isEnhancingNewScene}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2.5 rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isEnhancingNewScene ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Enhancing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add & Enhance Scene
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowAddSceneModal(false)}
                  disabled={isEnhancingNewScene}
                  className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
