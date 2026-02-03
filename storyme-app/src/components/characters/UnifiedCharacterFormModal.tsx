'use client';

import { useState, useEffect } from 'react';
import { Character, SubjectType } from '@/lib/types/story';
import { createClient } from '@/lib/supabase/client';

/**
 * Unified Character Form Modal
 *
 * This component consolidates the character creation/editing logic used in:
 * 1. Character Library page (saves to database)
 * 2. Story Creation flow (returns character to parent)
 *
 * Key Features:
 * - Photo upload with AI analysis
 * - Description-only mode for fantasy/animal characters
 * - Sketch generation for learning to draw
 * - Animated preview generation (Pixar + Classic styles)
 * - Configurable save behavior (database vs callback)
 */

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
 */
function detectIsAnimal(characterType: string): boolean {
  const lowerType = characterType.toLowerCase();
  return ANIMAL_KEYWORDS.some(animal => {
    const pattern = new RegExp(`\\b${animal}\\b`, 'i');
    return pattern.test(lowerType);
  });
}

interface SketchGuideData {
  guide_image_url: string;
  steps: Array<{
    step_number: number;
    title: string;
    description: string;
  }>;
  character_description: string;
}

interface UnifiedCharacterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: Character) => void | Promise<void>;
  editingCharacter?: Character | null;

  // Configuration
  mode: 'library' | 'story'; // library: save to DB, story: callback only
  userId?: string; // Required for library mode
  userEmail?: string; // Optional for library mode (for ensureUserExists)
  userName?: string; // Optional for library mode (for ensureUserExists)
  onReloadCharacters?: () => Promise<void>; // Required for library mode
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

