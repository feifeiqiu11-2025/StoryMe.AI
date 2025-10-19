/**
 * Scene Preview & Approval Component
 * Shows enhanced scenes before expensive image generation
 * User can review and approve/reject before committing
 */

'use client';

import { EnhancedScene } from '@/lib/types/story';

interface ScenePreviewApprovalProps {
  enhancedScenes: EnhancedScene[];
  originalSceneCount: number;
  userCharacters: string[];
  onApprove: () => void;
  onBack: () => void;
  onCaptionEdit?: (sceneNumber: number, newCaption: string) => void;
  isGenerating: boolean;
}

export default function ScenePreviewApproval({
  enhancedScenes,
  originalSceneCount,
  userCharacters,
  onApprove,
  onBack,
  onCaptionEdit,
  isGenerating,
}: ScenePreviewApprovalProps) {
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
            <div
              key={scene.sceneNumber}
              className="bg-white rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Scene Number */}
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {scene.sceneNumber}
                </div>

                {/* Scene Content */}
                <div className="flex-1 min-w-0">
                  {/* Scene Title */}
                  {scene.title && (
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {scene.title}
                    </h3>
                  )}

                  {/* Caption - Editable */}
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

                  {/* Image Prompt Preview */}
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      View image generation prompt
                    </summary>
                    <p className="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded">
                      {scene.enhanced_prompt}
                    </p>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 bg-white rounded-2xl shadow-xl p-6">
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
      </div>
    </div>
  );
}
