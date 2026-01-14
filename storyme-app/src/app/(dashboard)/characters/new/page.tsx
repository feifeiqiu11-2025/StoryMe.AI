/**
 * Character creation page with animated preview
 *
 * Supports TWO modes:
 * 1. Photo-based: Upload photo → GPT-4V analyzes → fills description → Gemini generates animated version
 * 2. Description-only: Enter character type (e.g., "baby eagle") → Gemini generates from description
 *
 * Both modes support 2D Classic and 3D Pixar styles.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type PreviewStatus = 'idle' | 'generating' | 'ready' | 'error';
type CharacterMode = 'photo' | 'description';
type SelectedStyle = 'pixar' | 'classic';

export default function NewCharacterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Character mode: photo-based or description-only
  const [characterMode, setCharacterMode] = useState<CharacterMode>('photo');

  // Photo-based mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [characterType, setCharacterType] = useState(''); // For description-only mode
  const [hairColor, setHairColor] = useState('');
  const [skinTone, setSkinTone] = useState('');
  const [clothing, setClothing] = useState('');
  const [age, setAge] = useState('');
  const [otherFeatures, setOtherFeatures] = useState('');

  // Preview state - now supports BOTH styles
  const [pixarPreviewUrl, setPixarPreviewUrl] = useState<string | null>(null);
  const [classicPreviewUrl, setClassicPreviewUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<SelectedStyle>('pixar');
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [descriptionChanged, setDescriptionChanged] = useState(false);

  // Track if we should auto-generate preview
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image must be less than 10MB');
        return;
      }

      // Validate file type
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Image must be JPEG, PNG, or WebP format');
        return;
      }

      setImageFile(file);
      setError(null);
      setPixarPreviewUrl(null);
      setClassicPreviewUrl(null);
      setPreviewStatus('idle');
      setIsApproved(false);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto-analyze image immediately after selection
      autoAnalyzeImage(file);
    }
  };

  const autoAnalyzeImage = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Upload image first
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const uploadData = await uploadResponse.json();
      setUploadedImageUrl(uploadData.url);

      console.log('Analyzing character image:', uploadData.url);

      // Analyze the uploaded image using unified Gemini API
      const analysisResponse = await fetch('/api/analyze-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: uploadData.url }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        console.log('Character analysis successful:', analysisData);

        if (analysisData.success) {
          if (analysisData.subjectType === 'human' && analysisData.humanDetails) {
            // Human detected: use structured fields
            const details = analysisData.humanDetails;
            const otherFeatures = [details.gender, details.otherFeatures]
              .filter(Boolean)
              .join(', ');

            setHairColor(details.hairColor || '');
            setSkinTone(details.skinTone || '');
            setClothing(details.clothing || '');
            setAge(details.age || '');
            setOtherFeatures(otherFeatures || '');
          } else {
            // Non-human detected: clear human fields, use description
            setHairColor('');
            setSkinTone('');
            setClothing('');
            setAge('');
            setOtherFeatures(analysisData.briefDescription || '');
          }

          // Trigger auto-generation of preview after analysis
          setShouldAutoGenerate(true);
        }
      } else {
        const errorData = await analysisResponse.json();
        console.error('Image analysis failed:', errorData);
        // User can fill in manually
      }
    } catch (analysisError: unknown) {
      console.error('Auto-analysis error:', analysisError);
      // Fail silently - user can fill in manually
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-generate preview when conditions are met
  useEffect(() => {
    if (shouldAutoGenerate && uploadedImageUrl && name.trim()) {
      setShouldAutoGenerate(false);
      generatePreview();
    }
  }, [shouldAutoGenerate, uploadedImageUrl, name]);

  // Generate animated preview (both styles)
  const generatePreview = useCallback(async () => {
    // Validate based on mode
    if (characterMode === 'photo') {
      if (!uploadedImageUrl || !name.trim()) {
        setPreviewError('Please provide a name and upload an image first');
        return;
      }
    } else {
      if (!name.trim() || !characterType.trim()) {
        setPreviewError('Please provide a name and character type');
        return;
      }
    }

    setPreviewStatus('generating');
    setPreviewError(null);
    setDescriptionChanged(false);
    setPixarPreviewUrl(null);
    setClassicPreviewUrl(null);

    try {
      const requestBody = characterMode === 'photo'
        ? {
            name: name.trim(),
            referenceImageUrl: uploadedImageUrl,
            description: {
              hairColor,
              skinTone,
              age,
              otherFeatures,
            },
          }
        : {
            name: name.trim(),
            characterType: characterType.trim(),
            description: {
              hairColor,
              age,
              otherFeatures,
            },
          };

      const response = await fetch('/api/generate-character-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      const data = await response.json();
      console.log('Previews generated:', data);

      // Set both style previews
      if (data.previews?.pixar) {
        setPixarPreviewUrl(data.previews.pixar.imageUrl);
      }
      if (data.previews?.classic) {
        setClassicPreviewUrl(data.previews.classic.imageUrl);
      }

      setPreviewStatus('ready');
    } catch (err) {
      console.error('Preview generation error:', err);
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate preview');
      setPreviewStatus('error');
    }
  }, [characterMode, uploadedImageUrl, name, characterType, hairColor, skinTone, age, otherFeatures]);

  // Track description changes
  const handleDescriptionChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    if (previewStatus === 'ready') {
      setDescriptionChanged(true);
      setIsApproved(false);
    }
  };

  // Get the currently selected preview URL
  const getSelectedPreviewUrl = () => {
    return selectedStyle === 'pixar' ? pixarPreviewUrl : classicPreviewUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation - need approved preview
    if (!isApproved) {
      setError('Please approve the animated preview before saving');
      return;
    }

    // Validation for description-only mode
    if (characterMode === 'description' && !characterType.trim()) {
      setError('Please provide a character type (e.g., baby eagle, friendly dragon)');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in to create a character');
        setLoading(false);
        return;
      }

      let imageUrl = uploadedImageUrl;
      let imageFilename = imageFile?.name || null;

      // If image wasn't auto-analyzed (edge case), upload it now
      if (characterMode === 'photo' && imageFile && !uploadedImageUrl) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('character-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          setError(`Failed to upload image: ${uploadError.message}`);
          setLoading(false);
          return;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('character-images')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
        imageFilename = imageFile.name;
      }

      // Get the selected preview URL
      const selectedPreviewUrl = getSelectedPreviewUrl();

      // Upload animated preview to storage (convert from data URL to blob)
      let animatedUrl = selectedPreviewUrl;
      if (selectedPreviewUrl && selectedPreviewUrl.startsWith('data:')) {
        try {
          const response = await fetch(selectedPreviewUrl);
          const blob = await response.blob();
          const previewFileName = `${user.id}/preview-${Date.now()}.png`;

          const { error: previewUploadError } = await supabase.storage
            .from('character-images')
            .upload(previewFileName, blob, {
              contentType: 'image/png',
            });

          if (!previewUploadError) {
            const { data: previewUrlData } = supabase.storage
              .from('character-images')
              .getPublicUrl(previewFileName);
            animatedUrl = previewUrlData.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Failed to upload animated preview, saving without it:', uploadErr);
        }
      }

      // Build description for description-only mode
      const fullDescription = characterMode === 'description'
        ? `${characterType}${otherFeatures ? ` - ${otherFeatures}` : ''}`
        : undefined;

      // Create character via API
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          hair_color: hairColor || undefined,
          skin_tone: skinTone || undefined,
          clothing: clothing || undefined,
          age: age || undefined,
          other_features: characterMode === 'description' ? fullDescription : (otherFeatures || undefined),
          reference_image_url: imageUrl || undefined,
          reference_image_filename: imageFilename || undefined,
          animated_preview_url: animatedUrl,
          illustration_style: selectedStyle, // Save the selected style preference
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create character');
        setLoading(false);
        return;
      }

      // Success - redirect to character library
      router.push('/characters');
      router.refresh();
    } catch (err) {
      console.error('Error creating character:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  // Reset form when switching modes
  const handleModeChange = (mode: CharacterMode) => {
    setCharacterMode(mode);
    setImageFile(null);
    setImagePreview(null);
    setUploadedImageUrl(null);
    setPixarPreviewUrl(null);
    setClassicPreviewUrl(null);
    setPreviewStatus('idle');
    setIsApproved(false);
    setHairColor('');
    setSkinTone('');
    setClothing('');
    setAge('');
    setOtherFeatures('');
    setCharacterType('');
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Character</h1>
        <p className="mt-2 text-gray-600">
          Add a character to your library to use in multiple stories
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Character Mode Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Character Type</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleModeChange('photo')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                characterMode === 'photo'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  characterMode === 'photo' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">From Photo</div>
                  <div className="text-sm text-gray-500">Upload a photo to create animated version</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('description')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                characterMode === 'description'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  characterMode === 'description' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">From Description</div>
                  <div className="text-sm text-gray-500">Generate animals, creatures, or fantasy characters</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Character Name */}
        <div className="bg-white rounded-lg shadow p-6">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Character Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (characterMode === 'photo' && uploadedImageUrl && !pixarPreviewUrl && e.target.value.trim()) {
                setShouldAutoGenerate(true);
              }
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={characterMode === 'photo' ? 'e.g., Connor' : 'e.g., Eddie the Eagle'}
          />
        </div>

        {/* Character Type (Description mode only) */}
        {characterMode === 'description' && (
          <div className="bg-white rounded-lg shadow p-6">
            <label htmlFor="characterType" className="block text-sm font-medium text-gray-700 mb-1">
              Character Type <span className="text-red-500">*</span>
            </label>
            <input
              id="characterType"
              type="text"
              value={characterType}
              onChange={(e) => {
                setCharacterType(e.target.value);
                if (previewStatus === 'ready') {
                  setDescriptionChanged(true);
                  setIsApproved(false);
                }
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g., baby eagle, friendly dragon, talking cat, wise owl"
            />
            <p className="mt-2 text-sm text-gray-500">
              Describe what kind of character this is. Examples: &quot;baby eagle with fluffy feathers&quot;, &quot;friendly red dragon&quot;, &quot;curious bunny rabbit&quot;
            </p>
          </div>
        )}

        {/* Photo Upload Section (Photo mode only) */}
        {characterMode === 'photo' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Reference Photo
              {isAnalyzing && (
                <span className="ml-2 text-sm text-purple-600 font-normal">
                  AI analyzing...
                </span>
              )}
            </h2>

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Reference photo"
                  className="w-full max-w-md h-64 object-contain rounded-lg bg-gray-50 border border-gray-200 mx-auto"
                />
                {isAnalyzing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
                      <span className="text-sm text-purple-600 font-medium">AI analyzing photo...</span>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setUploadedImageUrl(null);
                    setPixarPreviewUrl(null);
                    setClassicPreviewUrl(null);
                    setPreviewStatus('idle');
                    setIsApproved(false);
                  }}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                  disabled={isAnalyzing}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center">
                  <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-600">Click to upload a photo</span>
                  <span className="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP (max 10MB)</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Preview Section - Shows both styles side by side */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Animated Preview
          </h2>

          {/* Generate Button (for description mode or manual generation) */}
          {previewStatus === 'idle' && (
            <div className="text-center py-8">
              {characterMode === 'description' ? (
                <div className="space-y-4">
                  <div className="text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <p className="text-sm">Enter a name and character type, then generate preview</p>
                  </div>
                  <button
                    type="button"
                    onClick={generatePreview}
                    disabled={!name.trim() || !characterType.trim()}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Generate Preview
                  </button>
                </div>
              ) : (
                <div className="text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Upload a photo to see the animated preview</p>
                </div>
              )}
            </div>
          )}

          {/* Generating state */}
          {previewStatus === 'generating' && (
            <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg">
              <div className="w-12 h-12 border-3 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-purple-600 font-medium">Creating animated versions...</p>
              <p className="text-sm text-purple-500 mt-1">Generating both 3D and 2D styles (15-30 seconds)</p>
            </div>
          )}

          {/* Preview ready - show both styles */}
          {previewStatus === 'ready' && (pixarPreviewUrl || classicPreviewUrl) && (
            <div className="space-y-4">
              {/* Style selection tabs */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSelectedStyle('pixar')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all ${
                    selectedStyle === 'pixar'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  3D Pixar Style
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStyle('classic')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all ${
                    selectedStyle === 'classic'
                      ? 'bg-white text-amber-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  2D Classic Style
                </button>
              </div>

              {/* Side by side comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* 3D Pixar Preview */}
                <div
                  className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedStyle === 'pixar' ? 'ring-2 ring-purple-500 ring-offset-2' : 'opacity-70 hover:opacity-100'
                  }`}
                  onClick={() => setSelectedStyle('pixar')}
                >
                  <div className="aspect-square bg-gray-100">
                    {pixarPreviewUrl ? (
                      <img
                        src={pixarPreviewUrl}
                        alt="3D Pixar style preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span className="text-sm">Not available</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    3D Pixar
                  </div>
                  {selectedStyle === 'pixar' && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* 2D Classic Preview */}
                <div
                  className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedStyle === 'classic' ? 'ring-2 ring-amber-500 ring-offset-2' : 'opacity-70 hover:opacity-100'
                  }`}
                  onClick={() => setSelectedStyle('classic')}
                >
                  <div className="aspect-square bg-gray-100">
                    {classicPreviewUrl ? (
                      <img
                        src={classicPreviewUrl}
                        alt="2D Classic style preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span className="text-sm">Not available</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    2D Classic
                  </div>
                  {selectedStyle === 'classic' && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {!isApproved ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsApproved(true)}
                      className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve {selectedStyle === 'pixar' ? '3D' : '2D'} Style
                    </button>
                    <button
                      type="button"
                      onClick={generatePreview}
                      className="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 font-medium flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate Both
                    </button>
                  </>
                ) : descriptionChanged ? (
                  <button
                    type="button"
                    onClick={generatePreview}
                    className="w-full bg-yellow-500 text-white px-4 py-3 rounded-lg hover:bg-yellow-600 font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Description changed - Regenerate Previews
                  </button>
                ) : (
                  <div className="w-full text-center py-3 bg-green-50 rounded-lg">
                    <p className="text-green-600 font-medium flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {selectedStyle === 'pixar' ? '3D Pixar' : '2D Classic'} style approved! Ready to save.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error state */}
          {previewStatus === 'error' && (
            <div className="text-center py-8 bg-red-50 rounded-lg">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 font-medium">{previewError || 'Failed to generate preview'}</p>
              <button
                type="button"
                onClick={generatePreview}
                className="mt-3 text-red-600 hover:text-red-800 underline font-medium"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Description Fields (Photo mode) */}
        {characterMode === 'photo' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Character Description
              <span className="text-sm font-normal text-gray-500 ml-2">
                (Auto-filled from photo analysis)
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="hairColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Hair Color
                </label>
                <input
                  id="hairColor"
                  type="text"
                  value={hairColor}
                  onChange={handleDescriptionChange(setHairColor)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Brown, Blonde"
                />
              </div>

              <div>
                <label htmlFor="skinTone" className="block text-sm font-medium text-gray-700 mb-1">
                  Skin Tone
                </label>
                <input
                  id="skinTone"
                  type="text"
                  value={skinTone}
                  onChange={handleDescriptionChange(setSkinTone)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Fair, Tan"
                />
              </div>

              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  id="age"
                  type="text"
                  value={age}
                  onChange={handleDescriptionChange(setAge)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 5 years old, Child"
                />
              </div>

              <div>
                <label htmlFor="clothing" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Clothing
                </label>
                <input
                  id="clothing"
                  type="text"
                  value={clothing}
                  onChange={handleDescriptionChange(setClothing)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Blue t-shirt and jeans"
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="otherFeatures" className="block text-sm font-medium text-gray-700 mb-1">
                Other Features
              </label>
              <textarea
                id="otherFeatures"
                value={otherFeatures}
                onChange={handleDescriptionChange(setOtherFeatures)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Big smile, freckles, glasses"
              />
            </div>
          </div>
        )}

        {/* Additional Description (Description mode) */}
        {characterMode === 'description' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Additional Details
              <span className="text-sm font-normal text-gray-500 ml-2">
                (Optional - helps refine the character)
              </span>
            </h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="otherFeatures" className="block text-sm font-medium text-gray-700 mb-1">
                  Character Details
                </label>
                <textarea
                  id="otherFeatures"
                  value={otherFeatures}
                  onChange={handleDescriptionChange(setOtherFeatures)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., fluffy golden feathers, big curious eyes, wearing a tiny red scarf"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Add any specific features, colors, or accessories for your character
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !isApproved}
            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Saving...' : isApproved ? 'Save Character' : 'Approve Preview First'}
          </button>
        </div>
      </form>
    </div>
  );
}
