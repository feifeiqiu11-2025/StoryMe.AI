/**
 * Artist Management Page
 * View and manage an individual artist's profile and artworks
 */

'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LittleArtist, ArtistArtwork } from '@/lib/types/artist';

export default function ArtistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [artist, setArtist] = useState<LittleArtist | null>(null);
  const [artworks, setArtworks] = useState<ArtistArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    loadArtistAndArtworks();
  }, [id]);

  const loadArtistAndArtworks = async () => {
    try {
      const response = await fetch(`/api/little-artists/${id}?include_artworks=true`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load artist');
      }

      const data = await response.json();
      setArtist(data.artist);
      setArtworks(data.artworks || []);
    } catch (err) {
      console.error('Error loading artist:', err);
      setError(err instanceof Error ? err.message : 'Failed to load artist');
    } finally {
      setLoading(false);
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

  if (error || !artist) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
          <div className="text-gray-700">{error || 'Artist not found'}</div>
          <Link href="/my-artists" className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Back to My Artists
          </Link>
        </div>
      </div>
    );
  }

  const canUploadMore = artworks.filter(a => a.status !== 'archived').length < 20;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Link href="/my-artists" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to My Artists
      </Link>

      {/* Artist Profile Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Photo */}
          <div className="flex-shrink-0">
            {artist.profile_photo_url ? (
              <img
                src={artist.profile_photo_url}
                alt={artist.name}
                className="w-32 h-32 rounded-lg object-cover"
              />
            ) : (
              <div className="w-32 h-32 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                <span className="text-6xl">👦</span>
              </div>
            )}
          </div>

          {/* Artist Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{artist.name}</h1>
                {artist.age && (
                  <p className="text-gray-600 mb-2">Age {artist.age}</p>
                )}
                {artist.bio && (
                  <p className="text-gray-700 mb-4">{artist.bio}</p>
                )}
              </div>

              {/* Status Badge */}
              <div>
                {artist.status === 'published' && (
                  <span className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                    ✓ Published
                  </span>
                )}
                {artist.status === 'pending_review' && (
                  <span className="bg-yellow-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                    ⏳ Under Review
                  </span>
                )}
                {artist.status === 'draft' && (
                  <span className="bg-gray-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                    📝 Draft
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎨</span>
                <div>
                  <div className="font-semibold text-gray-900">{artist.artworks_count}</div>
                  <div className="text-xs text-gray-600">Artworks</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <div>
                  <div className="font-semibold text-gray-900">{artist.character_usage_count}</div>
                  <div className="text-xs text-gray-600">Times Used</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {artist.status === 'draft' && artist.artworks_count > 0 && !artist.parent_consent_given && (
                <button
                  onClick={() => setShowConsentModal(true)}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold"
                >
                  Request Publication
                </button>
              )}
              {canUploadMore && (
                <Link
                  href={`/my-artists/${artist.id}/upload`}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold"
                >
                  Upload Artwork
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Info */}
      {artist.status === 'pending_review' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Under Review</h3>
              <p className="text-sm text-gray-700">
                Your artist profile is being reviewed by our team. We'll notify you once it's approved!
              </p>
            </div>
          </div>
        </div>
      )}

      {artist.status === 'published' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Published!</h3>
              <p className="text-sm text-gray-700">
                This artist profile is now public! Other users can view and use these characters in their stories.
              </p>
              <Link
                href={`/little-artists/${artist.id}`}
                className="inline-block mt-2 text-blue-600 hover:text-blue-800 font-semibold text-sm"
              >
                View Public Profile →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Artworks Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Artworks</h2>
          {canUploadMore && (
            <span className="text-sm text-gray-600">
              ({artworks.filter(a => a.status !== 'archived').length}/20 uploaded)
            </span>
          )}
        </div>

        {artworks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🎨</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Artworks Yet</h3>
            <p className="text-gray-600 mb-6">
              Upload your first artwork to get started!
            </p>
            <Link
              href={`/my-artists/${artist.id}/upload`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg"
            >
              Upload First Artwork
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artworks.map((artwork) => (
              <div key={artwork.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow">
                {/* Before/After Images */}
                <div className="grid grid-cols-2">
                  {/* Original Sketch */}
                  <div className="relative aspect-square bg-gray-100">
                    <img
                      src={artwork.original_sketch_url}
                      alt="Original sketch"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-semibold">
                      Original
                    </div>
                  </div>

                  {/* Transformed Version */}
                  <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-purple-100">
                    {artwork.animated_version_url ? (
                      <>
                        <img
                          src={artwork.animated_version_url}
                          alt="Transformed"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-semibold">
                          AI ✨
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {artwork.status === 'processing' ? (
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <div className="text-xs">Processing...</div>
                          </div>
                        ) : (
                          <div className="text-center text-xs">
                            Not transformed
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Artwork Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {artwork.character_name || artwork.title || 'Untitled'}
                  </h3>
                  {artwork.transformation_style && (
                    <p className="text-xs text-gray-600 mb-2">
                      Style: {artwork.transformation_style}
                    </p>
                  )}
                  {artwork.description && (
                    <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                      {artwork.description}
                    </p>
                  )}

                  {/* Status */}
                  <div className="text-xs">
                    {artwork.status === 'published' && (
                      <span className="text-green-600 font-semibold">✓ Published</span>
                    )}
                    {artwork.status === 'draft' && (
                      <span className="text-gray-600">Draft</span>
                    )}
                    {artwork.status === 'processing' && (
                      <span className="text-blue-600">Processing...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Limit Reached */}
        {!canUploadMore && artworks.length > 0 && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">Artwork Limit Reached</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              This artist has reached the maximum of 20 artworks.
            </p>
          </div>
        )}
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <ConsentModal
          artist={artist}
          onClose={() => setShowConsentModal(false)}
          onSuccess={() => {
            setShowConsentModal(false);
            loadArtistAndArtworks();
          }}
        />
      )}
    </div>
  );
}

// Consent Modal Component
function ConsentModal({
  artist,
  onClose,
  onSuccess,
}: {
  artist: LittleArtist;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [consentText, setConsentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (consentText.trim().length < 20) {
      setError('Please provide a more detailed consent statement');
      return;
    }

    setLoading(true);
    setError(null);

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

      alert('Consent recorded! Your artist profile has been submitted for review. We\'ll notify you once it\'s approved.');
      onSuccess();
    } catch (err) {
      console.error('Error submitting consent:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit consent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Parental Consent Required</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">What Happens Next:</h3>
            <ol className="list-decimal ml-5 space-y-2 text-sm text-gray-700">
              <li>You provide consent to publish {artist.name}'s artwork</li>
              <li>Our team reviews the profile and artworks</li>
              <li>Once approved, the profile becomes public</li>
              <li>Other users can view and use these characters in stories</li>
              <li>You can unpublish or remove at any time</li>
            </ol>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Consent Statement <span className="text-red-500">*</span>
            </label>
            <textarea
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
              required
              rows={4}
              placeholder={`I consent to share my child ${artist.name}'s artwork with the KindleWood Studio community. I understand the artwork will be viewable and usable by other users in their stories.`}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
