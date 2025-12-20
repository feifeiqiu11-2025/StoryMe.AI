/**
 * PhotoImportReview Component
 * Allows users to review, reorder, and edit captions for transformed photos
 *
 * Uses same vertical list layout as PDFImportReview for consistency
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';

// Image Modal Component for larger preview
function ImageModal({
  isOpen,
  onClose,
  imageUrl,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Image */}
        <div className="relative aspect-square max-h-[calc(90vh-60px)]">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}

// Import type from photos page
interface PhotoItem {
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

interface PhotoImportReviewProps {
  photos: PhotoItem[];
  storyTitle: string;
  storyContext: string;
  onPhotosUpdate: (photos: PhotoItem[]) => void;
  onTitleUpdate: (title: string) => void;
  onCaptionUpdate: (id: string, caption: string, captionChinese?: string) => void;
  onTranslate: (direction: 'en-to-zh' | 'zh-to-en') => void;
  onFinalize: () => void;
  onBack: () => void;
  error: string | null;
}

export default function PhotoImportReview({
  photos,
  storyTitle,
  storyContext,
  onPhotosUpdate,
  onTitleUpdate,
  onCaptionUpdate,
  onTranslate,
  onFinalize,
  onBack,
  error,
}: PhotoImportReviewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(storyTitle);
  const [modalImage, setModalImage] = useState<{ url: string; title: string } | null>(null);

  const completedPhotos = photos.filter(p => p.status === 'completed');
  const hasChineseTranslations = completedPhotos.some(p => p.captionChinese);
  const hasEnglishCaptions = completedPhotos.some(p => p.caption);

  // Toggle photo inclusion (mark as pending to exclude, completed to include)
  const togglePhotoInclusion = (photoId: string) => {
    const updatedPhotos = photos.map(photo =>
      photo.id === photoId
        ? { ...photo, status: photo.status === 'completed' ? 'pending' as const : 'completed' as const }
        : photo
    );
    onPhotosUpdate(updatedPhotos);
  };

  // Save title
  const saveTitle = () => {
    if (titleInput.trim()) {
      onTitleUpdate(titleInput.trim());
    }
    setEditingTitle(false);
  };

  // Move photo up in order
  const movePhotoUp = (index: number) => {
    if (index === 0) return;
    const newPhotos = [...photos];
    [newPhotos[index - 1], newPhotos[index]] = [newPhotos[index], newPhotos[index - 1]];
    onPhotosUpdate(newPhotos);
  };

  // Move photo down in order
  const movePhotoDown = (index: number) => {
    if (index === photos.length - 1) return;
    const newPhotos = [...photos];
    [newPhotos[index], newPhotos[index + 1]] = [newPhotos[index + 1], newPhotos[index]];
    onPhotosUpdate(newPhotos);
  };

  return (
    <div className="space-y-4">
      {/* Header - Compact */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-teal-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Review Your Storybook</h2>
            <p className="text-gray-500 text-xs">
              {photos.length} photos | {completedPhotos.length} scenes ready
            </p>
          </div>
        </div>
      </div>

      {/* Title - Compact inline */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2">
        <span className="text-sm font-medium text-gray-500">Title:</span>
        {editingTitle ? (
          <div className="flex gap-2 flex-1">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            />
            <button onClick={saveTitle} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
              Save
            </button>
            <button onClick={() => setEditingTitle(false)} className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <span className="font-semibold text-gray-900 flex-1">{storyTitle}</span>
            <button
              onClick={() => setEditingTitle(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Edit
            </button>
          </>
        )}
      </div>

      {/* Story Context */}
      {storyContext && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-gray-500">Context:</span>
          <span className="text-sm text-gray-700">{storyContext}</span>
        </div>
      )}

      {/* Photo List - Vertical like PDF import */}
      <div className="space-y-3">
        {photos.map((photo, index) => {
          const isIncluded = photo.status === 'completed';
          const hasTransformed = photo.transformedImageBase64;

          return (
            <div
              key={photo.id}
              className={`bg-white border rounded-xl overflow-hidden transition-all ${
                isIncluded && hasTransformed
                  ? 'border-green-300 shadow-sm'
                  : photo.status === 'error'
                  ? 'border-red-300'
                  : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex">
                {/* Original Photo - Clickable for larger view */}
                <button
                  onClick={() => setModalImage({ url: photo.previewUrl, title: `Original Photo ${index + 1}` })}
                  className="w-40 h-28 relative flex-shrink-0 bg-gray-100 border-r border-gray-200 hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer group"
                  title="Click to view larger"
                >
                  <Image
                    src={photo.previewUrl}
                    alt={`Original ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {index + 1}
                  </div>
                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                      Cover
                    </span>
                  )}
                  {/* Zoom icon on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </button>

                {/* Illustration - Clickable for larger view */}
                <button
                  onClick={() => hasTransformed && setModalImage({
                    url: `data:image/png;base64,${photo.transformedImageBase64}`,
                    title: `Illustration ${index + 1}`
                  })}
                  disabled={!hasTransformed}
                  className={`w-40 h-28 relative flex-shrink-0 bg-gray-100 border-r border-gray-200 transition-all ${
                    hasTransformed ? 'hover:ring-2 hover:ring-purple-400 cursor-pointer group' : 'cursor-default'
                  }`}
                  title={hasTransformed ? "Click to view larger" : undefined}
                >
                  {hasTransformed ? (
                    <Image
                      src={`data:image/png;base64,${photo.transformedImageBase64}`}
                      alt={`Illustration ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  ) : photo.status === 'error' ? (
                    <div className="w-full h-full flex items-center justify-center text-red-400">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-1 right-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      photo.status === 'completed' ? 'bg-green-500 text-white' :
                      photo.status === 'error' ? 'bg-red-500 text-white' :
                      'bg-gray-500 text-white'
                    }`}>
                      {photo.status === 'completed' ? 'Done' :
                       photo.status === 'error' ? 'Failed' : 'Pending'}
                    </span>
                  </div>
                  {/* Zoom icon on hover */}
                  {hasTransformed && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Caption + Controls */}
                <div className="flex-1 p-3">
                  {/* Top row: Include toggle + reorder buttons */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* Reorder buttons */}
                      <button
                        onClick={() => movePhotoUp(index)}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => movePhotoDown(index)}
                        disabled={index === photos.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Include Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <span className="text-gray-500">Include</span>
                      <button
                        onClick={() => togglePhotoInclusion(photo.id)}
                        disabled={!hasTransformed}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                          isIncluded ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            isIncluded ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  {/* Caption - English */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      English Caption
                    </label>
                    <textarea
                      value={photo.caption || ''}
                      onChange={(e) => onCaptionUpdate(photo.id, e.target.value)}
                      disabled={!hasTransformed}
                      rows={2}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder={hasTransformed ? 'Caption for this scene...' : 'Waiting for illustration...'}
                    />
                  </div>

                  {/* Caption - Chinese (if available) */}
                  {(photo.captionChinese || hasChineseTranslations) && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-purple-600 mb-1">
                        Chinese Caption 中文
                      </label>
                      <textarea
                        value={photo.captionChinese || ''}
                        onChange={(e) => onCaptionUpdate(photo.id, photo.caption || '', e.target.value)}
                        disabled={!hasTransformed}
                        rows={2}
                        className="w-full px-2 py-1.5 text-sm border border-purple-200 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="中文翻译..."
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {photo.status === 'error' && photo.error && (
                    <p className="text-xs text-red-500 mt-1">{photo.error}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          ← Start Over
        </button>

        <div className="flex items-center gap-3">
          {/* Always show both translation buttons - user picks which one to use */}
          {completedPhotos.length > 0 && (
            <>
              <button
                onClick={() => onTranslate('zh-to-en')}
                className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 font-medium text-sm"
              >
                Generate English Captions
              </button>
              <button
                onClick={() => onTranslate('en-to-zh')}
                className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 font-medium text-sm"
              >
                Generate Chinese Captions
              </button>
            </>
          )}

          {completedPhotos.length === 0 ? (
            <p className="text-amber-600 text-sm font-medium">
              Waiting for illustrations...
            </p>
          ) : (
            <button
              onClick={onFinalize}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 font-semibold shadow transition-all flex items-center gap-2"
            >
              Create Storybook ({completedPhotos.length})
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
        imageUrl={modalImage?.url || ''}
        title={modalImage?.title || ''}
      />
    </div>
  );
}