export default function UnifiedCharacterFormModal({
  isOpen,
  onClose,
  onSave,
  editingCharacter = null,
  mode,
  userId,
  userEmail,
  userName,
  onReloadCharacters,
}: UnifiedCharacterFormModalProps) {
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
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [characterMode, setCharacterMode] = useState<'photo' | 'description'>('photo');
  const [previewOptions, setPreviewOptions] = useState<{
    pixar: string | null;
    classic: string | null;
  }>({ pixar: null, classic: null });
  const [selectedStyle, setSelectedStyle] = useState<'pixar' | 'classic' | null>(null);
  const [detectedSubjectType, setDetectedSubjectType] = useState<SubjectType | null>(null);

  // Sketch generation state
  const [sketchGuideData, setSketchGuideData] = useState<SketchGuideData | null>(null);
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);

  // CRITICAL FIX: Restore editing state when editingCharacter changes
  useEffect(() => {
    if (editingCharacter) {
      // Fix Issue #2: Restore character mode based on whether photo exists
      const isDescriptionOnly = !editingCharacter.referenceImage?.url;
      setCharacterMode(isDescriptionOnly ? 'description' : 'photo');

      // Fix Issue #4: Parse character type from otherFeatures for description-mode characters
      let parsedCharacterType = '';
      let parsedOtherFeatures = editingCharacter.description.otherFeatures || '';

      if (isDescriptionOnly && parsedOtherFeatures) {
        // Format in DB: "baby eagle - fluffy golden feathers"
        // Parse back into: characterType="baby eagle", otherFeatures="fluffy golden feathers"
        const parts = parsedOtherFeatures.split(' - ');
        if (parts.length > 1) {
          parsedCharacterType = parts[0];
          parsedOtherFeatures = parts.slice(1).join(' - ');
        } else {
          parsedCharacterType = parsedOtherFeatures;
          parsedOtherFeatures = '';
        }
      }

      // Update form data with parsed values
      setFormData({
        name: editingCharacter.name,
        hairColor: editingCharacter.description.hairColor || '',
        skinTone: editingCharacter.description.skinTone || '',
        clothing: editingCharacter.description.clothing || '',
        age: editingCharacter.description.age || '',
        otherFeatures: parsedOtherFeatures,
        imageUrl: editingCharacter.referenceImage?.url || '',
        imageFileName: editingCharacter.referenceImage?.fileName || '',
        animatedPreviewUrl: editingCharacter.animatedPreviewUrl || '',
        characterType: parsedCharacterType,
      });

      // Fix Issue #3: Restore preview options
      if (editingCharacter.animatedPreviewUrl) {
        setPreviewOptions({
          pixar: editingCharacter.animatedPreviewUrl,
          classic: editingCharacter.animatedPreviewUrl,
        });
        setSelectedStyle('pixar');
      } else {
        setPreviewOptions({ pixar: null, classic: null });
        setSelectedStyle(null);
      }

      // Fix Issue #1: Restore sketch if exists
      if (editingCharacter.sketchImageUrl) {
        setSketchGuideData({
          guide_image_url: editingCharacter.sketchImageUrl,
          steps: [],
          character_description: '',
        });
        setSketchError(null);
      } else {
        setSketchGuideData(null);
        setSketchError(null);
      }
    } else {
      // New character - reset to defaults
      resetForm();
    }
  }, [editingCharacter]);

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
    setPreviewOptions({ pixar: null, classic: null });
    setSelectedStyle(null);
    setPreviewError(null);
    setCharacterMode('photo');
    setDetectedSubjectType(null);
    setSketchGuideData(null);
    setIsGeneratingSketch(false);
    setSketchError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleImageUpload = async (file: File) => {
    // Client-side validation for supported formats
    const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    const fileName = file.name.toLowerCase();
    const unsupportedExtensions = ['.avif', '.heic', '.heif', '.bmp', '.tiff', '.tif', '.svg'];
    const hasUnsupportedExt = unsupportedExtensions.some(ext => fileName.endsWith(ext));

    if (!supportedTypes.includes(file.type) || hasUnsupportedExt) {
      alert('Unsupported image format. Please use PNG, JPG, GIF, or WebP images.\n\nAVIF and HEIC formats are not supported by AI image processing.');
      return;
    }

    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      setDetectedSubjectType(null);
      setFormData({
        ...formData,
        imageUrl: data.url,
        imageFileName: file.name,
      });

      // Auto-analyze image
      console.log('Analyzing character image:', data.url);
      setAnalyzingImage(true);

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

            if (analysisData.subjectType === 'human' && analysisData.humanDetails) {
              const details = analysisData.humanDetails;
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
              console.log(`[UnifiedCharacterForm] Human detected: ${details.gender}, ${details.age}`);
            } else {
              setFormData((prev) => ({
                ...prev,
                imageUrl: data.url,
                imageFileName: file.name,
                otherFeatures: analysisData.briefDescription || prev.otherFeatures,
                hairColor: '',
                skinTone: '',
                age: '',
                clothing: '',
              }));
              console.log(`[UnifiedCharacterForm] Non-human detected: ${analysisData.subjectType} - ${analysisData.briefDescription}`);
            }
          }
        } else {
          console.error('Character analysis API failed');
        }
      } catch (analysisError) {
        console.error('Auto-analysis error:', analysisError);
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

  const handleGeneratePreview = async () => {
    if (characterMode === 'photo') {
      if (!formData.imageUrl || !formData.name) {
        setPreviewError('Name and reference image are required');
        return;
      }
    } else {
      if (!formData.name || !formData.characterType) {
        setPreviewError('Name and character type are required');
        return;
      }
    }

    setGeneratingPreview(true);
    setPreviewError(null);
    setPreviewOptions({ pixar: null, classic: null });
    setSelectedStyle(null);

    try {
      const requestBody = characterMode === 'photo'
        ? {
            name: formData.name,
            referenceImageUrl: formData.imageUrl,
            subjectType: detectedSubjectType || undefined,
            subjectDescription: detectedSubjectType !== 'human' ? formData.otherFeatures : undefined,
            description: {
              hairColor: formData.hairColor,
              skinTone: formData.skinTone,
              clothing: formData.clothing,
              age: formData.age,
              otherFeatures: formData.otherFeatures,
            },
          }
        : {
            name: formData.name,
            characterType: formData.characterType,
            description: {
              hairColor: formData.hairColor,
              age: formData.age,
              otherFeatures: formData.otherFeatures,
            },
          };

      const response = await fetch('/api/generate-character-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      const data = await response.json();

      if (data.subjectType && characterMode === 'photo' && !detectedSubjectType) {
        setDetectedSubjectType(data.subjectType);
        console.log(`[UnifiedCharacterForm] Detected subject type from preview: ${data.subjectType}`);

        if (data.subjectType !== 'human' && data.subjectDescription && !formData.otherFeatures) {
          setFormData((prev) => ({
            ...prev,
            otherFeatures: data.subjectDescription,
          }));
        }
      }

      if (data.previews) {
        setPreviewOptions({
          pixar: data.previews.pixar?.imageUrl || null,
          classic: data.previews.classic?.imageUrl || null,
        });
        if (data.previews.pixar?.imageUrl) {
          setSelectedStyle('pixar');
          setFormData((prev) => ({ ...prev, animatedPreviewUrl: data.previews.pixar.imageUrl }));
        } else if (data.previews.classic?.imageUrl) {
          setSelectedStyle('classic');
          setFormData((prev) => ({ ...prev, animatedPreviewUrl: data.previews.classic.imageUrl }));
        }
      } else {
        const imageUrl = data.preview?.imageUrl || data.imageUrl;
        setFormData((prev) => ({ ...prev, animatedPreviewUrl: imageUrl }));
      }
    } catch (err: any) {
      console.error('Preview generation error:', err);
      setPreviewError(err.message || 'Failed to generate preview');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleSelectStyle = (style: 'pixar' | 'classic') => {
    const imageUrl = style === 'pixar' ? previewOptions.pixar : previewOptions.classic;
    if (imageUrl) {
      setSelectedStyle(style);
      setFormData((prev) => ({ ...prev, animatedPreviewUrl: imageUrl }));
    }
  };

  /**
   * Generate simple sketch for learning to draw
   */
  const generateSketchGuide = async () => {
    if (!formData.name || !formData.characterType) {
      setSketchError('Please fill in Character Name and Type first');
      return;
    }

    setIsGeneratingSketch(true);
    setSketchError(null);

    try {
      const response = await fetch('/api/characters/sketch-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: formData.name,
          character_type: formData.characterType,
          additional_details: formData.otherFeatures || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate sketch');
      }

      const data = await response.json();
      console.log('[UnifiedCharacterForm] Sketch generated:', data);

      if (data.success && data.guide) {
        setSketchGuideData(data.guide);
        setSketchError(null);
      } else {
        throw new Error('Invalid response from sketch API');
      }
    } catch (error: any) {
      console.error('[UnifiedCharacterForm] Sketch generation error:', error);
      setSketchError(error.message || 'Failed to generate sketch guide');
    } finally {
      setIsGeneratingSketch(false);
    }
  };

  /**
   * Upload preview image (animated or sketch) to Supabase Storage
   */
  const uploadPreviewToStorage = async (
    dataUrl: string,
    userId: string,
    imageType: 'preview' | 'sketch' = 'preview'
  ): Promise<string> => {
    const supabase = createClient();

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const prefix = imageType === 'sketch' ? 'sketch' : 'animated-preview';
    const fileName = `${userId}/${prefix}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('character-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${imageType}: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('character-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  /**
   * Fix Issue #5: Ensure user exists in database before saving character
   */
  const ensureUserExists = async (userId: string, email?: string, name?: string) => {
    const supabase = createClient();

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingUser) {
      return { success: true, created: false };
    }

    // Create user if doesn't exist
    const { error } = await supabase
      .from('users')
      .insert([{
        id: userId,
        email: email || `user-${userId}@storyme.app`,
        name: name || 'StoryMe User',
        subscription_tier: 'free'
      }]);

    if (error && error.code !== '23505') { // Ignore duplicate key error
      console.error('Error creating user:', error);
      return { success: false, error };
    }

    return { success: true, created: true };
  };

  /**
   * Build fullDescription from form data
   */
  const buildFullDescription = (): string => {
    const name = formData.name.trim();

    if (characterMode === 'description') {
      const parts = [formData.characterType];
      if (formData.otherFeatures) {
        parts.push(formData.otherFeatures);
      }
      return `${name} is a ${parts.join(', ')}`;
    } else {
      const parts: string[] = [];

      if (formData.age) parts.push(formData.age);
      if (formData.hairColor) parts.push(`${formData.hairColor} hair`);
      if (formData.skinTone) parts.push(`${formData.skinTone} skin`);
      if (formData.otherFeatures) parts.push(formData.otherFeatures);

      let description = name;
      if (parts.length > 0) {
        description += ` (${parts.join(', ')})`;
      }

      if (formData.clothing) {
        description += `, wearing ${formData.clothing}`;
      }

      return description;
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a character name');
      return;
    }

    if (characterMode === 'description' && !formData.characterType.trim()) {
      alert('Please enter a character type (e.g., baby eagle, friendly dragon)');
      return;
    }

    if (mode === 'library') {
      // Library mode: Save to database
      if (!userId) {
        alert('User not found');
        return;
      }

      try {
        // Fix Issue #5: Ensure user exists in database first
        console.log('[UnifiedCharacterForm] Ensuring user exists...', { userId, userEmail, userName });
        const userResult = await ensureUserExists(userId, userEmail, userName);
        console.log('[UnifiedCharacterForm] User ensure result:', userResult);

        const supabase = createClient();

        // Upload animated preview if it's a data URL
        let finalPreviewUrl = formData.animatedPreviewUrl || null;
        if (formData.animatedPreviewUrl && formData.animatedPreviewUrl.startsWith('data:')) {
          finalPreviewUrl = await uploadPreviewToStorage(formData.animatedPreviewUrl, userId);
        }

        // Upload sketch image if it exists and is a data URL
        let finalSketchUrl = sketchGuideData?.guide_image_url || null;
        if (sketchGuideData?.guide_image_url && sketchGuideData.guide_image_url.startsWith('data:')) {
          finalSketchUrl = await uploadPreviewToStorage(sketchGuideData.guide_image_url, userId, 'sketch');
        }

        const otherFeatures = characterMode === 'description'
          ? `${formData.characterType}${formData.otherFeatures ? ` - ${formData.otherFeatures}` : ''}`
          : formData.otherFeatures || null;

        const subjectType: SubjectType = characterMode === 'photo'
          ? (detectedSubjectType || 'human')
          : (formData.characterType && detectIsAnimal(formData.characterType) ? 'creature' : 'human');

        const isHuman = subjectType === 'human';

        const characterData = {
          user_id: userId,
          name: formData.name.trim(),
          reference_image_url: characterMode === 'photo' ? (formData.imageUrl || null) : null,
          reference_image_filename: characterMode === 'photo' ? (formData.imageFileName || null) : null,
          animated_preview_url: finalPreviewUrl,
          sketch_image_url: finalSketchUrl,
          hair_color: isHuman ? (formData.hairColor || null) : null,
          skin_tone: isHuman ? (formData.skinTone || null) : null,
          clothing: isHuman ? (formData.clothing || null) : null,
          age: isHuman ? (formData.age || null) : null,
          other_features: otherFeatures,
          subject_type: subjectType,
        };

        console.log('[UnifiedCharacterForm] Saving to database:', characterData);

        let result;
        if (editingCharacter) {
          result = await supabase
            .from('character_library')
            .update(characterData)
            .eq('id', editingCharacter.id)
            .select();
        } else {
          result = await supabase
            .from('character_library')
            .insert([characterData])
            .select();
        }

        if (result.error) throw result.error;

        // Reload characters list
        if (onReloadCharacters) {
          await onReloadCharacters();
        }

        handleClose();
      } catch (error: any) {
        console.error('[UnifiedCharacterForm] Error saving to database:', error);
        alert(`Error: ${error?.message || 'Failed to save character'}`);
      }
    } else {
      // Story mode: Return character to parent
      const otherFeatures = characterMode === 'description'
        ? `${formData.characterType}${formData.otherFeatures ? ` - ${formData.otherFeatures}` : ''}`
        : formData.otherFeatures;

      const fullDescription = buildFullDescription();

      const isAnimal = characterMode === 'description'
        ? detectIsAnimal(formData.characterType)
        : (detectedSubjectType === 'animal' || detectedSubjectType === 'creature');

      const subjectType: SubjectType = characterMode === 'photo'
        ? (detectedSubjectType || 'human')
        : (detectIsAnimal(formData.characterType) ? 'creature' : 'human');

      const isHuman = subjectType === 'human';

      const character: Character = {
        id: editingCharacter?.id || `char-${Date.now()}`,
        name: formData.name.trim(),
        referenceImage: {
          url: characterMode === 'photo' ? formData.imageUrl : '',
          fileName: characterMode === 'photo' ? formData.imageFileName : '',
        },
        animatedPreviewUrl: formData.animatedPreviewUrl || undefined,
        sketchImageUrl: sketchGuideData?.guide_image_url || undefined,
        description: {
          hairColor: isHuman ? (formData.hairColor || undefined) : undefined,
          skinTone: isHuman ? (formData.skinTone || undefined) : undefined,
          clothing: isHuman ? (formData.clothing || undefined) : undefined,
          age: isHuman ? (formData.age || undefined) : undefined,
          otherFeatures: otherFeatures || undefined,
          fullDescription: fullDescription,
          isAnimal: isAnimal,
          subjectType: subjectType,
        },
        isPrimary: false,
        order: 0,
        isFromLibrary: true,
      };

      await onSave(character);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
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
              <button
                type="button"
                onClick={() => {
                  setCharacterMode('photo');
                  setPreviewOptions({ pixar: null, classic: null });
                  setSelectedStyle(null);
                  setFormData((prev) => ({ ...prev, animatedPreviewUrl: '', characterType: '' }));
                  setSketchGuideData(null);
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

              <button
                type="button"
                onClick={() => {
                  setCharacterMode('description');
                  setPreviewOptions({ pixar: null, classic: null });
                  setSelectedStyle(null);
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
              {characterMode === 'description' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.name || !formData.characterType) {
                      setSketchError('Please fill in Character Name and Type first');
                      return;
                    }
                    generateSketchGuide();
                  }}
                  disabled={isGeneratingSketch}
                  className="group relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Generate simple sketch for learning"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    Want to learn how to draw this?<br />
                    <span className="text-gray-300">Click to generate a simple sketch!</span>
                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></span>
                  </span>
                </button>
              )}
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
                  onClick={() => document.getElementById('unified-image-upload-input')?.click()}
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
                    id="unified-image-upload-input"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
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
                      <p className="text-sm text-gray-600">Uploading...</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">📷</div>
                      <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF, WebP up to 10MB</p>
                      <p className="text-xs text-gray-400">(AVIF/HEIC not supported)</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Character Description Fields */}
          {characterMode === 'photo' ? (
            detectedSubjectType && detectedSubjectType !== 'human' ? (
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
                  <input
                    type="text"
                    value={formData.otherFeatures}
                    onChange={(e) => setFormData({ ...formData, otherFeatures: e.target.value })}
                    placeholder="colors, special features, personality traits..."
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Add any specific features you want to preserve
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
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
                    <input
                      type="text"
                      value={formData.otherFeatures}
                      onChange={(e) => setFormData({ ...formData, otherFeatures: e.target.value })}
                      placeholder="glasses, freckles, curly hair..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Additional Details (optional)</label>
              <input
                type="text"
                value={formData.otherFeatures}
                onChange={(e) => setFormData({ ...formData, otherFeatures: e.target.value })}
                placeholder="fluffy golden feathers, big curious eyes, wearing a tiny red scarf..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Add any specific features, colors, or accessories
              </p>
            </div>
          )}

          {/* Show sketch error if any */}
          {sketchError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {sketchError}
            </div>
          )}

          {/* Character Preview Section */}
          {(characterMode === 'description' || (characterMode === 'photo' && formData.imageUrl)) && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Character Preview</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                {formData.animatedPreviewUrl && previewOptions.pixar === previewOptions.classic
                  ? 'Compare your reference with the saved animated preview.'
                  : 'Generate preview styles to see how your character will appear in stories.'}
              </p>

              {/* Preview UI - Simplified for story mode (no sketch boxes) */}
              {generatingPreview ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-purple-600 font-medium">Generating 2 style options...</p>
                  <p className="text-xs text-gray-400 mt-1">This takes 15-30 seconds</p>
                </div>
              ) : (previewOptions.pixar || previewOptions.classic) && previewOptions.pixar !== previewOptions.classic ? (
                /* Style selection grid */
                <div className="space-y-4">
                  {/* Show sketch in library mode and description mode */}
                  {mode === 'library' && characterMode === 'description' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-blue-700 mb-2">
                          {isGeneratingSketch || sketchGuideData ? 'ℹ️ Simple Sketch' : 'Character'}
                        </p>

                        {isGeneratingSketch ? (
                          <div className="bg-blue-50 rounded-xl aspect-square flex items-center justify-center border-2 border-blue-300">
                            <div className="text-center">
                              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                              <p className="text-blue-600 font-medium text-sm">Generating sketch...</p>
                            </div>
                          </div>
                        ) : sketchGuideData ? (
                          <button
                            type="button"
                            onClick={() => generateSketchGuide()}
                            className="w-full aspect-square border-2 border-gray-300 hover:border-blue-400 rounded-xl p-4 bg-white transition-colors cursor-pointer"
                          >
                            <img
                              src={sketchGuideData.guide_image_url}
                              alt="Simple sketch for learning"
                              className="w-full h-full object-contain pointer-events-none"
                            />
                          </button>
                        ) : (
                          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl aspect-square flex items-center justify-center border border-blue-200">
                            <div className="text-center p-4">
                              <p className="text-sm font-medium text-gray-700">{formData.characterType || 'Character type'}</p>
                              <p className="text-xs text-gray-500 mt-2">Click ℹ️ above to generate sketch</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700 mb-2">Choose Style Below ↓</p>
                        <div className="bg-gradient-to-br from-purple-50 to-amber-50 rounded-xl aspect-square flex items-center justify-center border-2 border-dashed border-gray-300">
                          <div className="text-center text-gray-400">
                            <div className="text-3xl mb-2">👇</div>
                            <p className="text-xs">Select Pixar or Classic</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-sm font-medium text-gray-700">Choose your preferred style:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                        selectedStyle === 'pixar'
                          ? 'border-purple-500 ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-purple-300'
                      } ${!previewOptions.pixar ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => previewOptions.pixar && handleSelectStyle('pixar')}
                    >
                      <div className="aspect-square bg-gray-50">
                        {previewOptions.pixar ? (
                          <img
                            src={previewOptions.pixar}
                            alt="3D Pixar Style"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            <span className="text-sm">Failed to generate</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-white border-t">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-gray-900">3D Pixar</span>
                          {selectedStyle === 'pixar' && (
                            <span className="text-purple-600 text-xs">✓ Selected</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">Disney/Pixar CGI style</p>
                      </div>
                      {selectedStyle === 'pixar' && (
                        <div className="absolute top-2 right-2 bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                          ✓
                        </div>
                      )}
                    </div>

                    <div
                      className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                        selectedStyle === 'classic'
                          ? 'border-amber-500 ring-2 ring-amber-200'
                          : 'border-gray-200 hover:border-amber-300'
                      } ${!previewOptions.classic ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => previewOptions.classic && handleSelectStyle('classic')}
                    >
                      <div className="aspect-square bg-gray-50">
                        {previewOptions.classic ? (
                          <img
                            src={previewOptions.classic}
                            alt="Classic Storybook Style"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            <span className="text-sm">Failed to generate</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-white border-t">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-gray-900">Classic Storybook</span>
                          {selectedStyle === 'classic' && (
                            <span className="text-amber-600 text-xs">✓ Selected</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">Warm 2D illustration</p>
                      </div>
                      {selectedStyle === 'classic' && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Initial state - Simple preview placeholder */
                <div className="grid grid-cols-2 gap-4">
                  {/* Show sketch box only in library mode + description mode */}
                  {mode === 'library' && characterMode === 'description' && (
                    <div className="text-center">
                      <p className="text-sm font-medium text-blue-700 mb-2">
                        {isGeneratingSketch || sketchGuideData ? 'ℹ️ Simple Sketch' : 'Simple Sketch'}
                      </p>

                      {isGeneratingSketch ? (
                        <div className="bg-blue-50 rounded-xl aspect-square flex items-center justify-center border-2 border-blue-300">
                          <div className="text-center">
                            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                            <p className="text-blue-600 font-medium text-sm">Generating sketch...</p>
                          </div>
                        </div>
                      ) : sketchGuideData ? (
                        <button
                          type="button"
                          onClick={() => generateSketchGuide()}
                          className="w-full aspect-square border-2 border-gray-300 hover:border-blue-400 rounded-xl p-4 bg-white transition-colors cursor-pointer"
                        >
                          <img
                            src={sketchGuideData.guide_image_url}
                            alt="Simple sketch for learning"
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.name || !formData.characterType) {
                              setSketchError('Please fill in Character Name and Type first');
                              return;
                            }
                            generateSketchGuide();
                          }}
                          disabled={isGeneratingSketch || !formData.name || !formData.characterType}
                          className="w-full aspect-square border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl flex items-center justify-center bg-gray-50 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <div className="text-center p-4">
                            <div className="text-5xl mb-3">✏️</div>
                            <p className="text-base font-bold text-gray-900 mb-2">{formData.characterType || 'Character type'}</p>
                            <p className="text-sm text-blue-600 font-medium">Click to Generate</p>
                          </div>
                        </button>
                      )}
                    </div>
                  )}

                  <div className={mode === 'library' && characterMode === 'description' ? '' : 'col-span-2'}>
                    <div className="text-center">
                      <p className="text-sm font-medium text-purple-700 mb-2">Animated Preview</p>
                      <button
                        type="button"
                        onClick={handleGeneratePreview}
                        disabled={generatingPreview || (characterMode === 'photo' ? !formData.imageUrl : !formData.characterType)}
                        className="bg-gradient-to-br from-purple-50 to-amber-50 rounded-xl aspect-square flex items-center justify-center border-2 border-dashed border-purple-300 hover:border-purple-500 hover:from-purple-100 hover:to-amber-100 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group w-full"
                      >
                        <div className="text-center p-4">
                          <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">✨</div>
                          <p className="text-base font-bold text-gray-900 mb-2">Preview Styles</p>
                          <p className="text-sm text-purple-600 font-bold group-hover:text-purple-700">
                            Click to Generate
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {previewError && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {previewError}
                </div>
              )}
            </div>
          )}
        </div>

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
