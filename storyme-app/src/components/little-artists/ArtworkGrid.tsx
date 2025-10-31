/**
 * ArtworkGrid Component
 * Responsive grid displaying artworks with expand/collapse and delete functionality
 * - 2x2 on mobile, 2x3 on desktop, 3x2 on wide screens
 * - Expand inline for > 6 artworks
 * - Click thumbnail opens lightbox
 * - Delete icon on hover (owner view only)
 */

'use client';

import React, { useState } from 'react';
import type { ArtistArtwork } from '@/lib/types/artist';

interface ArtworkGridProps {
  artworks: ArtistArtwork[];
  artistName: string;
  isOwnerView?: boolean;
  onArtworkDeleted?: () => void;
}

export default function ArtworkGrid({
  artworks,
  artistName,
  isOwnerView = false,
  onArtworkDeleted,
}: ArtworkGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState<ArtistArtwork | null>(null);
  const [artworkToDelete, setArtworkToDelete] = useState<ArtistArtwork | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debug: Log artwork data
  React.useEffect(() => {
    console.log('🎨 ArtworkGrid rendered:', {
      artistName,
      artworkCount: artworks.length,
      artworks: artworks.map(a => ({
        id: a.id,
        name: a.character_name,
        hasAnimated: !!a.animated_version_url,
        hasSketch: !!a.original_sketch_url
      }))
    });
  }, [artworks, artistName]);

  const INITIAL_DISPLAY_COUNT = 6;
  const displayedArtworks = isExpanded ? artworks : artworks.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMoreArtworks = artworks.length > INITIAL_DISPLAY_COUNT;
  const remainingCount = artworks.length - INITIAL_DISPLAY_COUNT;

  const handleDeleteArtwork = async (artwork: ArtistArtwork) => {
    try {
      setIsDeleting(true);

      const response = await fetch(
        `/api/little-artists/${artwork.artist_id}/artworks/${artwork.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete artwork');
      }

      // Close dialog
      setArtworkToDelete(null);

      // Notify parent component to refresh
      onArtworkDeleted?.();
    } catch (error) {
      console.error('Error deleting artwork:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete artwork');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Artwork Grid - 2x4 Layout (before/after side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayedArtworks.map((artwork) => (
          <ArtworkThumbnail
            key={artwork.id}
            artwork={artwork}
            artistName={artistName}
            isOwnerView={isOwnerView}
            onClick={() => setSelectedArtwork(artwork)}
            onDeleteClick={() => setArtworkToDelete(artwork)}
          />
        ))}
      </div>

      {/* View More Button */}
      {hasMoreArtworks && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-4 w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span>View more artworks... ({remainingCount} more)</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Collapse Button */}
      {isExpanded && (
        <button
          onClick={() => setIsExpanded(false)}
          className="mt-4 w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span>Show less</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* Lightbox Modal */}
      {selectedArtwork && (
        <ArtworkLightbox
          artwork={selectedArtwork}
          artistName={artistName}
          onClose={() => setSelectedArtwork(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {artworkToDelete && (
        <DeleteConfirmationDialog
          artwork={artworkToDelete}
          isDeleting={isDeleting}
          onConfirm={() => handleDeleteArtwork(artworkToDelete)}
          onCancel={() => setArtworkToDelete(null)}
        />
      )}
    </>
  );
}

/**
 * Artwork Thumbnail Component
 */
interface ArtworkThumbnailProps {
  artwork: ArtistArtwork;
  artistName: string;
  isOwnerView: boolean;
  onClick: () => void;
  onDeleteClick: () => void;
}

function ArtworkThumbnail({
  artwork,
  artistName,
  isOwnerView,
  onClick,
  onDeleteClick,
}: ArtworkThumbnailProps) {
  const hasOriginal = !!artwork.original_sketch_url;
  const hasTransformed = !!artwork.animated_version_url;

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Character Name Header */}
      {artwork.character_name && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-2 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800 text-sm">{artwork.character_name}</h3>
        </div>
      )}

      {/* Before/After Grid - 2 columns */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {/* Original Sketch - Left Side */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600 px-1">Original</span>
          <div
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
            onClick={onClick}
          >
            {hasOriginal ? (
              <img
                src={artwork.original_sketch_url}
                alt={`Original sketch by ${artistName}`}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-2xl">🎨</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity" />
          </div>
        </div>

        {/* AI Transformed - Right Side */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600 px-1">AI Transformed</span>
          <div
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
            onClick={onClick}
          >
            {hasTransformed ? (
              <img
                src={artwork.animated_version_url}
                alt={`AI transformed ${artwork.character_name || 'character'}`}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-2">
                <span className="text-xs text-gray-500 text-center leading-tight">No AI transformation yet</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity" />
          </div>
        </div>
      </div>

      {/* Delete Button - Owner View Only */}
      {isOwnerView && (
        <div className="px-3 pb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick();
            }}
            className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-medium transition-colors border border-red-200"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Artwork Lightbox Modal Component
 */
interface ArtworkLightboxProps {
  artwork: ArtistArtwork;
  artistName: string;
  onClose: () => void;
}

function ArtworkLightbox({ artwork, artistName, onClose }: ArtworkLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full bg-white rounded-xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-900 rounded-full flex items-center justify-center text-white z-10 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Character Name */}
          {artwork.character_name && (
            <div className="mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {artwork.character_name}
              </h2>
              <p className="text-sm text-gray-600">by {artistName}</p>
            </div>
          )}

          {/* Before/After Images */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Original Sketch */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-1.5">Original Sketch</h3>
              {artwork.original_sketch_url ? (
                <img
                  src={artwork.original_sketch_url}
                  alt="Original sketch"
                  className="w-full rounded-lg shadow-md"
                />
              ) : (
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No image</span>
                </div>
              )}
            </div>

            {/* Transformed Image */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-1.5">AI Transformed</h3>
              {artwork.animated_version_url ? (
                <img
                  src={artwork.animated_version_url}
                  alt={artwork.character_name || 'Transformed artwork'}
                  className="w-full rounded-lg shadow-md"
                />
              ) : (
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-sm text-center px-2">No transformation</span>
                </div>
              )}
            </div>
          </div>

          {/* Character Description */}
          {artwork.character_description && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-1.5">Character Description</h3>
              <p className="text-sm text-gray-800 leading-relaxed">
                {artwork.character_description}
              </p>
            </div>
          )}

          {/* Transformation Prompt */}
          {artwork.transformation_prompt && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-1.5">Transformation Style</h3>
              <p className="text-xs text-gray-600">
                {artwork.transformation_prompt}
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="border-t border-gray-200 pt-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Usage Count</p>
                <p className="text-sm text-gray-900 font-semibold">
                  {artwork.usage_count || 0} stories
                </p>
              </div>
              {artwork.created_at && (
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm text-gray-900 font-semibold">
                    {new Date(artwork.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Delete Confirmation Dialog Component
 */
interface DeleteConfirmationDialogProps {
  artwork: ArtistArtwork;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmationDialog({
  artwork,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmationDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          Delete this artwork?
        </h3>

        {/* Description */}
        <p className="text-gray-600 text-center mb-6">
          This action cannot be undone. {artwork.character_name && `"${artwork.character_name}" `}
          will be permanently removed from the gallery.
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Deleting...</span>
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
