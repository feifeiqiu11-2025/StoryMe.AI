/**
 * Character Edit Form Component
 * Client component for editing character information
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CharacterLibrary } from '@/lib/types/database';

interface CharacterEditFormProps {
  character: CharacterLibrary;
}

export default function CharacterEditForm({ character }: CharacterEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    character.reference_image_url || null
  );

  // Form fields - initialize with existing data
  const [name, setName] = useState(character.name);
  const [hairColor, setHairColor] = useState(character.hair_color || '');
  const [skinTone, setSkinTone] = useState(character.skin_tone || '');
  const [clothing, setClothing] = useState(character.clothing || '');
  const [age, setAge] = useState(character.age || '');
  const [otherFeatures, setOtherFeatures] = useState(character.other_features || '');

  // Animated preview state
  const [animatedPreviewUrl, setAnimatedPreviewUrl] = useState<string | null>(
    character.animated_preview_url || null
  );
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>(
    character.animated_preview_url ? 'ready' : 'idle'
  );
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Track if description changed (to prompt regeneration)
  const [descriptionChanged, setDescriptionChanged] = useState(false);

  // Check if description has changed from original
  useEffect(() => {
    const hasChanged =
      hairColor !== (character.hair_color || '') ||
      skinTone !== (character.skin_tone || '') ||
      clothing !== (character.clothing || '') ||
      age !== (character.age || '') ||
      otherFeatures !== (character.other_features || '') ||
      imageFile !== null;
    setDescriptionChanged(hasChanged);
  }, [hairColor, skinTone, clothing, age, otherFeatures, imageFile, character]);

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

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate animated preview
  const generatePreview = async () => {
    const referenceUrl = imagePreview;
    if (!referenceUrl || !name) {
      setPreviewError('Name and reference image are required');
      return;
    }

    setPreviewStatus('generating');
    setPreviewError(null);

    try {
      const response = await fetch('/api/generate-character-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          referenceImageUrl: referenceUrl,
          description: {
            hairColor,
            skinTone,
            clothing,
            age,
            otherFeatures,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      const data = await response.json();
      // API returns { success, preview: { imageUrl, generationTime } }
      const imageUrl = data.preview?.imageUrl || data.imageUrl;
      setAnimatedPreviewUrl(imageUrl);
      setPreviewStatus('ready');
      setDescriptionChanged(false);
    } catch (err: any) {
      console.error('Preview generation error:', err);
      setPreviewError(err.message || 'Failed to generate preview');
      setPreviewStatus('error');
    }
  };

  // Upload animated preview to Supabase storage
  const uploadPreviewToStorage = async (dataUrl: string, userId: string): Promise<string> => {
    const supabase = createClient();

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create file path
    const fileName = `${userId}/animated-preview-${Date.now()}.png`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('character-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload preview: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('character-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation - at least one description field is required
    if (!hairColor && !skinTone && !clothing && !age && !otherFeatures) {
      setError('Please provide at least one character description (hair color, clothing, or age)');
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
        setError('You must be logged in to update a character');
        setLoading(false);
        return;
      }

      let imageUrl = character.reference_image_url;
      let imageFilename = character.reference_image_filename;

      // Upload new image if provided
      if (imageFile) {
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

      // Upload animated preview if it's a new data URL (not already a public URL)
      let finalPreviewUrl = animatedPreviewUrl;
      if (animatedPreviewUrl && animatedPreviewUrl.startsWith('data:')) {
        finalPreviewUrl = await uploadPreviewToStorage(animatedPreviewUrl, user.id);
      }

      // Update character via API
      const response = await fetch(`/api/characters/${character.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          hair_color: hairColor || undefined,
          skin_tone: skinTone || undefined,
          clothing: clothing || undefined,
          age: age || undefined,
          other_features: otherFeatures || undefined,
          reference_image_url: imageUrl,
          reference_image_filename: imageFilename,
          animated_preview_url: finalPreviewUrl || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update character');
        setLoading(false);
        return;
      }

      // Success - redirect to character detail
      router.push(`/characters/${character.id}`);
      router.refresh();
    } catch (err) {
      console.error('Error updating character:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Character Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Character Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Connor"
        />
      </div>

      {/* Reference Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reference Photo
        </label>

        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-64 object-contain rounded-lg bg-gray-50"
            />
            <button
              type="button"
              onClick={() => {
                setImageFile(null);
                setImagePreview(null);
              }}
              className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
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
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                className="w-12 h-12 text-gray-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm text-gray-600">
                Click to upload or drag and drop
              </span>
              <span className="text-xs text-gray-500 mt-1">
                JPEG, PNG, or WebP (max 10MB)
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Description Fields */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Character Description
          <span className="text-sm font-normal text-gray-500 ml-2">
            (Fill in at least one field)
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
              onChange={(e) => setHairColor(e.target.value)}
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
              onChange={(e) => setSkinTone(e.target.value)}
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
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 5 years old, Child"
            />
          </div>

          <div>
            <label htmlFor="clothing" className="block text-sm font-medium text-gray-700 mb-1">
              Typical Clothing
            </label>
            <input
              id="clothing"
              type="text"
              value={clothing}
              onChange={(e) => setClothing(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Blue t-shirt and jeans"
            />
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="otherFeatures"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Other Features
          </label>
          <textarea
            id="otherFeatures"
            value={otherFeatures}
            onChange={(e) => setOtherFeatures(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Big smile, freckles, glasses"
          />
        </div>
      </div>

      {/* Animated Preview Section */}
      {imagePreview && (
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              3D Character Preview
            </h3>
            {descriptionChanged && animatedPreviewUrl && (
              <span className="text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">
                Description changed - consider regenerating
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Generate a 3D Pixar-style preview to see how your character will appear in stories.
          </p>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Reference Photo */}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 mb-2">Reference Photo</p>
              <div className="bg-gray-50 rounded-lg overflow-hidden" style={{ height: '200px' }}>
                <img
                  src={imagePreview}
                  alt="Reference"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Animated Preview */}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 mb-2">3D Preview</p>
              <div className="bg-gray-50 rounded-lg overflow-hidden relative" style={{ height: '200px' }}>
                {previewStatus === 'generating' ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-10 h-10 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-purple-600">Generating preview...</p>
                      <p className="text-xs text-gray-400 mt-1">This may take 15-30 seconds</p>
                    </div>
                  </div>
                ) : animatedPreviewUrl ? (
                  <>
                    <img
                      src={animatedPreviewUrl}
                      alt="3D Preview"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                      3D
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">No preview yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Generate/Regenerate Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generatePreview}
              disabled={previewStatus === 'generating' || !name || !imagePreview}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {previewStatus === 'generating'
                ? 'Generating...'
                : animatedPreviewUrl
                  ? 'Regenerate Preview'
                  : 'Generate 3D Preview'}
            </button>
            {!name && (
              <span className="text-sm text-gray-500">Enter name first</span>
            )}
          </div>

          {/* Preview Error */}
          {previewError && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {previewError}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
