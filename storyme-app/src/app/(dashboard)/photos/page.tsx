/**
 * Photos to Storybook Page
 * Allows users to upload photos and convert them into animated storybook illustrations
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PhotoImportReview from '@/components/import/PhotoImportReview';

// Types for photo import
export interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  base64?: string;
  transformedImageBase64?: string;
  caption?: string;
  captionChinese?: string;
  status: 'pending' | 'transforming' | 'completed' | 'error';
  error?: string;
}

type ImportStep = 'upload' | 'transforming' | 'review' | 'translating' | 'finalizing';

const MAX_PHOTOS = 15;

export default function PhotosPage() {
  const router = useRouter();

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [storyContext, setStoryContext] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [illustrationStyle, setIllustrationStyle] = useState<'pixar' | 'classic'>('pixar');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // File validation
  const validateFile = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return 'Please upload JPG, PNG, WebP, or GIF images';
    }
    if (file.size > 15 * 1024 * 1024) { // 15MB limit per photo
      return 'Each photo must be less than 15MB';
    }
    return null;
  };

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substring(2, 11);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [photos]);

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  };

  // Process uploaded files
  const handleFiles = (files: File[]) => {
    setError(null);

    // Filter to only image files
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setError('Please select image files (JPG, PNG, WebP, GIF)');
      return;
    }

    // Check max limit
    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }

    const filesToAdd = imageFiles.slice(0, remainingSlots);
    if (imageFiles.length > remainingSlots) {
      setError(`Only added ${remainingSlots} photos (maximum ${MAX_PHOTOS})`);
    }

    // Validate and create photo items
    const newPhotos: PhotoItem[] = [];
    for (const file of filesToAdd) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      newPhotos.push({
        id: generateId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
      });
    }

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  // Remove a photo
  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  // Reorder photos
  const reorderPhotos = (newPhotos: PhotoItem[]) => {
    setPhotos(newPhotos);
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Resize image client-side to reduce payload size
  const resizeImage = (file: File, maxWidth: number = 1500): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Only resize if larger than max
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Get base64 without data URL prefix
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };


  // Start transformation process
  const handleStartTransform = async () => {
    if (photos.length === 0) return;

    setStep('transforming');
    setError(null);
    setProgress(0);
    setCurrentPhotoIndex(0);

    try {
      const updatedPhotos = [...photos];

      for (let i = 0; i < updatedPhotos.length; i++) {
        setCurrentPhotoIndex(i);
        setProgressMessage(`Transforming photo ${i + 1} of ${updatedPhotos.length}...`);
        setProgress(Math.round((i / updatedPhotos.length) * 100));

        const photo = updatedPhotos[i];
        photo.status = 'transforming';
        setPhotos([...updatedPhotos]);

        try {
          // Resize and convert to base64
          const base64 = await resizeImage(photo.file);
          photo.base64 = base64;

          // Call transform API
          const response = await fetch('/api/import-photos/transform', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              storyContext: storyContext.trim() || undefined,
              illustrationStyle,
              photoIndex: i + 1,
              totalPhotos: updatedPhotos.length,
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to transform photo');
          }

          photo.transformedImageBase64 = data.transformedImageBase64;
          photo.caption = data.caption;
          photo.status = 'completed';
        } catch (err) {
          console.error(`Error transforming photo ${i + 1}:`, err);
          photo.status = 'error';
          photo.error = err instanceof Error ? err.message : 'Transform failed';
        }

        setPhotos([...updatedPhotos]);

        // Small delay between API calls to avoid rate limiting
        if (i < updatedPhotos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setProgress(100);
      setProgressMessage('Transformation complete!');

      // Check if any photos succeeded
      const successCount = updatedPhotos.filter(p => p.status === 'completed').length;
      if (successCount === 0) {
        setError('All photos failed to transform. Please try again.');
        setStep('upload');
        return;
      }

      // Generate default title if not set
      if (!storyTitle.trim()) {
        setStoryTitle(storyContext.trim() ? storyContext.substring(0, 50) : 'My Photo Storybook');
      }

      setStep('review');
    } catch (err) {
      console.error('Transform error:', err);
      setError(err instanceof Error ? err.message : 'Failed to transform photos');
      setStep('upload');
    }
  };

  // Handle caption updates (supports both English and Chinese captions)
  const handleCaptionUpdate = (id: string, caption: string, captionChinese?: string) => {
    setPhotos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updates: Partial<PhotoItem> = { caption };
      if (captionChinese !== undefined) {
        updates.captionChinese = captionChinese;
      }
      return { ...p, ...updates };
    }));
  };

  // Handle translation (supports both en-to-zh and zh-to-en)
  const handleTranslate = async (direction: 'en-to-zh' | 'zh-to-en' = 'en-to-zh') => {
    setStep('translating');
    setProgress(0);

    const isChineseToEnglish = direction === 'zh-to-en';
    setProgressMessage(isChineseToEnglish
      ? 'Translating captions to English...'
      : 'Translating captions to Chinese...');

    try {
      // Filter photos that need translation based on direction
      const photosToTranslate = photos.filter(p => {
        if (p.status !== 'completed') return false;
        if (isChineseToEnglish) {
          return p.captionChinese && !p.caption;
        } else {
          return p.caption && !p.captionChinese;
        }
      });

      if (photosToTranslate.length === 0) {
        setStep('review');
        return;
      }

      // Create a mapping of pageNumber to photo ID for later lookup
      const pageToPhotoId = new Map<number, string>();
      photosToTranslate.forEach((p, idx) => {
        pageToPhotoId.set(idx + 1, p.id);
      });

      const response = await fetch('/api/import-pdf/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: photosToTranslate.map((p, idx) => ({
            pageNumber: idx + 1,
            captionEnglish: isChineseToEnglish ? undefined : p.caption,
            captionChinese: isChineseToEnglish ? p.captionChinese : undefined,
          })),
          direction,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to translate captions');
      }

      // Build translation map by photo ID
      const translationById = new Map<string, string>();
      for (const t of data.translations) {
        const photoId = pageToPhotoId.get(t.pageNumber);
        if (photoId) {
          // The API returns the translated field based on direction
          const translatedText = isChineseToEnglish ? t.captionEnglish : t.captionChinese;
          if (translatedText) {
            translationById.set(photoId, translatedText);
          }
        }
      }

      // Update photos with translations
      setPhotos(prev => prev.map(p => {
        const translation = translationById.get(p.id);
        if (translation) {
          if (isChineseToEnglish) {
            return { ...p, caption: translation };
          } else {
            return { ...p, captionChinese: translation };
          }
        }
        return p;
      }));

      setStep('review');
    } catch (err) {
      console.error('Translation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to translate');
      setStep('review');
    }
  };

  // Handle finalization
  const handleFinalize = async () => {
    setStep('finalizing');
    setProgress(0);
    setProgressMessage('Creating your storybook...');

    try {
      // Filter to only completed photos that have valid transformed images
      const completedPhotos = photos.filter(p =>
        p.status === 'completed' &&
        p.transformedImageBase64 &&
        p.transformedImageBase64.length > 0
      );

      if (completedPhotos.length === 0) {
        throw new Error('No valid photos to create storybook. Please ensure at least one photo was successfully transformed.');
      }

      // Step 1: Create project first (without images)
      setProgress(10);
      setProgressMessage('Creating storybook...');

      const createResponse = await fetch('/api/import-photos/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: storyTitle.trim() || 'My Photo Storybook',
          storyContext: storyContext.trim(),
          totalPages: completedPhotos.length,
          illustrationStyle,
        }),
      });

      const createData = await createResponse.json();
      if (!createResponse.ok || !createData.success) {
        throw new Error(createData.error || 'Failed to create storybook');
      }

      const projectId = createData.projectId;

      // Step 2: Upload each image one at a time
      for (let i = 0; i < completedPhotos.length; i++) {
        const photo = completedPhotos[i];
        const progress = 10 + Math.round((i / completedPhotos.length) * 80);
        setProgress(progress);
        setProgressMessage(`Uploading image ${i + 1} of ${completedPhotos.length}...`);

        const uploadResponse = await fetch('/api/import-photos/upload-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            sceneNumber: i + 1,
            imageBase64: photo.transformedImageBase64,
            captionEnglish: photo.caption || '',
            captionChinese: photo.captionChinese,
            isCover: i === 0,
          }),
        });

        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadData.success) {
          console.error(`Failed to upload image ${i + 1}:`, uploadData.error);
          // Continue with other images instead of failing completely
        }
      }

      // Step 3: Finalize project
      setProgress(95);
      setProgressMessage('Finalizing storybook...');

      const finalizeResponse = await fetch('/api/import-photos/finalize-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const finalizeData = await finalizeResponse.json();
      if (!finalizeResponse.ok || !finalizeData.success) {
        throw new Error(finalizeData.error || 'Failed to finalize storybook');
      }

      setProgress(100);
      setProgressMessage('Success! Redirecting...');

      // Redirect to project page
      router.push(`/projects/${projectId}`);
    } catch (err) {
      console.error('Finalization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create storybook');
      setStep('review');
    }
  };

  // Render upload step (combined with context options)
  const renderUploadStep = () => (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
          Photos to Storybook
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Transform photos into storybook illustrations. First photo becomes the cover.
        </p>
      </div>

      {/* Upload Area - Compact */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all ${
          dragActive
            ? 'border-orange-500 bg-orange-50'
            : 'border-gray-300 hover:border-orange-400 hover:bg-gray-50'
        }`}
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex items-center justify-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-700">
              Drop photos here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Max {MAX_PHOTOS} photos, 15MB each
            </p>
          </div>
        </div>
      </div>

      {/* Photo Previews */}
      {photos.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {photos.length}/{MAX_PHOTOS} photos
            </span>
            <button
              onClick={() => {
                photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
                setPhotos([]);
              }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {photos.map((photo, idx) => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={photo.previewUrl}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {idx === 0 ? 'Cover' : idx + 1}
                </div>
                <button
                  onClick={() => removePhoto(photo.id)}
                  className="absolute top-0.5 right-0.5 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Story Options - Always visible */}
      <div className="mt-6 space-y-4">
          {/* Story Context */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Story Context <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={storyContext}
              onChange={(e) => setStoryContext(e.target.value)}
              placeholder="e.g., Daddy and Mommy taking Connor and Carter on a camping trip to Yosemite..."
              className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Include names and themes for personalized captions
            </p>
          </div>

          {/* Title and Style Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Story Title <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                placeholder="e.g., Our Camping Adventure"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Illustration Style
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIllustrationStyle('pixar')}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    illustrationStyle === 'pixar'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-orange-300 text-gray-700'
                  }`}
                >
                  Pixar 3D
                </button>
                <button
                  onClick={() => setIllustrationStyle('classic')}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    illustrationStyle === 'classic'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-orange-300 text-gray-700'
                  }`}
                >
                  Classic 2D
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Transform Button - Right Aligned */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleStartTransform}
          disabled={photos.length === 0}
          className="px-6 py-3 bg-gradient-to-r from-orange-600 to-pink-600 text-white rounded-lg hover:from-orange-700 hover:to-pink-700 font-semibold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-orange-600 disabled:hover:to-pink-600"
        >
          <span>Transform Photos</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>
    </div>
  );


  // Render transforming step
  const renderTransformingStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl mb-6">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Transforming Photos</h2>
      <p className="text-gray-600 mb-6">{progressMessage}</p>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current Photo Preview */}
      {photos[currentPhotoIndex] && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 border-2 border-purple-300">
            <img
              src={photos[currentPhotoIndex].previewUrl}
              alt="Current"
              className="w-full h-full object-cover"
            />
          </div>
          <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 border-2 border-dashed border-purple-300 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 mt-6">
        This may take 10-30 seconds per photo. Please wait...
      </p>
    </div>
  );

  // Render translation progress
  const renderTranslatingStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-teal-100 rounded-2xl mb-6">
        <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Translating to Chinese</h2>
      <p className="text-gray-600 mb-6">{progressMessage}</p>

      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-green-600 to-teal-600 animate-pulse w-full" />
      </div>
    </div>
  );

  // Render finalization progress
  const renderFinalizingStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-teal-100 rounded-2xl mb-6">
        <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Creating Your Storybook</h2>
      <p className="text-gray-600 mb-6">{progressMessage}</p>

      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-600 to-teal-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-2">{progress}%</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 'upload' && renderUploadStep()}
          {step === 'transforming' && renderTransformingStep()}
          {step === 'translating' && renderTranslatingStep()}
          {step === 'finalizing' && renderFinalizingStep()}
          {step === 'review' && (
            <PhotoImportReview
              photos={photos}
              storyTitle={storyTitle}
              storyContext={storyContext}
              onPhotosUpdate={reorderPhotos}
              onTitleUpdate={setStoryTitle}
              onCaptionUpdate={handleCaptionUpdate}
              onTranslate={handleTranslate}
              onFinalize={handleFinalize}
              onBack={() => setStep('upload')}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
