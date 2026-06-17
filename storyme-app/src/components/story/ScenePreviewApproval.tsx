/**
 * Scene Preview & Approval Component
 * Shows enhanced scenes before expensive image generation
 * User can review and approve/reject before committing
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { EnhancedScene, ImageProvider, VISIBLE_IMAGE_PROVIDER_OPTIONS, DEFAULT_SCENE_IMAGE_PROVIDER } from '@/lib/types/story';
import { getLanguageLabel } from '@/lib/config/languages';
import type { StoryBibleResult } from '@/lib/ai/scene-enhancer';
import { ART_STYLES, type ArtStyleType } from '@/lib/art-styles-config';
import EditImageControl from './EditImageControl';

interface ScenePreviewApprovalProps {
  enhancedScenes: EnhancedScene[];
  originalSceneCount: number;
  userCharacters: string[];
  onApprove: () => void;
  onBack: () => void;
  onCaptionEdit?: (sceneNumber: number, newCaption: string) => void;
  onCaptionSecondaryEdit?: (sceneNumber: number, newCaption: string) => void;
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
  secondaryLanguage?: string | null;
  // Art style and image provider settings
  artStyle?: ArtStyleType;
  onArtStyleChange?: (style: ArtStyleType) => void;
  imageProvider?: ImageProvider;
  onImageProviderChange?: (provider: ImageProvider) => void;
  // Draft save
  onSaveDraft?: () => void;
  savingDraft?: boolean;
  draftSaveLabel?: string;
  draftSaveMessage?: string;
  // Define new character (click on NEW chip to create character with reference)
  onDefineNewCharacter?: (characterName: string) => void;
  // Story bible: enables the split Characters/Scene chip display and location context per scene
  storyBible?: StoryBibleResult | null;
  // Called when user clicks the bookmark on a Scene chip to promote a location to their character library.
  // Receives the bible location; parent performs the POST and updates state.
  onSaveLocationToLibrary?: (location: { temp_id: string; name: string; description: string; backing_character_name?: string | null }) => void;
  // Set of location temp_ids that have already been saved to the user's library (disables the bookmark).
  savedLocationTempIds?: Set<string>;
  // Edit handlers (Phase 4). When provided, chips become interactive: character chips get a remove X,
  // an add-character button appears, and the Scene chip opens a swap picker on click.
  // Parent is responsible for updating the storyBible in its state and flagging prompt_stale.
  onSceneCharactersChange?: (sceneNumber: number, resolvedCharacterNames: string[]) => void;
  onSceneLocationChange?: (sceneNumber: number, locationTempId: string) => void;
  // Called when user clicks "+ Add" on a scene's chip row. Parent opens the existing
  // Import-from-Library modal targeted at this scene; the modal's import handler routes
  // the chosen character into the scene's resolved_character_names.
  onRequestAddCharacter?: (sceneNumber: number) => void;
  // Set of scene numbers with stale prompts (edits made since last enhancement). Purely visual —
  // surfaces a small indicator so the user knows a prompt refresh will happen on Approve.
  stalePromptSceneNumbers?: Set<number>;
  // Phase 8: persist an on-demand-generated setting reference image into the bible
  // (parent sets storyBible.locations[tempId].reference_image_url). The batch reuses it.
  onSetLocationReference?: (tempId: string, url: string) => void;
  // Phase 8: same, for recurring NEW characters
  // (parent sets storyBible.new_characters[tempId].reference_image_url).
  onSetCharacterReference?: (tempId: string, url: string) => void;
}

export default function ScenePreviewApproval({
  enhancedScenes,
  originalSceneCount,
  userCharacters,
  onApprove,
  onBack,
  onCaptionEdit,
  onCaptionSecondaryEdit,
  onImagePromptEdit,
  onScenesUpdate,
  isGenerating,
  onTitleEdit,
  onDescriptionEdit,
  readingLevel = 5,
  storyTone = 'playful',
  expansionLevel = 'as_written',
  contentLanguage = 'en',
  secondaryLanguage = null,
  artStyle = 'classic',
  onArtStyleChange,
  imageProvider = DEFAULT_SCENE_IMAGE_PROVIDER,
  onImageProviderChange,
  onSaveDraft,
  savingDraft = false,
  draftSaveLabel = 'Save as Draft',
  draftSaveMessage,
  onDefineNewCharacter,
  storyBible = null,
  onSaveLocationToLibrary,
  savedLocationTempIds,
  onSceneCharactersChange,
  onSceneLocationChange,
  onRequestAddCharacter,
  stalePromptSceneNumbers,
  onSetLocationReference,
  onSetCharacterReference,
}: ScenePreviewApprovalProps) {
  // Add Scene Modal State
  const [showAddSceneModal, setShowAddSceneModal] = useState(false);
  const [insertAfterSceneNumber, setInsertAfterSceneNumber] = useState(0);
  const [newSceneDescription, setNewSceneDescription] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [isEnhancingNewScene, setIsEnhancingNewScene] = useState(false);
  const [addSceneError, setAddSceneError] = useState('');

  // Scene-swap popover state. "+ Add" character now opens the parent's existing Import modal
  // (via onRequestAddCharacter), so no dropdown state lives here for that flow anymore.
  const [swapSceneForScene, setSwapSceneForScene] = useState<number | null>(null);
  // Wrapper ref for outside-click detection — when the user clicks anywhere outside the
  // currently-open Scene swap popover, close it. Without this, the popover persists.
  const swapPopoverWrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (swapSceneForScene === null) return;
    const onMouseDown = (e: MouseEvent) => {
      if (swapPopoverWrapperRef.current && !swapPopoverWrapperRef.current.contains(e.target as Node)) {
        setSwapSceneForScene(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [swapSceneForScene]);

  // Phase 8: on-demand setting preview. Generates the setting's reference image in the
  // selected art style, persists it via onSetLocationReference (parent → bible), and the
  // batch reuses it. previewingTempId tracks the in-flight request for the spinner.
  const [previewingTempId, setPreviewingTempId] = useState<string | null>(null);
  const [previewErrorTempId, setPreviewErrorTempId] = useState<string | null>(null);
  const handlePreviewLocation = async (
    loc: { temp_id: string; name: string; description: string; backing_character_name?: string | null }
  ) => {
    if (!onSetLocationReference || previewingTempId) return;
    setPreviewingTempId(loc.temp_id);
    setPreviewErrorTempId(null);
    try {
      const resp = await fetch('/api/locations/generate-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: [loc], illustrationStyle: artStyle }),
      });
      if (!resp.ok) throw new Error('Preview generation failed');
      const json = await resp.json();
      const url: string | undefined = json?.locations?.[loc.temp_id];
      if (!url) throw new Error('No image returned');
      onSetLocationReference(loc.temp_id, url);
    } catch (err) {
      setPreviewErrorTempId(loc.temp_id);
      console.error('[setting preview] failed:', err);
    } finally {
      setPreviewingTempId(null);
    }
  };

  // Phase 8: on-demand preview for recurring NEW characters (mirrors the setting preview).
  const newCharEntryByName = React.useMemo(() => {
    const map = new Map<string, { temp_id: string; name: string; description: string; reference_image_url?: string | null }>();
    storyBible?.new_characters?.forEach(c => map.set(c.name.toLowerCase(), c));
    return map;
  }, [storyBible]);
  const [previewingCharTempId, setPreviewingCharTempId] = useState<string | null>(null);
  const [previewErrorCharTempId, setPreviewErrorCharTempId] = useState<string | null>(null);
  // Phase 8: larger view + edit for an anchor (setting or new character), opened by
  // clicking its thumbnail. Edit happens here (roomy modal) instead of inside the chip.
  const [viewingAnchor, setViewingAnchor] = useState<{
    kind: 'location' | 'character';
    temp_id: string;
    name: string;
    description: string;
    url: string;
  } | null>(null);
  const handlePreviewCharacter = async (
    c: { temp_id: string; name: string; description: string }
  ) => {
    if (!onSetCharacterReference || previewingCharTempId) return;
    setPreviewingCharTempId(c.temp_id);
    setPreviewErrorCharTempId(null);
    try {
      const resp = await fetch('/api/characters/generate-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: [c], illustrationStyle: artStyle }),
      });
      if (!resp.ok) throw new Error('Preview generation failed');
      const json = await resp.json();
      const url: string | undefined = json?.characters?.[c.temp_id];
      if (!url) throw new Error('No image returned');
      onSetCharacterReference(c.temp_id, url);
    } catch (err) {
      setPreviewErrorCharTempId(c.temp_id);
      console.error('[character preview] failed:', err);
    } finally {
      setPreviewingCharTempId(null);
    }
  };

  // Bible lookups for the split Characters/Scene chip display.
  // Empty maps when no bible is provided → chip rendering falls through to the legacy single-row display.
  const bibleSceneByNumber = React.useMemo(() => {
    const map = new Map<number, { location_temp_id?: string | null; resolved_character_names?: string[] }>();
    storyBible?.scenes?.forEach(s => {
      if (typeof s.sceneNumber === 'number') map.set(s.sceneNumber, s);
    });
    return map;
  }, [storyBible]);

  const bibleLocationByTempId = React.useMemo(() => {
    const map = new Map<string, { name: string; description: string; backing_character_name?: string | null; reference_image_url?: string | null }>();
    storyBible?.locations?.forEach(loc => {
      if (loc.temp_id) map.set(loc.temp_id, loc);
    });
    return map;
  }, [storyBible]);

  // How many scenes use each location — a setting used in only ONE scene needs no
  // pre-generated/preview anchor (anchors exist for cross-scene consistency).
  const locationUsageCount = React.useMemo(() => {
    const counts = new Map<string, number>();
    storyBible?.scenes?.forEach(s => {
      if (s.location_temp_id) counts.set(s.location_temp_id, (counts.get(s.location_temp_id) || 0) + 1);
    });
    return counts;
  }, [storyBible]);
  const recurringSettings = React.useMemo(
    () => (storyBible?.locations || []).filter(l => !l.backing_character_name && (locationUsageCount.get(l.temp_id) || 0) >= 2),
    [storyBible, locationUsageCount]
  );

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

    // Remove scene and re-number (preserve cover at sceneNumber 0)
    let contentIndex = 0;
    const updatedScenes = enhancedScenes
      .filter(s => s.sceneNumber !== sceneNumber)
      .map((s) => {
        if (s.isCover) return { ...s, sceneNumber: 0 };
        contentIndex++;
        return { ...s, sceneNumber: contentIndex };
      });

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

          {/* Story elements: recurring new characters + settings. Preview/edit each
              once in the selected art style; the batch reuses them across scenes. */}
          {(newCharacters.length > 0 || (onSetLocationReference && recurringSettings.length > 0)) && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
              {newCharacters.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1.5">New Characters</p>
                  <div className="flex flex-wrap gap-2">
                    {newCharacters.map((char) => {
                      const entry = newCharEntryByName.get(char.toLowerCase());
                      return (
                        <div key={char} className="inline-flex items-center gap-1.5">
                          {onDefineNewCharacter ? (
                            <button
                              type="button"
                              onClick={() => onDefineNewCharacter(char)}
                              className="inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200 hover:border-yellow-400 transition-colors cursor-pointer"
                            >
                              {char}
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          ) : (
                            <span className="text-sm px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                              {char}
                            </span>
                          )}
                          {/* Phase 8: on-demand character preview in the selected art style. */}
                          {onSetCharacterReference && entry && (
                            <>
                              <button
                                type="button"
                                disabled={previewingCharTempId !== null || isGenerating}
                                onClick={() => handlePreviewCharacter({ temp_id: entry.temp_id, name: entry.name, description: entry.description })}
                                className="text-xs px-2 py-1 rounded-full font-medium border bg-white text-gray-600 border-gray-300 hover:text-yellow-800 hover:border-yellow-400 hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Generate a preview of this character in your selected art style"
                              >
                                {previewingCharTempId === entry.temp_id
                                  ? 'Generating…'
                                  : (entry.reference_image_url ? 'Regenerate' : 'Preview')}
                              </button>
                              {entry.reference_image_url && (
                                <button
                                  type="button"
                                  onClick={() => setViewingAnchor({ kind: 'character', temp_id: entry.temp_id, name: entry.name, description: entry.description, url: entry.reference_image_url! })}
                                  className="shrink-0"
                                  title="Click to view larger and edit"
                                >
                                  <img
                                    src={entry.reference_image_url}
                                    alt={`Preview of ${char}`}
                                    className="w-9 h-9 rounded object-cover border border-yellow-200 hover:ring-2 hover:ring-yellow-300"
                                  />
                                </button>
                              )}
                              {previewErrorCharTempId === entry.temp_id && (
                                <span className="text-xs text-red-600">Failed</span>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {onSetLocationReference && recurringSettings.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1.5">Settings</p>
                  <div className="flex flex-wrap gap-2">
                {recurringSettings.map(loc => (
                  <div key={loc.temp_id} className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded-full pl-2.5 pr-1.5 py-1">
                    <span className="text-sm font-medium text-emerald-800" title={loc.description}>{loc.name}</span>
                    <button
                      type="button"
                      disabled={previewingTempId !== null || isGenerating}
                      onClick={() => handlePreviewLocation({ temp_id: loc.temp_id, name: loc.name, description: loc.description, backing_character_name: loc.backing_character_name ?? null })}
                      className="text-xs px-2 py-0.5 rounded-full font-medium border bg-white text-gray-600 border-gray-300 hover:text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate a preview of this setting in your selected art style"
                    >
                      {previewingTempId === loc.temp_id ? 'Generating…' : (loc.reference_image_url ? 'Regenerate' : 'Preview')}
                    </button>
                    {loc.reference_image_url && (
                      <button
                        type="button"
                        onClick={() => setViewingAnchor({ kind: 'location', temp_id: loc.temp_id, name: loc.name, description: loc.description, url: loc.reference_image_url! })}
                        className="shrink-0"
                        title="Click to view larger and edit"
                      >
                        <img src={loc.reference_image_url} alt={`Preview of ${loc.name}`} className="w-9 h-9 rounded object-cover border border-emerald-200 hover:ring-2 hover:ring-emerald-300" />
                      </button>
                    )}
                    {previewErrorTempId === loc.temp_id && <span className="text-xs text-red-600">Failed</span>}
                  </div>
                ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500">Preview each element in your selected art style; the book reuses them across scenes. Click a new character to define its appearance.</p>
            </div>
          )}
        </div>

        {/* Phase 8: larger anchor view + edit modal (opened by clicking a thumbnail) */}
        {viewingAnchor && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setViewingAnchor(null)}
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-2xl shadow-xl p-5 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{viewingAnchor.name}</h3>
                <button
                  type="button"
                  onClick={() => setViewingAnchor(null)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close preview"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <img
                src={viewingAnchor.url}
                alt={`Preview of ${viewingAnchor.name}`}
                className="w-full max-h-[60vh] object-contain rounded-lg border border-gray-200 bg-gray-50"
              />
              <div className="mt-3">
                <EditImageControl
                  currentImageUrl={viewingAnchor.url}
                  imageType="scene"
                  imageId={`${viewingAnchor.kind}-${viewingAnchor.temp_id}`}
                  buttonLabel="Edit image"
                  illustrationStyle={artStyle}
                  imageProvider={imageProvider}
                  sceneDescription={viewingAnchor.description}
                  onEditComplete={(url) => {
                    if (viewingAnchor.kind === 'location') onSetLocationReference?.(viewingAnchor.temp_id, url);
                    else onSetCharacterReference?.(viewingAnchor.temp_id, url);
                    setViewingAnchor((v) => (v ? { ...v, url } : v));
                  }}
                />
              </div>
            </div>
          </div>
        )}

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

                  {/* Secondary Language Caption - Editable (Bilingual Support) - Skip for cover */}
                  {!scene.isCover && !!secondaryLanguage && (
                    onCaptionSecondaryEdit ? (
                      <textarea
                        value={scene.caption_secondary || scene.caption_chinese || ''}
                        onChange={(e) => {
                          onCaptionSecondaryEdit(scene.sceneNumber, e.target.value);
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
                        placeholder={`${getLanguageLabel(secondaryLanguage)} translation will appear here...`}
                        className="w-full px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 leading-relaxed overflow-hidden mb-3"
                        rows={1}
                        style={{ minHeight: '2.5rem' }}
                      />
                    ) : (
                      <p className="text-gray-900 leading-relaxed bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mb-3">
                        {scene.caption_secondary || scene.caption_chinese || <span className="text-gray-400 italic">No {getLanguageLabel(secondaryLanguage)} translation</span>}
                      </p>
                    )
                  )}

                  {/* Characters + Scene chips. When a bible entry exists for this scene,
                      we split: "Characters:" shows resolved (pronoun-resolved) characters
                      excluding any that back the scene's location, and "Scene:" shows the
                      location. When no bible, falls back to the legacy single-row display. */}
                  {(() => {
                    const bibleScene = bibleSceneByNumber.get(scene.sceneNumber);
                    const bibleLocation = bibleScene?.location_temp_id
                      ? bibleLocationByTempId.get(bibleScene.location_temp_id)
                      : undefined;
                    const backingName = bibleLocation?.backing_character_name?.toLowerCase();

                    // Character list: bible-resolved names minus the location's backing char
                    let charsForDisplay: string[] = scene.characterNames || [];
                    if (bibleScene?.resolved_character_names?.length) {
                      charsForDisplay = bibleScene.resolved_character_names;
                    }
                    if (backingName) {
                      charsForDisplay = charsForDisplay.filter(c => c.toLowerCase() !== backingName);
                    }

                    const editingChars = !!(onSceneCharactersChange && bibleScene);
                    const editingLocation = !!(onSceneLocationChange && bibleScene && bibleLocation);
                    const canAddChar = editingChars && !!onRequestAddCharacter;
                    const swappableLocations = editingLocation && storyBible?.locations
                      ? storyBible.locations.filter(l => l.temp_id !== bibleScene.location_temp_id)
                      : [];

                    return (
                      (charsForDisplay.length > 0 || editingChars || (bibleLocation && bibleScene?.location_temp_id)) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
                          {(charsForDisplay.length > 0 || editingChars) && (
                            <div className="flex flex-wrap items-center gap-2 relative">
                              <span className="text-xs text-gray-500">Characters:</span>
                              {charsForDisplay.map((char, idx) => {
                                const isNew = newCharacters.includes(char);
                                const base = `text-xs pl-2 pr-1 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                                  isNew
                                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                    : 'bg-blue-100 text-blue-700'
                                }`;
                                return (
                                  <span key={`${scene.sceneNumber}-char-${idx}`} className={base}>
                                    {isNew && onDefineNewCharacter ? (
                                      <button
                                        type="button"
                                        onClick={() => onDefineNewCharacter(char)}
                                        className="inline-flex items-center gap-0.5 hover:underline"
                                      >
                                        {char} (NEW)
                                      </button>
                                    ) : (
                                      <span>{char}{isNew && ' (NEW)'}</span>
                                    )}
                                    {editingChars && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = charsForDisplay.filter(c => c !== char);
                                          onSceneCharactersChange!(scene.sceneNumber, next);
                                        }}
                                        className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                                        aria-label={`Remove ${char} from scene ${scene.sceneNumber}`}
                                        title={`Remove ${char} from this scene`}
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M6 18L18 6" />
                                        </svg>
                                      </button>
                                    )}
                                  </span>
                                );
                              })}

                              {canAddChar && (
                                <button
                                  type="button"
                                  onClick={() => onRequestAddCharacter!(scene.sceneNumber)}
                                  className="text-xs px-2 py-1 rounded-full font-medium border border-dashed border-gray-300 text-gray-500 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50 inline-flex items-center gap-0.5"
                                  aria-label={`Add a character from library to scene ${scene.sceneNumber}`}
                                  title="Import a character from your library"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add
                                </button>
                              )}
                            </div>
                          )}

                          {bibleLocation && bibleScene?.location_temp_id && (
                            <div
                              ref={swapSceneForScene === scene.sceneNumber ? swapPopoverWrapperRef : undefined}
                              className="flex flex-wrap items-center gap-2 relative"
                            >
                              <span className="text-xs text-gray-500">Scene:</span>
                              {editingLocation ? (
                                <button
                                  type="button"
                                  onClick={() => setSwapSceneForScene(prev => prev === scene.sceneNumber ? null : scene.sceneNumber)}
                                  className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 inline-flex items-center gap-1"
                                  title={bibleLocation.description}
                                  aria-label={`Change scene location from ${bibleLocation.name}`}
                                  aria-expanded={swapSceneForScene === scene.sceneNumber}
                                >
                                  {bibleLocation.backing_character_name || bibleLocation.name}
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              ) : (
                                <span
                                  className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700 border border-emerald-200"
                                  title={bibleLocation.description}
                                >
                                  {bibleLocation.backing_character_name || bibleLocation.name}
                                </span>
                              )}

                              {swapSceneForScene === scene.sceneNumber && swappableLocations.length > 0 && (
                                <div
                                  className="absolute z-20 mt-1 top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[12rem] max-h-60 overflow-y-auto"
                                  role="listbox"
                                >
                                  {swappableLocations.map(loc => (
                                    <button
                                      key={`swap-${loc.temp_id}`}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSceneLocationChange!(scene.sceneNumber, loc.temp_id);
                                        setSwapSceneForScene(null);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-emerald-50"
                                      role="option"
                                      title={loc.description}
                                    >
                                      {loc.name}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Setting preview/edit now lives in the consolidated "Story Settings"
                                  strip in the top summary (one entry per setting), not per-scene. */}

                              {/* "Save scene" button is temporarily hidden — the save-to-library flow needs more
                                  iteration before re-exposing it. Supporting code (endpoint, handler in
                                  create/page.tsx, savedLocationTempIds state) is intact, so re-enabling is just
                                  a matter of un-commenting the JSX block below. */}
                              {/*
                              {onSaveLocationToLibrary && !bibleLocation.backing_character_name && (() => {
                                const tempId = bibleScene.location_temp_id as string;
                                const alreadySaved = savedLocationTempIds?.has(tempId) ?? false;
                                return (
                                  <button
                                    type="button"
                                    disabled={alreadySaved}
                                    onClick={() => {
                                      if (alreadySaved) return;
                                      const ok = window.confirm(
                                        `Save "${bibleLocation.name}" to your character library so you can reuse this scene in future stories?`
                                      );
                                      if (!ok) return;
                                      onSaveLocationToLibrary({
                                        temp_id: tempId,
                                        name: bibleLocation.name,
                                        description: bibleLocation.description,
                                        backing_character_name: bibleLocation.backing_character_name ?? null,
                                      });
                                    }}
                                    title={alreadySaved ? 'Already in your character library' : 'Save this scene to your character library'}
                                    aria-label={alreadySaved ? `${bibleLocation.name} is saved in your library` : `Save ${bibleLocation.name} to your library`}
                                    className={`text-xs px-2 py-1 rounded-full font-medium border inline-flex items-center gap-1 transition-colors ${
                                      alreadySaved
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default'
                                        : 'bg-white text-gray-600 border-gray-300 hover:text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer'
                                    }`}
                                  >
                                    <svg className="w-3 h-3" fill={alreadySaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                    {alreadySaved ? 'Saved' : 'Save scene'}
                                  </button>
                                );
                              })()}
                              */}
                            </div>
                          )}

                        </div>
                      )
                    );
                  })()}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Art-style options — mapped from the registry (single source of
                    truth). Adding a style is one entry in art-styles-config.ts. */}
                {ART_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => !isGenerating && onArtStyleChange(style.id)}
                    disabled={isGenerating}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                      artStyle === style.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {/* Custom radio circle */}
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      artStyle === style.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                      {artStyle === style.id && (
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{style.label}</div>
                      <p className="text-xs text-gray-500">{style.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              {/* Coloring Book Note */}
              {artStyle === 'coloring' && (
                <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded-lg">
                  📖 Cover will be colorful (3D style), scene pages will be black & white line art for kids to color!
                </p>
              )}
            </div>
          )}

          {/* Image Generation Engine Selector */}
          {onImageProviderChange && (
            <div className="mb-6">
              <h4 id="image-engine-label" className="text-sm font-semibold text-gray-900 mb-3">Image Generation Engine</h4>
              <div
                role="radiogroup"
                aria-labelledby="image-engine-label"
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                onKeyDown={(e) => {
                  if (isGenerating) return;
                  const keys = ['ArrowLeft', 'ArrowRight'];
                  if (!keys.includes(e.key)) return;
                  e.preventDefault();
                  const currentIndex = VISIBLE_IMAGE_PROVIDER_OPTIONS.findIndex(o => o.value === imageProvider);
                  const nextIndex = e.key === 'ArrowRight'
                    ? (currentIndex + 1) % VISIBLE_IMAGE_PROVIDER_OPTIONS.length
                    : (currentIndex - 1 + VISIBLE_IMAGE_PROVIDER_OPTIONS.length) % VISIBLE_IMAGE_PROVIDER_OPTIONS.length;
                  onImageProviderChange(VISIBLE_IMAGE_PROVIDER_OPTIONS[nextIndex].value);
                  // Focus the newly selected radio button
                  const container = e.currentTarget;
                  const buttons = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                  buttons[nextIndex]?.focus();
                }}
              >
                {VISIBLE_IMAGE_PROVIDER_OPTIONS.map((option) => {
                  const isSelected = imageProvider === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${option.label}: ${option.description}`}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => !isGenerating && onImageProviderChange(option.value)}
                      disabled={isGenerating}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed border-gray-300' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                          <span className="truncate">{option.label}</span>
                          {option.isNew && (
                            <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
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

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {onSaveDraft && (
                <>
                  <button
                    onClick={onSaveDraft}
                    disabled={savingDraft || isGenerating}
                    className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                    aria-label="Save story as draft to continue later"
                  >
                    {savingDraft ? 'Saving...' : draftSaveLabel}
                  </button>
                  {draftSaveMessage && (
                    <span className={`text-sm font-medium whitespace-nowrap ${draftSaveMessage === 'Draft saved!' ? 'text-green-600' : 'text-red-600'}`}>
                      {draftSaveMessage}
                    </span>
                  )}
                </>
              )}
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
