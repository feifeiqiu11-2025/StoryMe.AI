/**
 * Character Edit Form Component
 * Client component for editing character information
 */

'use client';

import { useState } from 'react';
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
