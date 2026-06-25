'use client';

import { useState } from 'react';
import {
  Character,
  SubjectType,
  ImageProvider,
  ImageMedium,
} from '@/lib/types/story';
import { CharacterPreviewStudio } from '@/components/character/CharacterPreviewStudio';
import { compressImageForUpload } from '@/lib/utils/compress-image';

/**
 * Common animal types for detecting if character type is an animal
 */
const ANIMAL_KEYWORDS = [
  'cat', 'kitten', 'kitty', 'dog', 'puppy', 'bird', 'parrot', 'rabbit', 'bunny',
  'hamster', 'turtle', 'fish', 'horse', 'pony', 'cow', 'pig', 'piglet', 'sheep',
  'lamb', 'goat', 'chicken', 'duck', 'goose', 'lion', 'tiger', 'elephant',
  'giraffe', 'zebra', 'monkey', 'bear', 'panda', 'koala', 'wolf', 'fox', 'deer',
  'owl', 'eagle', 'hawk', 'penguin', 'dolphin', 'whale', 'shark', 'octopus',
  'dragon', 'unicorn', 'phoenix', 'dinosaur', 'frog', 'butterfly', 'bee',
];

/**
 * Detect if character type describes an animal
 * @param characterType - The character type entered by user (e.g., "fluffy yellow cat", "baby eagle")
 */
function detectIsAnimal(characterType: string): boolean {
  const lowerType = characterType.toLowerCase();
  return ANIMAL_KEYWORDS.some(animal => {
    // Use word boundary to avoid partial matches
    const pattern = new RegExp(`\\b${animal}\\b`, 'i');
    return pattern.test(lowerType);
  });
}

interface CharacterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: Character) => void;
  editingCharacter?: Character | null;
  imageProvider?: ImageProvider;
  /**
   * Optional: triggered when user clicks "Break into parts" inside the edit view.
   * The parent is expected to close this modal and open the BreakdownModal with
   * the same character. When undefined, the breakdown section is hidden.
   */
  onBreakdown?: (character: Character) => void;
}

interface FormData {
  name: string;
  hairColor: string;
  skinTone: string;
  clothing: string;
  age: string;
  otherFeatures: string;
  imageUrl: string;
  imageFileName: string;
  animatedPreviewUrl: string;
  characterType: string;
}

