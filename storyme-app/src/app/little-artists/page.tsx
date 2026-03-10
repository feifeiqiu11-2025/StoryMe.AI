/**
 * Little Artists Gallery Page
 * Public gallery showcasing characters shared by the community
 * Shows "Original Creation vs In the Story" side-by-side
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';
import { createClient } from '@/lib/supabase/client';

/* COMMENTED OUT - Artist profile feature (keeping for future use)
import ArtistSectionCard from '@/components/little-artists/ArtistSectionCard';
import type { LittleArtist, ArtistArtwork, ArtistWithArtworks } from '@/lib/types/artist';
*/

interface PublicCharacter {
  id: string;
  name: string;
  reference_image_url: string;
  animated_preview_url: string;
  created_at: string;
}

export default function LittleArtistsGalleryPage() {
  const [characters, setCharacters] = useState<PublicCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<PublicCharacter | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /* COMMENTED OUT - Artist profile state (keeping for future use)
  const [artists, setArtists] = useState<ArtistWithArtworks[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredArtists = artists.filter(artist => {
    const query = searchQuery.toLowerCase();
    return (
      artist.name.toLowerCase().includes(query) ||
      artist.bio?.toLowerCase().includes(query)
    );
  });

  const featuredArtists = filteredArtists.filter(a => a.featured);
  const regularArtists = filteredArtists.filter(a => !a.featured);
  */

  useEffect(() => {
    loadPublicCharacters();
    checkAuthStatus();
  }, []);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCharacter(null);
    };
    if (selectedCharacter) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedCharacter]);

  const checkAuthStatus = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    } catch {
      setIsLoggedIn(false);
    }
  };

  const loadPublicCharacters = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/public-characters');
      if (!response.ok) {
        throw new Error('Failed to load characters');
      }

      const data = await response.json();
      setCharacters(data.characters || []);
    } catch (err) {
      console.error('Error loading public characters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load characters');
    } finally {
      setLoading(false);
    }
  };

  /* COMMENTED OUT - Artist profile data loading (keeping for future use)
  const loadArtistsWithArtworks = async () => {
    try {
      setLoading(true);

      const artistsResponse = await fetch('/api/little-artists');
      if (!artistsResponse.ok) {
        throw new Error('Failed to load artists');
      }
      const artistsData = await artistsResponse.json();
      const fetchedArtists: LittleArtist[] = artistsData.artists || [];

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
  */

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Little Artists Gallery
          </h1>
          <p className="text-gray-600 text-lg">
            Celebrating creativity from young artists in our community.
            Kids create their characters, and KindleWood brings them to life in stories!
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
                <div className="p-4 pb-2">
                  <div className="h-5 bg-gray-200 rounded w-2/3" />
                </div>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="aspect-square bg-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="aspect-square bg-gray-200 rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <p className="text-red-600 text-lg mb-4">Failed to load gallery</p>
            <button
              onClick={loadPublicCharacters}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Character Grid */}
        {!loading && !error && characters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character) => (
              <div
                key={character.id}
                onClick={() => setSelectedCharacter(character)}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              >
                <div className="p-4 pb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {character.name}
                  </h3>
                </div>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Original Creation</p>
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={character.reference_image_url}
                          alt={`${character.name} - original`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">In the Story</p>
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={character.animated_preview_url}
                          alt={`${character.name} - in story`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && characters.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <h3 className="text-xl font-bold text-gray-900 mb-2">No artworks shared yet</h3>
            <p className="text-gray-600">
              Be the first to share your character creations with the community!
            </p>
          </div>
        )}

        {/* Footer - How to share */}
        {!loading && !error && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Want to showcase your artwork here?
              </h3>
              <p className="text-gray-600 mb-4">
                Create characters in your Character Library and tap the share icon
                to make them visible in this gallery.
              </p>
              {isLoggedIn ? (
                <Link
                  href="/characters"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Go to Character Library &rarr;
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign Up Free &rarr;
                </Link>
              )}
            </div>
          </div>
        )}

        {/* COMMENTED OUT - Artist profile search bar (keeping for future use)
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
              {filteredArtists.length} {filteredArtists.length === 1 ? 'artist' : 'artists'}
              {featuredArtists.length > 0 && ` · ${featuredArtists.length} featured`}
            </div>
          )}
        </div>
        */}

        {/* COMMENTED OUT - Featured artists section (keeping for future use)
        {!loading && !error && featuredArtists.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
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
        */}

        {/* COMMENTED OUT - Regular artists section (keeping for future use)
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
        */}

        {/* COMMENTED OUT - Artist profile empty state (keeping for future use)
        {!loading && !error && filteredArtists.length === 0 && (
          <div className="text-center py-16">
            {searchQuery ? (
              <>
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
        */}

        {/* COMMENTED OUT - Premium CTA footer (keeping for future use)
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
        */}
      </div>

      {/* Lightbox Modal */}
      {selectedCharacter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedCharacter(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCharacter.name}
              </h2>
              <button
                onClick={() => setSelectedCharacter(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Original Creation</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img
                      src={selectedCharacter.reference_image_url}
                      alt={`${selectedCharacter.name} - original creation`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">In the Story</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img
                      src={selectedCharacter.animated_preview_url}
                      alt={`${selectedCharacter.name} - in the story`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
