/**
 * Upload Artwork & Transform Page
 * Upload sketch and transform it to animated character
 */

'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LittleArtist, TRANSFORMATION_STYLES, TransformationStyle } from '@/lib/types/artist';

export default function UploadArtworkPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [artist, setArtist] = useState<LittleArtist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [sketchPreview, setSketchPreview] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<TransformationStyle>('sketch-to-character');
  const [enableAiTransform, setEnableAiTransform] = useState(true); // AI transform checkbox (default: checked)
  const [shareToLibrary, setShareToLibrary] = useState(false); // Share to library checkbox (default: unchecked)

  // Upload & transformation state
  const [uploading, setUploading] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [transformedImageUrl, setTransformedImageUrl] = useState<string | null>(null);
  const [artworkId, setArtworkId] = useState<string | null>(null);

  useEffect(() => {
    loadArtist();
  }, [id]);

  const loadArtist = async () => {
    try {
      const response = await fetch(`/api/little-artists/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load artist');
      }

      const data = await response.json();
      setArtist(data.artist);
    } catch (err) {
      console.error('Error loading artist:', err);
      setError(err instanceof Error ? err.message : 'Failed to load artist');
    } finally {
      setLoading(false);
    }
  };

  const handleSketchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      setSketchFile(file);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setSketchPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAndTransform = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sketchFile) {
      setError('Please select a sketch to upload');
      return;
    }

    if (!characterName.trim()) {
      setError('Please provide a character name');
      return;
    }

    setUploading(true);

    try {
      // Step 1: Upload sketch
      console.log('Step 1: Uploading sketch...');
      const formData = new FormData();
      formData.append('file', sketchFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload sketch');
      }

      const uploadData = await uploadResponse.json();
      const sketchUrl = uploadData.url;
      console.log('✓ Sketch uploaded:', sketchUrl);

      // Step 2: Create artwork record
      console.log('Step 2: Creating artwork record...');
      const artworkResponse = await fetch(`/api/little-artists/${id}/artworks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          original_sketch_url: sketchUrl,
          original_sketch_filename: sketchFile.name,
          character_name: characterName.trim(),
          transformation_style: selectedStyle,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          share_to_library: shareToLibrary, // Pass the share to library flag
        }),
      });

      if (!artworkResponse.ok) {
        const errorData = await artworkResponse.json();
        throw new Error(errorData.error || 'Failed to create artwork');
      }

      const artworkData = await artworkResponse.json();
      const newArtworkId = artworkData.artwork.id;
      setArtworkId(newArtworkId);
      console.log('✓ Artwork created:', newArtworkId);

      setUploading(false);

      // Step 3: Transform sketch with AI (if enabled)
      if (enableAiTransform) {
        setTransforming(true);
        console.log('Step 3: Transforming sketch with AI...');
        console.log('This will take 30-60 seconds...');

        const transformResponse = await fetch('/api/transform-sketch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            artworkId: newArtworkId,
            imageUrl: sketchUrl,
            characterName: characterName.trim(),
            style: selectedStyle,
          }),
        });

        if (!transformResponse.ok) {
          const errorData = await transformResponse.json();
          throw new Error(errorData.error || 'Failed to transform sketch');
        }

        const transformData = await transformResponse.json();
        setTransformedImageUrl(transformData.transformedImageUrl);
        console.log('✓ Transformation complete!');

        alert('Sketch transformed successfully! 🎉');
      } else {
        console.log('✓ Sketch uploaded (AI transformation skipped)');
        alert('Sketch uploaded successfully! 🎉');
      }

      // Redirect to my-artists page after success
      router.push('/my-artists');

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setUploading(false);
      setTransforming(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error && !artist) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
          <div className="text-gray-700">{error}</div>
          <Link href="/my-artists" className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Back to My Artists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back Button */}
      <Link href="/my-artists" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to My Artists
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Upload & Transform Artwork</h1>
        <p className="text-sm text-gray-600">
          Upload {artist?.name}'s sketch and watch AI transform it into an animated character!
        </p>
      </div>

      <form onSubmit={handleUploadAndTransform} className="space-y-6">
        {/* Upload Sketch */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">1. Upload Sketch</h2>

          {sketchPreview ? (
            <div className="relative">
              <img
                src={sketchPreview}
                alt="Sketch preview"
                className="w-full max-w-md mx-auto rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  setSketchFile(null);
                  setSketchPreview(null);
                }}
                className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                id="sketch-upload"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleSketchChange}
                className="hidden"
                disabled={uploading || transforming}
              />
              <label htmlFor="sketch-upload" className="cursor-pointer flex flex-col items-center">
                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-base text-gray-700 font-semibold mb-1">Click to upload sketch</span>
                <span className="text-xs text-gray-500">JPEG, PNG, or WebP (max 10MB)</span>
              </label>
            </div>
          )}
        </div>

        {/* Character Details */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">2. Character Details</h2>

          <div className="space-y-3">
            <div>
              <label htmlFor="characterName" className="block text-sm font-medium text-gray-700 mb-1">
                Character Name <span className="text-red-500">*</span>
              </label>
              <input
                id="characterName"
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                required
                placeholder="e.g., Dragon Max, Princess Luna"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={uploading || transforming}
              />
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Artwork Title (Optional)
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., My Dragon Drawing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={uploading || transforming}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Tell us about this character..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={uploading || transforming}
              />
            </div>
          </div>
        </div>

        {/* Style Selection */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">3. Choose Transformation Style</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TRANSFORMATION_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => setSelectedStyle(style.value)}
                disabled={uploading || transforming || !enableAiTransform}
                className={`p-3 border-2 rounded-lg text-left transition-all ${
                  !enableAiTransform
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : selectedStyle === style.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="text-2xl">{style.emoji}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{style.label}</h3>
                    <p className="text-xs text-gray-600">{style.description}</p>
                  </div>
                  {selectedStyle === style.value && enableAiTransform && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upload Options */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">4. Upload Options</h2>

          <div className="space-y-3">
            {/* AI Transform Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableAiTransform}
                onChange={(e) => setEnableAiTransform(e.target.checked)}
                disabled={uploading || transforming}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">Transform with AI</span>
                <p className="text-xs text-gray-600 mt-0.5">
                  Enable AI transformation to convert the sketch into an animated character. If unchecked, only the original sketch will be uploaded.
                </p>
              </div>
            </label>

            {/* Share to Library Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareToLibrary}
                onChange={(e) => setShareToLibrary(e.target.checked)}
                disabled={uploading || transforming}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">Share to Character Library</span>
                <p className="text-xs text-gray-600 mt-0.5">
                  Make this character available in the community character library after parent approval and publishing. If unchecked, artwork will only appear in your artist's gallery.
                </p>
              </div>
            </label>
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

        {/* Submit Button */}
        <div className="flex gap-3">
          <Link
            href={`/my-artists/${id}`}
            className="flex-1 text-center px-6 py-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!sketchFile || uploading || transforming}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              'Uploading Sketch...'
            ) : transforming ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Transforming... (30-60 sec)
              </span>
            ) : (
              'Upload & Transform ✨'
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-xl">ℹ️</div>
            <div className="flex-1 text-sm text-gray-700">
              <h4 className="font-semibold mb-1">How it works:</h4>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Upload your child's sketch</li>
                <li>AI analyzes the drawing</li>
                <li>Transformation takes 30-60 seconds</li>
                <li>View before/after comparison</li>
                <li>Share with the community!</li>
              </ol>
            </div>
          </div>
        </div>
      </form>

      {/* Success: Show Result */}
      {transformedImageUrl && (
        <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">✨ Transformation Complete!</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Original */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Original Sketch</h4>
              <img src={sketchPreview!} alt="Original" className="w-full rounded-lg" />
            </div>

            {/* Transformed */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">AI Transformed ✨</h4>
              <img src={transformedImageUrl} alt="Transformed" className="w-full rounded-lg" />
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/my-artists/${id}`}
              className="flex-1 text-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              View Artist Profile
            </Link>
            <button
              onClick={() => {
                // Reset form
                setSketchFile(null);
                setSketchPreview(null);
                setTransformedImageUrl(null);
                setCharacterName('');
                setTitle('');
                setDescription('');
                setArtworkId(null);
              }}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
