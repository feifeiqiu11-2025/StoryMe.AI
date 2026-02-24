/**
 * Character Library Page
 * Manage and reuse characters across stories
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Character, SubjectType } from '@/lib/types/story';
import Link from 'next/link';
import Image from 'next/image';
import { SketchStep } from '@/components/characters/SketchGuideViewer';

const CHARACTERS_STORAGE_KEY = 'storyme_character_library';

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
function isAnimalType(characterType: string): boolean {
  const lowerType = characterType.toLowerCase();
  return ANIMAL_KEYWORDS.some(animal => {
    const pattern = new RegExp(`\\b${animal}\\b`, 'i');
    return pattern.test(lowerType);
  });
}

// Helper to ensure user exists in database
async function ensureUserExists(userId: string, email?: string, name?: string) {
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
}

export default function CharactersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showNewCharacterForm, setShowNewCharacterForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    hairColor: '',
    skinTone: '',
    clothing: '',
    age: '',
    otherFeatures: '',
    imageUrl: '',
    imageFileName: '',
    animatedPreviewUrl: '',
    characterType: '', // For description-only mode: "baby eagle", "friendly dragon", etc.
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false); // Shows overlay while AI analyzes
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Character mode: 'photo' (upload reference) or 'description' (generate from text)
  const [characterMode, setCharacterMode] = useState<'photo' | 'description'>('photo');
  // Dual style previews
  const [previewOptions, setPreviewOptions] = useState<{
    pixar: string | null;
    classic: string | null;
  }>({ pixar: null, classic: null });
  const [selectedStyle, setSelectedStyle] = useState<'pixar' | 'classic' | null>(null);
  // Detected subject type from AI (for image mode)
  const [detectedSubjectType, setDetectedSubjectType] = useState<SubjectType | null>(null);
  // Sketch guide state
  const [sketchGuideData, setSketchGuideData] = useState<{
    guide_image_url: string;
    steps: SketchStep[];
    character_description: string;
  } | null>(null);
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);

  // Load characters from database
  const loadCharacters = async (userId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('character_library')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform database records to Character type
      const transformedCharacters: Character[] = (data || []).map((char: any) => ({
        id: char.id,
        name: char.name,
        referenceImage: {
          url: char.reference_image_url || '',
          fileName: char.reference_image_filename || '',
        },
        animatedPreviewUrl: char.animated_preview_url || undefined,
        sketchImageUrl: char.sketch_image_url || undefined,
        description: {
          hairColor: char.hair_color,
          skinTone: char.skin_tone,
          clothing: char.clothing,
          age: char.age,
          otherFeatures: char.other_features,
        },
        isPrimary: false,
        order: 0,
      }));

      setCharacters(transformedCharacters);
    } catch (error) {
      console.error('Error loading characters:', error);
      setCharacters([]);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (supabaseUser) {
          const userData = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
          };
          setUser(userData);
          await loadCharacters(supabaseUser.id);
        } else {
          router.push('/login');
        }
      } else {
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
            await loadCharacters(session.user.id);
          } else {
            localStorage.removeItem('storyme_session');
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [router]);

  const handleOpenForm = (character?: Character) => {
    if (character) {
      setEditingCharacter(character);
      // Determine if this was a description-only character (no reference image)
      const isDescriptionOnly = !character.referenceImage.url;
      setCharacterMode(isDescriptionOnly ? 'description' : 'photo');

      // Parse characterType from otherFeatures for description-only characters
      // Format: "characterType - additionalDetails" or just "characterType"
      let parsedCharacterType = '';
      let parsedOtherFeatures = character.description.otherFeatures || '';

      if (isDescriptionOnly && character.description.otherFeatures) {
        const otherFeaturesStr = character.description.otherFeatures;
        const dashIndex = otherFeaturesStr.indexOf(' - ');

        if (dashIndex !== -1) {
          // Format: "characterType - additionalDetails"
          parsedCharacterType = otherFeaturesStr.substring(0, dashIndex).trim();
          parsedOtherFeatures = otherFeaturesStr.substring(dashIndex + 3).trim();
        } else {
          // Format: just "characterType" (no additional details)
          parsedCharacterType = otherFeaturesStr;
          parsedOtherFeatures = '';
        }
      }

      setFormData({
        name: character.name,
        hairColor: character.description.hairColor || '',
        skinTone: character.description.skinTone || '',
        clothing: character.description.clothing || '',
        age: character.description.age || '',
        otherFeatures: parsedOtherFeatures,
        imageUrl: character.referenceImage.url,
        imageFileName: character.referenceImage.fileName,
        animatedPreviewUrl: character.animatedPreviewUrl || '',
        characterType: parsedCharacterType,
      });
      // Restore preview if character has an animated preview URL
      if (character.animatedPreviewUrl) {
        // Show the saved preview in the appropriate style slot
        // Since we don't store which style was selected, show it in both for now
        setPreviewOptions({
          pixar: character.animatedPreviewUrl,
          classic: character.animatedPreviewUrl,
        });
        setSelectedStyle('pixar'); // Default to showing as selected
      } else {
        setPreviewOptions({ pixar: null, classic: null });
        setSelectedStyle(null);
      }
      // Restore sketch if character has one
      if (character.sketchImageUrl) {
        setSketchGuideData({
          guide_image_url: character.sketchImageUrl,
          steps: [],
          character_description: '',
        });
        setSketchError(null);
      } else {
        setSketchGuideData(null);
        setSketchError(null);
      }
      setPreviewError(null);
    } else {
      setEditingCharacter(null);
      setCharacterMode('photo');
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
      setSketchGuideData(null);
      setSketchError(null);
    }
    setShowNewCharacterForm(true);
  };

  const handleCloseForm = () => {
    setShowNewCharacterForm(false);
    setEditingCharacter(null);
    setUploadingImage(false);
    setGeneratingPreview(false);
    setPreviewError(null);
    setPreviewOptions({ pixar: null, classic: null });
    setSelectedStyle(null);
    setCharacterMode('photo');
    setDetectedSubjectType(null);
    setSketchGuideData(null);
    setSketchError(null);
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
  };

  // Generate animated preview (both styles in parallel)
  const handleGeneratePreview = async () => {
    // Validate based on mode
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
      // Build request based on mode
      // Pass pre-detected subjectType to avoid redundant AI detection
      const requestBody = characterMode === 'photo'
        ? {
            name: formData.name,
            referenceImageUrl: formData.imageUrl,
            subjectType: detectedSubjectType || undefined, // Pass pre-detected type
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

      // Store detected subject type from API (for image mode)
      // Only update if we didn't already detect during upload (backward compatibility)
      if (data.subjectType && characterMode === 'photo' && !detectedSubjectType) {
        setDetectedSubjectType(data.subjectType);
        console.log(`[Characters] Detected subject type from preview: ${data.subjectType}`);

        // For non-human subjects, populate otherFeatures only if empty
        // (don't overwrite user's manual edits)
        if (data.subjectType !== 'human' && data.subjectDescription && !formData.otherFeatures) {
          setFormData((prev) => ({
            ...prev,
            otherFeatures: data.subjectDescription,
          }));
          console.log(`[Characters] Populated otherFeatures with: ${data.subjectDescription}`);
        }
      }

      // API now returns { success, previews: { pixar, classic }, preview (backward compat) }
      if (data.previews) {
        setPreviewOptions({
          pixar: data.previews.pixar?.imageUrl || null,
          classic: data.previews.classic?.imageUrl || null,
        });
        // Auto-select first available style
        if (data.previews.pixar?.imageUrl) {
          setSelectedStyle('pixar');
          setFormData((prev) => ({ ...prev, animatedPreviewUrl: data.previews.pixar.imageUrl }));
        } else if (data.previews.classic?.imageUrl) {
          setSelectedStyle('classic');
          setFormData((prev) => ({ ...prev, animatedPreviewUrl: data.previews.classic.imageUrl }));
        }
      } else {
        // Backward compatibility - single preview
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

  // Generate sketch guide for drawing tutorial
  const generateSketchGuide = async () => {
    if (!formData.name || !formData.characterType) {
      setSketchError('Name and character type are required');
      return;
    }

    setIsGeneratingSketch(true);
    setSketchError(null);

    try {
      const response = await fetch('/api/characters/sketch-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: formData.name.trim(),
          character_type: formData.characterType.trim(),
          additional_details: formData.otherFeatures || undefined,
        }),
      });

      const data = await response.json();

      console.log('[Client] Sketch guide response:', data);
      console.log('[Client] Image URL length:', data.data?.guide_image_url?.length);
      console.log('[Client] Image URL preview:', data.data?.guide_image_url?.substring(0, 100));

      // Test if the base64 image is valid by trying to load it
      if (data.success && data.data?.guide_image_url) {
        const testImg = document.createElement('img');
        testImg.onload = () => {
          console.log('[Client] ✅ Image loaded successfully! Dimensions:', testImg.width, 'x', testImg.height);
        };
        testImg.onerror = (e) => {
          console.error('[Client] ❌ Image failed to load!', e);
          console.error('[Client] Problematic URL (first 200 chars):', data.data.guide_image_url.substring(0, 200));
        };
        testImg.src = data.data.guide_image_url;

        setSketchGuideData(data.data);
        console.log('[Client] Sketch guide data set successfully');
      } else {
        setSketchError(data.error?.message || 'Failed to generate sketch guide');
      }
    } catch (err: any) {
      console.error('Sketch guide generation error:', err);
      setSketchError(err.message || 'Failed to generate sketch guide');
    } finally {
      setIsGeneratingSketch(false);
    }
  };

  // Handle style selection
  const handleSelectStyle = (style: 'pixar' | 'classic') => {
    const imageUrl = style === 'pixar' ? previewOptions.pixar : previewOptions.classic;
    if (imageUrl) {
      setSelectedStyle(style);
      setFormData((prev) => ({ ...prev, animatedPreviewUrl: imageUrl }));
    }
  };

  // Upload animated preview to Supabase storage
  const uploadPreviewToStorage = async (dataUrl: string, userId: string, imageType: 'preview' | 'sketch' = 'preview'): Promise<string> => {
    const supabase = createClient();

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create file path based on image type
    const prefix = imageType === 'sketch' ? 'sketch' : 'animated-preview';
    const fileName = `${userId}/${prefix}-${Date.now()}.png`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('character-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${imageType}: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('character-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
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
              console.log(`[Characters] Human detected: ${details.gender}, ${details.age}`);
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
              console.log(`[Characters] Non-human detected: ${analysisData.subjectType} - ${analysisData.briefDescription}`);
            }
          }
        } else {
          console.error('Character analysis API failed');
          // Fail silently - user can still fill in manually
        }
      } catch (analysisError) {
        console.error('Auto-analysis error:', analysisError);
        // Fail silently - user can still fill in manually
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

  const handleSaveCharacter = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a character name');
      return;
    }

    // Validation for description-only mode
    if (characterMode === 'description' && !formData.characterType.trim()) {
      alert('Please enter a character type (e.g., baby eagle, friendly dragon)');
      return;
    }

    if (!user?.id) {
      alert('User not found');
      return;
    }

    try {
      // Ensure user exists in database first
      console.log('Ensuring user exists...', { userId: user.id, email: user.email, name: user.name });
      const userResult = await ensureUserExists(user.id, user.email, user.name);
      console.log('User ensure result:', userResult);

      const supabase = createClient();

      // Upload animated preview if it's a data URL
      let finalPreviewUrl = formData.animatedPreviewUrl || null;
      if (formData.animatedPreviewUrl && formData.animatedPreviewUrl.startsWith('data:')) {
        finalPreviewUrl = await uploadPreviewToStorage(formData.animatedPreviewUrl, user.id);
      }

      // Upload sketch image if it exists and is a data URL
      let finalSketchUrl = sketchGuideData?.guide_image_url || null;
      if (sketchGuideData?.guide_image_url && sketchGuideData.guide_image_url.startsWith('data:')) {
        finalSketchUrl = await uploadPreviewToStorage(sketchGuideData.guide_image_url, user.id, 'sketch');
      }

      // For description-only mode, store character type in other_features
      const otherFeatures = characterMode === 'description'
        ? `${formData.characterType}${formData.otherFeatures ? ` - ${formData.otherFeatures}` : ''}`
        : formData.otherFeatures || null;

      // Determine subject type for storage
      // - For "From Image" mode: use detected subjectType (default to 'human' if not detected)
      // - For "From Description" mode: infer from character type
      const subjectType: SubjectType = characterMode === 'photo'
        ? (detectedSubjectType || 'human')
        : (formData.characterType && isAnimalType(formData.characterType) ? 'creature' : 'human');

      // For non-human subjects, don't save human-specific fields
      const isHuman = subjectType === 'human';

      const characterData = {
        user_id: user.id,
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

      console.log('Saving character data:', characterData);

      let result;
      if (editingCharacter) {
        // Update existing character
        result = await supabase
          .from('character_library')
          .update(characterData)
          .eq('id', editingCharacter.id)
          .select();

        console.log('Update result:', result);
        if (result.error) throw result.error;
      } else {
        // Insert new character
        result = await supabase
          .from('character_library')
          .insert([characterData])
          .select();

        console.log('Insert result:', result);
        if (result.error) throw result.error;
      }

      // Reload characters
      await loadCharacters(user.id);
      handleCloseForm();
    } catch (error: any) {
      console.error('Error saving character:', error);
      const errorMessage = error?.message || 'Failed to save character. Please try again.';
      alert(`Error: ${errorMessage}\n\nPlease check the browser console for more details.`);
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm('Are you sure you want to delete this character?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('character_library')
        .delete()
        .eq('id', characterId);

      if (error) throw error;

      // Reload characters
      if (user?.id) {
        await loadCharacters(user.id);
      }
    } catch (error) {
      console.error('Error deleting character:', error);
      alert('Failed to delete character. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Character Library</h1>
            <p className="text-gray-600">
              Save and reuse characters across multiple stories
            </p>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            + New Character
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">How Character Library Works</h3>
              <ul className="text-gray-700 space-y-1 text-sm">
                <li>✅ Create characters once, reuse them in multiple stories</li>
                <li>✅ Upload photos and descriptions for consistent illustrations</li>
                <li>✅ Track character usage across your storybooks</li>
                <li>✅ Edit or delete characters anytime</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Character Form Modal */}
        {showNewCharacterForm && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingCharacter ? 'Edit Character' : 'Create New Character'}
                </h2>
                <button
                  onClick={handleCloseForm}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Character Mode Selection - Horizontal with radio circles on left */}
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
                        setPreviewOptions({ pixar: null, classic: null });
                        setSelectedStyle(null);
                        setFormData((prev) => ({ ...prev, animatedPreviewUrl: '', characterType: '' }));
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-left ${
                        characterMode === 'photo'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      {/* Radio circle on left */}
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
                      {/* Radio circle on left */}
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
                      onClick={() => document.getElementById('image-upload-input')?.click()}
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
                        id="image-upload-input"
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

                {/* Character Description Fields - Different layout for each mode */}
                {characterMode === 'photo' ? (
                  // For "From Image" mode: show human fields only if human detected (or not yet detected)
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
                    /* Human or not yet detected: show full human fields */
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
                  /* Description mode: Simplified fields */
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
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                    {sketchError}
                  </div>
                )}

                {/* Character Preview Section - Always show in description mode, conditionally in photo mode */}
                {(characterMode === 'description' || (characterMode === 'photo' && formData.imageUrl)) && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">Character Preview</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      {formData.animatedPreviewUrl && previewOptions.pixar === previewOptions.classic
                        ? 'Compare your reference photo with the saved animated preview.'
                        : 'Generate preview styles to see how your character will appear in stories.'}
                    </p>

                    {/* Generating state */}
                    {generatingPreview ? (
                      <div className="bg-gray-50 rounded-lg p-8 text-center">
                        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-purple-600 font-medium">Generating 2 style options...</p>
                        <p className="text-xs text-gray-400 mt-1">This takes 15-30 seconds</p>
                      </div>
                    ) : formData.animatedPreviewUrl && previewOptions.pixar === previewOptions.classic ? (
                      /* Editing existing character - 2 columns: Left (Sketch or loading) | Right (Saved Animated) */
                      <div className="grid grid-cols-2 gap-4">
                        {/* Left: Simple Sketch (or loading, or reference photo) */}
                        <div className="text-center">
                          <p className="text-sm font-medium text-blue-700 mb-2">
                            {isGeneratingSketch || sketchGuideData ? 'ℹ️ Simple Sketch' : (characterMode === 'photo' ? 'Reference Photo' : 'Character')}
                          </p>

                          {isGeneratingSketch ? (
                            <div className="bg-blue-50 rounded-xl aspect-square flex items-center justify-center border-2 border-blue-300">
                              <div className="text-center">
                                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                                <p className="text-blue-600 font-medium text-sm">Generating sketch...</p>
                                <p className="text-xs text-blue-400 mt-1">~5 seconds</p>
                              </div>
                            </div>
                          ) : sketchGuideData ? (
                            <div className="bg-blue-50 rounded-xl overflow-hidden aspect-square border-2 border-blue-300">
                              <img
                                src={sketchGuideData.guide_image_url}
                                alt="Simple sketch for learning"
                                className="w-full h-full object-contain p-2"
                              />
                            </div>
                          ) : characterMode === 'photo' && formData.imageUrl ? (
                            <div className="bg-gray-50 rounded-xl overflow-hidden aspect-square border border-gray-200">
                              <img
                                src={formData.imageUrl}
                                alt="Reference"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl aspect-square flex items-center justify-center border border-blue-200">
                              <div className="text-center p-4">
                                <div className="text-4xl mb-2">ℹ️</div>
                                <p className="text-sm font-medium text-gray-700">{formData.characterType || 'Character'}</p>
                              </div>
                            </div>
                          )}

                          {sketchGuideData && (
                            <p className="text-xs text-gray-500 mt-1">Learn to draw!</p>
                          )}
                        </div>

                        {/* Right: Saved Animated Preview */}
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-700 mb-2">Animated Preview</p>
                          <div className="bg-purple-50 rounded-xl overflow-hidden aspect-square border-2 border-purple-300">
                            <img
                              src={formData.animatedPreviewUrl}
                              alt="Animated Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (previewOptions.pixar || previewOptions.classic) && previewOptions.pixar !== previewOptions.classic ? (
                      /* Freshly generated - show sketch/reference + both style options in one row */
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-3">Choose your preferred style:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* Box 1: Sketch (description mode) or Reference Photo (photo mode) */}
                          {characterMode === 'description' ? (
                            <div className="text-center">
                              <p className="text-sm font-medium text-blue-700 mb-2">Character</p>
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
                                    key={sketchGuideData.guide_image_url}
                                    src={sketchGuideData.guide_image_url}
                                    alt="Simple sketch"
                                    className="w-full h-full object-contain pointer-events-none"
                                  />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (formData.name && formData.characterType) generateSketchGuide();
                                  }}
                                  disabled={isGeneratingSketch || !formData.name || !formData.characterType}
                                  className="w-full aspect-square border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl flex items-center justify-center bg-gray-50 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <div className="text-center p-4">
                                    <div className="text-4xl mb-2">✏️</div>
                                    <p className="text-sm font-bold text-gray-900 mb-1">{formData.characterType || 'Character'}</p>
                                    <p className="text-xs text-blue-600 font-medium">Click to Generate Sketch</p>
                                  </div>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="text-sm font-medium text-gray-700 mb-2">Reference Photo</p>
                              <div className="bg-gray-50 rounded-xl overflow-hidden aspect-square border border-gray-200">
                                <img
                                  src={formData.imageUrl}
                                  alt="Reference"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          )}

                          {/* Box 2: 3D Pixar Option */}
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

                          {/* Box 3: Classic Storybook Option */}
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
                      /* Initial state - 2 clickable boxes: Left (Sketch) | Right (Animated Preview) */
                      <div className="grid grid-cols-2 gap-4">
                        {/* Left: Simple Sketch - CLICKABLE */}
                        <div className="text-center">
                          <p className="text-sm font-medium text-blue-700 mb-2">
                            {isGeneratingSketch || sketchGuideData ? 'ℹ️ Simple Sketch' : 'Simple Sketch'}
                          </p>

                          {/* Loading state while generating sketch */}
                          {isGeneratingSketch ? (
                            <div className="bg-blue-50 rounded-xl aspect-square flex items-center justify-center border-2 border-blue-300">
                              <div className="text-center">
                                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                                <p className="text-blue-600 font-medium text-sm">Generating sketch...</p>
                                <p className="text-xs text-blue-400 mt-1">~5 seconds</p>
                              </div>
                            </div>
                          ) : sketchGuideData ? (
                            /* Sketch generated - clickable to regenerate */
                            <button
                              type="button"
                              onClick={() => generateSketchGuide()}
                              className="w-full aspect-square border-2 border-gray-300 hover:border-blue-400 rounded-xl p-4 bg-white transition-colors cursor-pointer"
                            >
                              <img
                                key={sketchGuideData.guide_image_url}
                                src={sketchGuideData.guide_image_url}
                                alt="Simple sketch for learning"
                                className="w-full h-full object-contain pointer-events-none"
                              />
                            </button>
                          ) : (
                            /* No sketch yet - clickable to generate */
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

                          {sketchGuideData && (
                            <p className="text-xs text-gray-500 mt-1">Learn to draw!</p>
                          )}
                          {sketchError && (
                            <p className="text-xs text-red-600 mt-1">{sketchError}</p>
                          )}
                        </div>

                        {/* Right: Animated Preview - CLICKABLE */}
                        <div className="text-center">
                          <p className="text-sm font-medium text-purple-700 mb-2">Animated Preview</p>

                          {generatingPreview ? (
                            /* Loading state */
                            <div className="bg-purple-50 rounded-xl aspect-square flex items-center justify-center border-2 border-purple-300">
                              <div className="text-center">
                                <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
                                <p className="text-purple-600 font-medium text-sm">Generating styles...</p>
                                <p className="text-xs text-purple-400 mt-1">~10 seconds</p>
                              </div>
                            </div>
                          ) : (
                            /* CLICKABLE BOX to generate or regenerate */
                            <button
                              type="button"
                              onClick={handleGeneratePreview}
                              disabled={generatingPreview || (characterMode === 'photo' ? !formData.imageUrl : !formData.characterType)}
                              className="bg-gradient-to-br from-purple-50 to-amber-50 rounded-xl aspect-square flex items-center justify-center border-2 border-dashed border-purple-300 hover:border-purple-500 hover:from-purple-100 hover:to-amber-100 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group w-full"
                            >
                              <div className="text-center p-4">
                                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">✨</div>
                                <p className="text-base font-bold text-gray-900 mb-2">
                                  {(previewOptions.pixar || previewOptions.classic) ? 'Preview Styles' : 'Preview Styles'}
                                </p>
                                <p className="text-sm text-purple-600 font-bold group-hover:text-purple-700">
                                  {(previewOptions.pixar || previewOptions.classic) ? 'Click to Regenerate' : 'Click to Generate'}
                                </p>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Preview Error */}
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
                  onClick={handleCloseForm}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCharacter}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
                >
                  {editingCharacter ? 'Update Character' : 'Save Character'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Characters Grid */}
        {characters.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">👦👧</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Characters Yet
            </h2>
            <p className="text-gray-600 mb-6">
              Click "New Character" above or create your first story to start building your character library!
            </p>
            <Link
              href="/create"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Create a Story
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {characters.map((character) => (
              <div
                key={character.id}
                className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1"
              >
                {/* Character Image - show animated preview if available */}
                {character.referenceImage.url || character.animatedPreviewUrl ? (
                  <div className="relative h-56 bg-gradient-to-br from-blue-100 to-purple-100">
                    <img
                      src={character.animatedPreviewUrl || character.referenceImage.url}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                    {character.animatedPreviewUrl && (
                      <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Preview
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-56 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <div className="text-6xl">👤</div>
                  </div>
                )}

                {/* Character Info */}
                <div className="p-3">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {character.name}
                  </h3>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href="/create"
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm text-center"
                    >
                      Use in Story
                    </Link>
                    <button
                      onClick={() => handleOpenForm(character)}
                      className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 font-medium text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCharacter(character.id)}
                      className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 font-medium text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