export default function CharacterFormModal({
  isOpen,
  onClose,
  onSave,
  editingCharacter = null,
  imageProvider,
  onBreakdown,
}: CharacterFormModalProps) {
  const [formData, setFormData] = useState<FormData>(() => {
    if (editingCharacter) {
      return {
        name: editingCharacter.name,
        hairColor: editingCharacter.description.hairColor || '',
        skinTone: editingCharacter.description.skinTone || '',
        clothing: editingCharacter.description.clothing || '',
        age: editingCharacter.description.age || '',
        otherFeatures: editingCharacter.description.otherFeatures || '',
        imageUrl: editingCharacter.referenceImage.url,
        imageFileName: editingCharacter.referenceImage.fileName,
        animatedPreviewUrl: editingCharacter.animatedPreviewUrl || '',
        characterType: '',
      };
    }
    return {
      name: '',
      hairColor: '',
      skinTone: '',
      clothing: '',
      age: '',
      otherFeatures: '',
      imageUrl: '',
      imageFileName: '',
      animatedPreviewUrl: '',
      characterType: '',
    };
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false); // Shows overlay while AI analyzes
  const [characterMode, setCharacterMode] = useState<'photo' | 'description'>('photo');
  // Detected subject type from AI (for image mode); fed to the preview studio.
  const [detectedSubjectType, setDetectedSubjectType] = useState<SubjectType | null>(null);

  // Detected medium of the uploaded reference image. Drives kid_creation prompt branching.
  // User can override via the "Wrong?" toggle if the analyzer mis-classifies.
  const [detectedMedium, setDetectedMedium] = useState<ImageMedium>('real_photo');
  // Set when analyze-character failed — UI shows explicit medium picker. Distinguishes
  // RATE_LIMITED (genuine 429) from other failures so we don't lie about the cause.
  const [analysisError, setAnalysisError] = useState<{ code: string; message: string } | null>(null);

  // Reset form when modal opens/closes or editingCharacter changes
  const resetForm = () => {
    setFormData({
      name: '',
      hairColor: '',
      skinTone: '',
      clothing: '',
      age: '',
      otherFeatures: '',
      imageUrl: '',
      imageFileName: '',
      animatedPreviewUrl: '',
      characterType: '',
    });
    setCharacterMode('photo');
    setDetectedSubjectType(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleImageUpload = async (file: File) => {
    // We accept anything the browser can decode (incl. HEIC on Safari/iOS/macOS Chrome).
    // The canvas re-encode below normalizes everything to JPEG, so the AI providers
    // never see HEIC/PNG/WebP/etc. directly. AVIF/BMP/TIFF/SVG remain blocked because
    // canvas decode is unreliable for them.
    const fileName = file.name.toLowerCase();
    const unsupportedExtensions = ['.avif', '.bmp', '.tiff', '.tif', '.svg'];
    const hasUnsupportedExt = unsupportedExtensions.some(ext => fileName.endsWith(ext));
    if (hasUnsupportedExt) {
      alert('Unsupported image format. Please use JPG, PNG, HEIC, GIF, or WebP.');
      return;
    }

    setUploadingImage(true);
    try {
      // Client-side normalize: decode → resize (long-edge ≤ 4096) → JPEG q0.9.
      // Fixes large iPhone photos that previously caused slow fetches and timeouts
      // the old UI mislabeled as "rate limited".
      let uploadFile: File;
      try {
        const compressed = await compressImageForUpload(file);
        console.log(
          `[CharacterFormModal] Compressed ${file.name}: ` +
          `${(compressed.originalBytes / 1024).toFixed(0)}KB → ${(compressed.compressedBytes / 1024).toFixed(0)}KB ` +
          `(${compressed.width}×${compressed.height})`
        );
        uploadFile = compressed.file;
      } catch (compressError) {
        console.error('[CharacterFormModal] Image compression failed:', compressError);
        alert(compressError instanceof Error ? compressError.message : 'Failed to read image. Please try a different file.');
        return;
      }

      const formDataUpload = new FormData();
      formDataUpload.append('file', uploadFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      // Reset detected subject type when uploading new image
      setDetectedSubjectType(null);
      setFormData({
        ...formData,
        imageUrl: data.url,
        imageFileName: file.name,
      });

      // Auto-analyze image with unified Gemini API (single call for all subject types)
      console.log('Analyzing character image:', data.url);
      setAnalyzingImage(true);
      setAnalysisError(null);

      try {
        const analysisResponse = await fetch('/api/analyze-character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: data.url }),
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          console.log('Character analysis response:', analysisData);

          if (analysisData.success) {
            setDetectedSubjectType(analysisData.subjectType);

            // Capture detected medium so the kid_creation faithfulness prompt is used
            // when the user clicks Generate. User can override via the badge below.
            if (analysisData.medium) {
              setDetectedMedium(analysisData.medium as ImageMedium);
            }

            if (analysisData.subjectType === 'human' && analysisData.humanDetails) {
              // Human detected: populate structured fields
              const details = analysisData.humanDetails;
              // Combine gender with other features if present
              const otherFeatures = [details.gender, details.otherFeatures]
                .filter(Boolean)
                .join(', ');

              setFormData((prev) => ({
                ...prev,
                imageUrl: data.url,
                imageFileName: file.name,
                hairColor: details.hairColor || prev.hairColor,
                skinTone: details.skinTone || prev.skinTone,
                clothing: details.clothing || prev.clothing,
                age: details.age || prev.age,
                otherFeatures: otherFeatures || prev.otherFeatures,
              }));
              console.log(`[CharacterFormModal] Human detected: ${details.gender}, ${details.age}`);
            } else {
              // Non-human detected: populate description, clear human fields
              setFormData((prev) => ({
                ...prev,
                imageUrl: data.url,
                imageFileName: file.name,
                otherFeatures: analysisData.briefDescription || prev.otherFeatures,
                // Clear human-specific fields for non-human subjects
                hairColor: '',
                skinTone: '',
                age: '',
                clothing: '',
              }));
              console.log(`[CharacterFormModal] Non-human detected: ${analysisData.subjectType} - ${analysisData.briefDescription}`);
            }
          }
        } else {
          // Analysis failed. Read the structured error so we can show the *actual* cause
          // instead of always claiming "rate limited" (the old behavior misled us for months).
          let errorBody: { code?: string; error?: string } = {};
          try {
            errorBody = await analysisResponse.json();
          } catch {
            // body wasn't JSON (timeout, network error)
          }
          console.error('[CharacterFormModal] Character analysis failed:', {
            status: analysisResponse.status,
            ...errorBody,
          });
          setAnalysisError({
            code: errorBody.code || `HTTP_${analysisResponse.status}`,
            message: errorBody.error || `Analysis failed (HTTP ${analysisResponse.status})`,
          });
        }
      } catch (analysisError) {
        console.error('[CharacterFormModal] Auto-analysis error:', analysisError);
        setAnalysisError({
          code: 'NETWORK_ERROR',
          message: analysisError instanceof Error ? analysisError.message : 'Network error during analysis',
        });
      } finally {
        setAnalyzingImage(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };


  /**
   * Build fullDescription from form data
   * This is the source of truth for character identity across all scenes
   */
  const buildFullDescription = (): string => {
    const name = formData.name.trim();

    if (characterMode === 'description') {
      // For "From Description" mode - character type is the core identity
      // e.g., "Miaomiao is a fluffy yellow cat with green eyes"
      const parts = [formData.characterType];
      if (formData.otherFeatures) {
        parts.push(formData.otherFeatures);
      }
      return `${name} is a ${parts.join(', ')}`;
    } else {
      // For "From Photo" mode - build from parsed fields
      // e.g., "Henry is a 5-year-old boy with brown hair, light skin, wearing red t-shirt"
      const parts: string[] = [];

      if (formData.age) {
        parts.push(formData.age);
      }
      if (formData.hairColor) {
        parts.push(`${formData.hairColor} hair`);
      }
      if (formData.skinTone) {
        parts.push(`${formData.skinTone} skin`);
      }
      if (formData.otherFeatures) {
        parts.push(formData.otherFeatures);
      }

      let description = name;
      if (parts.length > 0) {
        description += ` (${parts.join(', ')})`;
      }

      // Add base outfit if specified
      if (formData.clothing) {
        description += `, wearing ${formData.clothing}`;
      }

      return description;
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Please enter a character name');
      return;
    }

    if (characterMode === 'description' && !formData.characterType.trim()) {
      alert('Please enter a character type (e.g., baby eagle, friendly dragon)');
      return;
    }

    // For description-only mode, store character type in otherFeatures
    const otherFeatures = characterMode === 'description'
      ? `${formData.characterType}${formData.otherFeatures ? ` - ${formData.otherFeatures}` : ''}`
      : formData.otherFeatures;

    // Build the full description - source of truth for all scene generation
    const fullDescription = buildFullDescription();

    // Detect if this is an animal character based on:
    // - "From Description" mode with animal-like character types
    // - "From Image" mode with detected animal/creature subjectType
    const isAnimal = characterMode === 'description'
      ? detectIsAnimal(formData.characterType)
      : (detectedSubjectType === 'animal' || detectedSubjectType === 'creature');

    // Determine subjectType:
    // - For "From Image" mode: use detected subjectType (default to 'human' if not detected)
    // - For "From Description" mode: infer from character type
    const subjectType: SubjectType = characterMode === 'photo'
      ? (detectedSubjectType || 'human')
      : (detectIsAnimal(formData.characterType) ? 'creature' : 'human');

    // For non-human subjects, don't save human-specific fields
    const isHuman = subjectType === 'human';

    const character: Character = {
      id: editingCharacter?.id || `char-${Date.now()}`,
      name: formData.name.trim(),
      referenceImage: {
        url: characterMode === 'photo' ? formData.imageUrl : '',
        fileName: characterMode === 'photo' ? formData.imageFileName : '',
      },
      animatedPreviewUrl: formData.animatedPreviewUrl || undefined,
      description: {
        hairColor: isHuman ? (formData.hairColor || undefined) : undefined,
        skinTone: isHuman ? (formData.skinTone || undefined) : undefined,
        clothing: isHuman ? (formData.clothing || undefined) : undefined,
        age: isHuman ? (formData.age || undefined) : undefined,
        otherFeatures: otherFeatures || undefined,
        fullDescription: fullDescription,
        isAnimal: isAnimal, // Flag for image generation
        subjectType: subjectType, // NEW: Store detected/inferred subject type
      },
      // "+ Add Character" button on the create flow always produces a character,
      // not a scene element. Pin the role explicitly so the story-bible builder
      // never treats this as location-eligible even if subjectType drifts.
      role: 'character',
      isPrimary: false,
      order: 0,
      // Mark as created via modal (will show compact after save)
      isFromLibrary: true,
    };

    onSave(character);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingCharacter ? 'Edit Character' : 'Create New Character'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Character Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How do you want to create this character?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* From Photo Option */}
              <button
                type="button"
                onClick={() => {
                  setCharacterMode('photo');
                  setFormData((prev) => ({ ...prev, animatedPreviewUrl: '', characterType: '' }));
                }}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-left ${
                  characterMode === 'photo'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  characterMode === 'photo'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 bg-white'
                }`}>
                  {characterMode === 'photo' && (
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">From Image</div>
                  <div className="text-xs text-gray-500">Upload any image - photo, drawing, etc.</div>
                </div>
              </button>

              {/* From Description Option */}
              <button
                type="button"
                onClick={() => {
                  setCharacterMode('description');
                  setFormData((prev) => ({ ...prev, animatedPreviewUrl: '', imageUrl: '', imageFileName: '' }));
                }}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-left ${
                  characterMode === 'description'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                }`}
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  characterMode === 'description'
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-gray-300 bg-white'
                }`}>
                  {characterMode === 'description' && (
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">From Description</div>
                  <div className="text-xs text-gray-500">Animals, fantasy, no photo</div>
                </div>
              </button>
            </div>
          </div>

          {/* Character Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              Character Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={characterMode === 'photo' ? 'e.g., Connor, Emma, Max' : 'e.g., Eddie the Eagle, Sparkle Dragon'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Character Type (Description mode only) */}
          {characterMode === 'description' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Character Type *
              </label>
              <input
                type="text"
                value={formData.characterType}
                onChange={(e) => setFormData({ ...formData, characterType: e.target.value })}
                placeholder="e.g., baby eagle, friendly dragon, talking cat"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Describe what kind of character this is (species, type, etc.)
              </p>
            </div>
          )}

          {/* Image Upload (Photo mode only) */}
          {characterMode === 'photo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Image (optional)
              </label>

              {formData.imageUrl ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <img
                    src={formData.imageUrl}
                    alt="Character preview"
                    className="w-12 h-12 object-cover rounded-lg border border-gray-300 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <a
                      href={formData.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate block"
                    >
                      {formData.imageFileName || 'View image'}
                    </a>
                    <p className="text-xs text-gray-400">Click to view full image</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imageUrl: '', imageFileName: '' })}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('modal-image-upload-input')?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      handleImageUpload(files[0]);
                    }
                  }}
                >
                  <input
                    id="modal-image-upload-input"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleImageUpload(files[0]);
                      }
                    }}
                  />
                  {uploadingImage ? (
                    <div>
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Processing image...</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">📷</div>
                      <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500">JPG, PNG, HEIC, GIF, WebP up to 10MB</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Character Description Fields */}
          {characterMode === 'photo' ? (
            // For "From Image" mode: show human fields only if human detected (or not yet detected)
            // After preview generation, if non-human detected, show simplified fields
            detectedSubjectType && detectedSubjectType !== 'human' ? (
              // Non-human detected: show simplified fields
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Detected: </span>
                    {detectedSubjectType === 'animal' && 'Animal'}
                    {detectedSubjectType === 'creature' && 'Fantasy Creature'}
                    {detectedSubjectType === 'object' && 'Object'}
                    {detectedSubjectType === 'scenery' && 'Scenery/Background'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Additional Details (optional)</label>
                  <textarea
                    rows={2}
                    value={formData.otherFeatures}
                    onChange={(e) => setFormData({ ...formData, otherFeatures: e.target.value })}
                    placeholder="colors, special features, personality traits..."
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Add any specific features you want to preserve
                  </p>
                </div>
              </div>
            ) : (
              // Human or not yet detected: show full human fields
              <div className="relative">
                {/* Analyzing overlay */}
                {analyzingImage && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-blue-600">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm font-medium">Analyzing image...</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hair Color</label>
                    <input
                      type="text"
                      value={formData.hairColor}
                      onChange={(e) => setFormData({ ...formData, hairColor: e.target.value })}
                      placeholder="brown, blonde..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                    <input
                      type="text"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="8 years old..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Skin Tone</label>
                    <input
                      type="text"
                      value={formData.skinTone}
                      onChange={(e) => setFormData({ ...formData, skinTone: e.target.value })}
                      placeholder="light, tan, dark..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Clothing</label>
                    <input
                      type="text"
                      value={formData.clothing}
                      onChange={(e) => setFormData({ ...formData, clothing: e.target.value })}
                      placeholder="blue shirt..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Other Features</label>
                    <textarea
                      rows={2}
                      value={formData.otherFeatures}
                      onChange={(e) => setFormData({ ...formData, otherFeatures: e.target.value })}
                      placeholder="glasses, freckles, curly hair..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            )
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Additional Details (optional)</label>
              <textarea
                rows={2}
                value={formData.otherFeatures}
                onChange={(e) => setFormData({ ...formData, otherFeatures: e.target.value })}
                placeholder="fluffy golden feathers, big curious eyes, wearing a tiny red scarf..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Add any specific features, colors, or accessories
              </p>
            </div>
          )}

          {/* Character Preview Section — shared CharacterPreviewStudio (generate / refine / compare / pick) */}
          {(characterMode === 'photo' ? formData.imageUrl : formData.characterType) && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <CharacterPreviewStudio
                input={{
                  name: formData.name,
                  mode: characterMode,
                  referenceImageUrl: formData.imageUrl || undefined,
                  characterType: formData.characterType || undefined,
                  subjectType: detectedSubjectType || undefined,
                  medium: detectedMedium,
                  description: {
                    hairColor: formData.hairColor || undefined,
                    skinTone: formData.skinTone || undefined,
                    age: formData.age || undefined,
                    otherFeatures: formData.otherFeatures || undefined,
                  },
                }}
                initialProvider="gemini-3.1"
                initialPreviewUrl={formData.animatedPreviewUrl || undefined}
                onPick={({ url }) => setFormData((prev) => ({ ...prev, animatedPreviewUrl: url }))}
                disabled={!formData.name.trim()}
                disabledReason={!formData.name.trim() ? 'Add a name first' : undefined}
              />
            </div>
          )}
        </div>

        {/* Break into parts — only for saved characters that came from a multi-element
            drawing (i.e., not themselves derived from a breakdown). */}
        {onBreakdown &&
          editingCharacter &&
          !editingCharacter.derivedFromId &&
          editingCharacter.animatedPreviewUrl && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => onBreakdown(editingCharacter)}
              className="group w-full text-left px-5 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-purple-900">Break into parts →</div>
                  <div className="text-xs text-purple-700 mt-0.5">
                    Extract individual characters or scene items from this drawing.
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg group-hover:bg-purple-700 transition-colors flex-shrink-0">
                  Start
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
          >
            {editingCharacter ? 'Update Character' : 'Save Character'}
          </button>
        </div>
      </div>
    </div>
  );
}
