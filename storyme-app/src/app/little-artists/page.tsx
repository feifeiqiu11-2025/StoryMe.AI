/**
 * Public Little Artists Gallery Page
 * Browse all published young artists and their artwork
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';
import ArtistSectionCard from '@/components/little-artists/ArtistSectionCard';
import type { LittleArtist, ArtistArtwork, ArtistWithArtworks } from '@/lib/types/artist';

export default function LittleArtistsGalleryPage() {
  const [artists, setArtists] = useState<ArtistWithArtworks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadArtistsWithArtworks();
  }, []);

  const loadArtistsWithArtworks = async () => {
    try {
      setLoading(true);

      // Fetch artists
      const artistsResponse = await fetch('/api/little-artists');
      if (!artistsResponse.ok) {
        throw new Error('Failed to load artists');
      }
      const artistsData = await artistsResponse.json();
      const fetchedArtists: LittleArtist[] = artistsData.artists || [];

      // Fetch artworks for each artist
      const artistsWithArtworks = await Promise.all(
        fetchedArtists.map(async (artist) => {
          try {
            const artworksResponse = await fetch(`/api/little-artists/${artist.id}/artworks`);
            if (artworksResponse.ok) {
              const artworksData = await artworksResponse.json();
              return {
                ...artist,
                artworks: artworksData.artworks || [],
              };
            }
          } catch (err) {
            console.error(`Error fetching artworks for artist ${artist.id}:`, err);
          }
          return {
            ...artist,
            artworks: [],
          };
        })
      );

      setArtists(artistsWithArtworks);
    } catch (err) {
      console.error('Error loading artists:', err);
      setError(err instanceof Error ? err.message : 'Failed to load artists');
    } finally {
      setLoading(false);
    }
  };

  // Filter artists based on search query
  const filteredArtists = artists.filter(artist => {
    const query = searchQuery.toLowerCase();
    return (
      artist.name.toLowerCase().includes(query) ||
      artist.bio?.toLowerCase().includes(query)
    );
  });

  // Separate featured and regular artists
  const featuredArtists = filteredArtists.filter(a => a.featured);
  const regularArtists = filteredArtists.filter(a => !a.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navigation */}
      <LandingNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            🎨 Little Artists
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Got a talented little artist at home? Share their creativity with our community!
            Their artwork characters can be featured in stories, participate in monthly art challenges (coming soon),
            or simply showcase their imagination in our gallery.
          </p>
        </div>
        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artists by name or interests..."
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {filteredArtists.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              🎨 {filteredArtists.length} {filteredArtists.length === 1 ? 'artist' : 'artists'}
              {featuredArtists.length > 0 && ` · ⭐ ${featuredArtists.length} featured`}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
            <p className="text-gray-600">Loading amazing artists...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <svg
              className="w-12 h-12 text-red-500 mx-auto mb-3"
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
            <p className="text-red-800 font-semibold mb-2">Unable to load artists</p>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadArtistsWithArtworks}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Featured Artists Section */}
        {!loading && !error && featuredArtists.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-3xl">⭐</div>
              <h2 className="text-3xl font-bold text-gray-900">Featured Artists</h2>
            </div>
            <div className="space-y-6">
              {featuredArtists.map((artist) => (
                <ArtistSectionCard
                  key={artist.id}
                  artist={artist}
                  artworks={artist.artworks}
                  isOwnerView={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular Artists Section */}
        {!loading && !error && regularArtists.length > 0 && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              {featuredArtists.length > 0 ? 'All Artists' : `${regularArtists.length} Talented Artists`}
            </h2>
            <div className="space-y-6">
              {regularArtists.map((artist) => (
                <ArtistSectionCard
                  key={artist.id}
                  artist={artist}
                  artworks={artist.artworks}
                  isOwnerView={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredArtists.length === 0 && (
          <div className="text-center py-16">
            {searchQuery ? (
              <>
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No artists found</h3>
                <p className="text-gray-600 mb-6">
                  Try adjusting your search or browse all artists
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                >
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🎨</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No artists yet</h3>
                <p className="text-gray-600 mb-6">
                  Be the first to showcase your young artist's creativity!
                </p>
                <Link
                  href="/my-artists"
                  className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold shadow-lg"
                >
                  Create Artist Profile
                </Link>
              </>
            )}
          </div>
        )}

        {/* Call to Action - Premium Feature */}
        {!loading && !error && artists.length > 0 && (
          <div className="mt-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-xl p-8 text-center border border-purple-200">
            <div className="max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Want to showcase your young artist?</h3>
              <p className="text-gray-700 mb-6">
                Premium members can create artist profiles, upload sketches, and transform them into story characters using AI
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/my-artists"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                >
                  Create Artist Profile
                </Link>
                <Link
                  href="/upgrade"
                  className="bg-white text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 font-semibold shadow-lg hover:shadow-xl transition-all border-2 border-gray-300 transform hover:-translate-y-1"
                >
                  Upgrade to Premium
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
