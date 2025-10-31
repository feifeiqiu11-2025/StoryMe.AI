/**
 * Create New Artist Profile Page
 * Form for parents to create a little artist profile
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewArtistPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      setProfilePhoto(file);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload photo');
    }

    const data = await response.json();
    return data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Artist name is required');
      return;
    }

    if (age && (parseInt(age) < 3 || parseInt(age) > 18)) {
      setError('Age must be between 3 and 18');
      return;
    }

    setLoading(true);

    try {
      // Upload profile photo if provided
      let profilePhotoUrl = null;
      if (profilePhoto) {
        setUploadingPhoto(true);
        profilePhotoUrl = await uploadPhoto(profilePhoto);
        setUploadingPhoto(false);
      }

      // Create artist profile
      const response = await fetch('/api/little-artists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          age: age ? parseInt(age) : undefined,
          bio: bio.trim() || undefined,
          profile_photo_url: profilePhotoUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create artist');
      }

      const data = await response.json();
      console.log('Artist created:', data);

      // Redirect to artist management page
      router.push(`/my-artists/${data.artist.id}`);
    } catch (err) {
      console.error('Error creating artist:', err);
      setError(err instanceof Error ? err.message : 'Failed to create artist');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Little Artist Profile</h1>
        <p className="text-gray-600">
          Set up a profile for your young artist to share their creative work
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        {/* Artist Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Artist Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Emma"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            We recommend using first name only for privacy
          </p>
        </div>

        {/* Age */}
        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
            Age (Optional)
          </label>
          <input
            id="age"
            type="number"
            min="3"
            max="18"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g., 7"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Must be between 3 and 18 years old
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
            Bio (Optional)
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="e.g., Loves drawing dragons and princesses"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Share a little about your young artist's interests
          </p>
        </div>

        {/* Profile Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Profile Photo (Optional)
          </label>

          {profilePhotoPreview ? (
            <div className="relative">
              <img
                src={profilePhotoPreview}
                alt="Profile preview"
                className="w-48 h-48 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  setProfilePhoto(null);
                  setProfilePhotoPreview(null);
                }}
                className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
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
                id="photo-upload"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center">
                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-600">Click to upload photo</span>
                <span className="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP (max 10MB)</span>
              </label>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">
            ⚠️ Privacy Note: Only upload photos you have permission to share publicly
          </p>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-xl">🔒</div>
            <div className="flex-1 text-sm">
              <h4 className="font-semibold text-gray-900 mb-1">Privacy & Safety</h4>
              <p className="text-gray-700">
                This profile will start as <strong>private (draft)</strong>. Before it can be published to the community:
              </p>
              <ul className="list-disc ml-5 mt-2 text-gray-700 space-y-1">
                <li>You'll need to provide explicit consent</li>
                <li>Our team will review the profile</li>
                <li>You can unpublish or archive at any time</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{error}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/my-artists"
            className="flex-1 text-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || uploadingPhoto}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (uploadingPhoto ? 'Uploading Photo...' : 'Creating...') : 'Create Artist Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
