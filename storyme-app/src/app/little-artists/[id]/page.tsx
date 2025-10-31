/**
 * Public Artist Profile Page
 * Display individual artist with their artwork collection
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';
import type { LittleArtist, ArtistArtwork } from '@/lib/types/artist';

export default function ArtistProfilePage() {
  const params = useParams();
  const router = useRouter();
  const artistId = params.id as string;

  const [artist, setArtist] = useState<LittleArtist | null>(null);
  const [artworks, setArtworks] = useState<ArtistArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<ArtistArtwork | null>(null);

  useEffect(() => {
    loadArtistData();
  }, [artistId]);

  const loadArtistData = async () => {
    try {
      setLoading(true);

      // Load artist profile
      const artistResponse = await fetch(`/api/little-artists/${artistId}?include_artworks=true`);

      if (!artistResponse.ok) {
        if (artistResponse.status === 404) {
          throw new Error('Artist not found');
        }
        throw new Error('Failed to load artist');
      }

      const artistData = await artistResponse.json();
      setArtist(artistData.artist);

      // Load artworks
      const artworksResponse = await fetch(`/api/little-artists/${artistId}/artworks`);

      if (artworksResponse.ok) {
        const artworksData = await artworksResponse.json();
        setArtworks(artworksData.artworks || []);
      }
    } catch (err) {
      console.error('Error loading artist:', err);
      setError(err instanceof Error ? err.message : 'Failed to load artist');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <LandingNav />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
            <p className="text-gray-600">Loading artist profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <LandingNav />
        <div className="flex items-center justify-center px-4 py-24">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <svg
              className="w-16 h-16 text-red-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-red-900 mb-2">Artist Not Found</h2>
            <p className="text-red-700 mb-6">{error || 'This artist profile is not available'}</p>
            <Link
              href="/little-artists"
              className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
            >
              Browse All Artists
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navigation */}
      <LandingNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            href="/little-artists"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Gallery
          </Link>
        </div>
        {/* Artist Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="md:flex">
            {/* Profile Photo */}
            <div className="md:w-1/3 lg:w-1/4">
              <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 relative">
                {artist.profile_photo_url ? (
                  <img
                    src={artist.profile_photo_url}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-8xl">🎨</div>
                  </div>
                )}

                {artist.featured && (
                  <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                    <span>⭐</span>
                    <span>Featured Artist</span>
                  </div>
                )}
              </div>
            </div>

            {/* Artist Info */}
            <div className="md:w-2/3 lg:w-3/4 p-8">
              <div className="flex items-baseline gap-3 mb-4">
                <h1 className="text-4xl font-bold text-gray-900">{artist.name}</h1>
                {artist.age && (
                  <span className="text-xl text-gray-500">age {artist.age}</span>
                )}
              </div>

              {artist.bio && (
                <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                  {artist.bio}
                </p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-xl">
                    🖼️
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{artist.artworks_count || 0}</div>
                    <div className="text-sm text-gray-600">Artworks</div>
                  </div>
                </div>

                {artist.character_usage_count > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-xl">
                      📖
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{artist.character_usage_count}</div>
                      <div className="text-sm text-gray-600">Story Uses</div>
                    </div>
                  </div>
                )}

                {artist.published_at && (
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                      📅
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {new Date(artist.published_at).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-sm text-gray-600">Joined</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Premium Feature Notice */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-l-4 border-purple-500">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">✨</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Use these characters in your stories!</h3>
                    <p className="text-sm text-gray-700">
                      Premium members can add {artist.name}'s characters to their own storybooks
                    </p>
                  </div>
                  <Link
                    href="/upgrade"
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold text-sm whitespace-nowrap shadow-lg hover:shadow-xl transition-all"
                  >
                    Get Premium
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Artworks Section */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {artist.name}'s Character Collection
          </h2>

          {artworks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No artworks yet</h3>
              <p className="text-gray-600">
                {artist.name} hasn't shared any characters yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {artworks.map((artwork) => (
                <ArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  artistName={artist.name}
                  onClick={() => setSelectedArtwork(artwork)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Artwork Detail Modal */}
      {selectedArtwork && (
        <ArtworkModal
          artwork={selectedArtwork}
          artistName={artist.name}
          onClose={() => setSelectedArtwork(null)}
        />
      )}
    </div>
  );
}

/**
 * Artwork Card Component
 */
function ArtworkCard({
  artwork,
  artistName,
  onClick,
}: {
  artwork: ArtistArtwork;
  artistName: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 group"
    >
      {/* Before/After Images */}
      <div className="grid grid-cols-2 gap-px bg-gray-200">
        {/* Original Sketch */}
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          <img
            src={artwork.original_sketch_url}
            alt={`${artwork.character_name || 'Character'} - sketch`}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs font-semibold">
            Original
          </div>
        </div>

        {/* Transformed Character */}
        <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 relative overflow-hidden">
          {artwork.animated_version_url ? (
            <>
              <img
                src={artwork.animated_version_url}
                alt={`${artwork.character_name || 'Character'} - animated`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute bottom-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold">
                AI Enhanced
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-3xl mb-2">✨</div>
                <div className="text-xs">Processing...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Artwork Info */}
      <div className="p-4">
        {artwork.character_name && (
          <h3 className="font-bold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">
            {artwork.character_name}
          </h3>
        )}

        {artwork.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {artwork.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>by {artistName}</span>
          {artwork.transformation_style && (
            <span className="capitalize">{artwork.transformation_style.replace('-', ' ')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Artwork Detail Modal
 */
function ArtworkModal({
  artwork,
  artistName,
  onClose,
}: {
  artwork: ArtistArtwork;
  artistName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {artwork.character_name || 'Untitled Character'}
            </h2>
            <p className="text-sm text-gray-600">by {artistName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Side-by-side comparison */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Original Sketch */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span>✏️</span>
                <span>Original Sketch</span>
              </h3>
              <div className="rounded-xl overflow-hidden shadow-lg bg-gray-100">
                <img
                  src={artwork.original_sketch_url}
                  alt="Original sketch"
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* AI Enhanced */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span>✨</span>
                <span>AI Enhanced Character</span>
              </h3>
              {artwork.animated_version_url ? (
                <div className="rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-purple-100 to-pink-100">
                  <img
                    src={artwork.animated_version_url}
                    alt="AI enhanced"
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden shadow-lg bg-gray-100 aspect-square flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">⏳</div>
                    <div>Processing...</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {artwork.description && (
            <div className="bg-purple-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">About this character</h3>
              <p className="text-gray-700">{artwork.description}</p>
            </div>
          )}

          {/* Technical Details */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {artwork.transformation_style && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-1">Transformation Style</div>
                <div className="font-semibold text-gray-900 capitalize">
                  {artwork.transformation_style.replace(/-/g, ' ')}
                </div>
              </div>
            )}

            {artwork.created_at && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-1">Created</div>
                <div className="font-semibold text-gray-900">
                  {new Date(artwork.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 text-center border border-purple-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Love this character?</h3>
            <p className="mb-4 text-gray-700">
              Premium members can use this character in their own storybooks
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/create"
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                Create Story
              </Link>
              <Link
                href="/upgrade"
                className="px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-semibold shadow-lg hover:shadow-xl transition-all border-2 border-gray-300 transform hover:-translate-y-1"
              >
                Upgrade to Premium
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
