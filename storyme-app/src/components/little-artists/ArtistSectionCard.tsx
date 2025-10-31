/**
 * ArtistSectionCard Component
 * Blog-style artist section with profile on left and artwork grid on right
 * Used on both /little-artists and /my-artists pages
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LittleArtist, ArtistArtwork } from '@/lib/types/artist';
import ArtworkGrid from './ArtworkGrid';

interface ArtistSectionCardProps {
  artist: LittleArtist;
  artworks: ArtistArtwork[];
  isOwnerView?: boolean;
  onArtworkDeleted?: () => void;
}

export default function ArtistSectionCard({
  artist,
  artworks,
  isOwnerView = false,
  onArtworkDeleted,
}: ArtistSectionCardProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentText, setConsentText] = useState('');
  const [consentError, setConsentError] = useState('');
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);

  const handlePublishClick = () => {
    // If status is draft, open consent dialog
    if (artist.status === 'draft') {
      setShowConsentDialog(true);
      return;
    }

    // If already published, unpublish directly
    handleUnpublish();
  };

  const handleUnpublish = async () => {
    if (isPublishing) return;

    const confirmUnpublish = window.confirm(
      'Are you sure you want to unpublish this artist profile? It will no longer be visible to the public.'
    );

    if (!confirmUnpublish) return;

    setIsPublishing(true);
    try {
      const response = await fetch(`/api/little-artists/${artist.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 'draft',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unpublish');
      }

      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Error unpublishing:', error);
      alert('Failed to unpublish. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleConsentSubmit = async () => {
    setConsentError('');

    // Validate consent text
    if (!consentText.trim() || consentText.trim().length < 10) {
      setConsentError('Please write a consent statement (at least 10 characters)');
      return;
    }

    setIsSubmittingConsent(true);

    try {
      const response = await fetch(`/api/little-artists/${artist.id}/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          consent_text: consentText.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit consent');
      }

      // Success! Close dialog and refresh
      setShowConsentDialog(false);
      alert('✅ Consent submitted successfully! Your artist profile is now pending review by our admin team. You will be notified once it is approved.');
      window.location.reload();
    } catch (error) {
      console.error('Error submitting consent:', error);
      setConsentError(error instanceof Error ? error.message : 'Failed to submit consent');
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  const getStatusInfo = () => {
    switch (artist.status) {
      case 'draft':
        return {
          label: 'Draft',
          color: 'bg-gray-100 text-gray-700',
          icon: '📝',
        };
      case 'pending_review':
        return {
          label: 'Pending Review',
          color: 'bg-yellow-100 text-yellow-700',
          icon: '⏳',
        };
      case 'published':
        return {
          label: 'Published',
          color: 'bg-green-100 text-green-700',
          icon: '✅',
        };
      case 'archived':
        return {
          label: 'Archived',
          color: 'bg-red-100 text-red-700',
          icon: '🗄️',
        };
      default:
        return {
          label: artist.status,
          color: 'bg-gray-100 text-gray-700',
          icon: '❓',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Side - Artist Profile */}
        <div className="lg:w-64 flex-shrink-0">
          {/* Artist Photo */}
          <div className="relative w-48 h-48 mx-auto lg:mx-0 mb-4">
            <div className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
              {artist.profile_photo_url ? (
                <img
                  src={artist.profile_photo_url}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-6xl">🎨</div>
                </div>
              )}
            </div>

            {/* Featured Badge */}
            {artist.featured && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                <span>⭐</span>
                <span>Featured</span>
              </div>
            )}
          </div>

          {/* Artist Info */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {artist.name}
            </h2>
            {artist.age && (
              <p className="text-sm text-gray-500 mb-3">
                Age {artist.age}
              </p>
            )}
            {artist.bio && (
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {artist.bio}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center justify-center lg:justify-start gap-4 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-1">
                <span>🖼️</span>
                <span>{artworks.length} {artworks.length === 1 ? 'artwork' : 'artworks'}</span>
              </div>
              {artist.character_usage_count > 0 && (
                <div className="flex items-center gap-1">
                  <span>📖</span>
                  <span>{artist.character_usage_count} uses</span>
                </div>
              )}
            </div>

            {/* Status & Publish Button - Owner View Only */}
            {isOwnerView && (
              <div className="mb-4 flex flex-col items-start lg:items-start">
                {/* Status Badge */}
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    <span>{statusInfo.icon}</span>
                    <span>{statusInfo.label}</span>
                  </span>
                </div>

                {/* Publish/Unpublish Buttons - Same style as Add Artwork button */}
                <div className="w-full">
                  {artist.status === 'draft' && (
                    <button
                      onClick={handlePublishClick}
                      disabled={isPublishing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors border border-blue-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
                    </button>
                  )}
                  {artist.status === 'published' && (
                    <button
                      onClick={handlePublishClick}
                      disabled={isPublishing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span>{isPublishing ? 'Unpublishing...' : 'Unpublish'}</span>
                    </button>
                  )}
                  {artist.status === 'pending_review' && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium border border-yellow-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Awaiting admin approval</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* View Full Profile Link (optional) */}
            {!isOwnerView && (
              <Link
                href={`/little-artists/${artist.id}`}
                className="inline-block text-sm text-purple-600 hover:text-purple-700 font-semibold hover:underline"
              >
                View full profile →
              </Link>
            )}
          </div>
        </div>

        {/* Right Side - Artwork Grid */}
        <div className="flex-1 relative">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Artworks by {artist.name}
            </h3>
          </div>

          {artworks.length > 0 ? (
            <ArtworkGrid
              artworks={artworks}
              artistName={artist.name}
              isOwnerView={isOwnerView}
              onArtworkDeleted={onArtworkDeleted}
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <div className="text-5xl mb-3">🎨</div>
              <p className="text-gray-600">No artworks yet</p>
              {isOwnerView && (
                <p className="text-sm text-gray-500 mt-2">
                  Click the + button below to add your first artwork
                </p>
              )}
            </div>
          )}

          {/* Add Artwork Button - Owner View Only */}
          {isOwnerView && (
            <Link
              href={`/my-artists/${artist.id}/upload`}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Artwork</span>
            </Link>
          )}
        </div>
      </div>

      {/* Parental Consent Dialog */}
      {showConsentDialog && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold mb-2">Parental Consent Required</h2>
              <p className="text-purple-100 text-sm">
                Before publishing {artist.name}'s profile, we need your consent as a parent/guardian.
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* What Publishing Means */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  What does publishing mean?
                </h3>
                <ul className="text-sm text-blue-800 space-y-1 ml-7">
                  <li>• {artist.name}'s profile and artworks will be visible to the public</li>
                  <li>• The profile will appear in the Little Artists community gallery</li>
                  <li>• Artworks marked for sharing will be available in the character library</li>
                  <li>• Your submission will be reviewed by our admin team before going live</li>
                </ul>
              </div>

              {/* Consent Statement */}
              <div>
                <label htmlFor="consentText" className="block text-sm font-semibold text-gray-900 mb-2">
                  Your Consent Statement <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  Please write a brief statement confirming that you consent to publishing your child's artwork and profile. For example: "I, [Your Name], consent to publish my child's artwork on KindleWood Studio."
                </p>
                <textarea
                  id="consentText"
                  value={consentText}
                  onChange={(e) => setConsentText(e.target.value)}
                  rows={4}
                  placeholder="I consent to publish..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  disabled={isSubmittingConsent}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 10 characters required
                </p>
              </div>

              {/* Error Message */}
              {consentError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{consentError}</p>
                </div>
              )}

              {/* Important Notice */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-700">
                  <strong>Privacy & Safety:</strong> We take the safety of young artists seriously. All submissions are reviewed by our team before publication. You can unpublish the profile at any time.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-3">
              <button
                onClick={() => {
                  setShowConsentDialog(false);
                  setConsentText('');
                  setConsentError('');
                }}
                disabled={isSubmittingConsent}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConsentSubmit}
                disabled={isSubmittingConsent || !consentText.trim()}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingConsent ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </span>
                ) : (
                  'Submit Consent'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
