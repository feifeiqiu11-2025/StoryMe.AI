/**
 * My Artists Dashboard
 * For premium parents to manage their little artist profiles
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LittleArtist, ArtistWithArtworks } from '@/lib/types/artist';
import ArtistSectionCard from '@/components/little-artists/ArtistSectionCard';
import Link from 'next/link';

export default function MyArtistsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [artists, setArtists] = useState<ArtistWithArtworks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndArtists();
  }, []);

  const loadUserAndArtists = async () => {
    try {
      const supabase = createClient();

      // Get authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        router.push('/login');
        return;
      }

      setUser(authUser);

      // Check premium subscription
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', authUser.id)
        .single();

      if (!['basic', 'premium', 'team'].includes(userData?.subscription_tier || '')) {
        router.push('/upgrade?feature=little-artists');
        return;
      }

      // Load artists
      const artistsResponse = await fetch(`/api/little-artists?parent_user_id=${authUser.id}`, {
        credentials: 'include',
      });

      if (!artistsResponse.ok) {
        throw new Error('Failed to load artists');
      }

      const artistsData = await artistsResponse.json();
      const fetchedArtists: LittleArtist[] = artistsData.artists || [];

      // Fetch artworks for each artist
      const artistsWithArtworks = await Promise.all(
        fetchedArtists.map(async (artist) => {
          try {
            const artworksResponse = await fetch(`/api/little-artists/${artist.id}/artworks`, {
              credentials: 'include',
            });
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
          <div className="text-gray-700">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const canCreateMore = artists.filter(a => a.status !== 'archived').length < 3;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Little Artists</h1>
        <p className="text-gray-600">
          Manage your young artists' profiles and share their creative work with the community
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">About Little Artists</h3>
            <p className="text-sm text-gray-700">
              Share your child's artwork with the KindleWood Studio community! Transform their sketches into
              animated characters that other users can use in their stories. Each artist can upload up to 20 artworks,
              and you can create profiles for up to 3 young artists.
            </p>
          </div>
        </div>
      </div>

      {/* Create New Button */}
      {canCreateMore && (
        <div className="mb-6">
          <Link
            href="/my-artists/new"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Artist Profile
          </Link>
          <span className="ml-3 text-sm text-gray-600">
            ({artists.filter(a => a.status !== 'archived').length}/3 profiles created)
          </span>
        </div>
      )}

      {/* Artists Sections */}
      {artists.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🎨</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">No Artists Yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first little artist profile to start sharing their creative work!
          </p>
          <Link
            href="/my-artists/new"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create First Artist
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {artists.map((artist) => (
            <ArtistSectionCard
              key={artist.id}
              artist={artist}
              artworks={artist.artworks}
              isOwnerView={true}
              onArtworkDeleted={loadUserAndArtists}
            />
          ))}
        </div>
      )}

      {/* Limit Reached */}
      {!canCreateMore && artists.length > 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">Artist Limit Reached</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            You've created the maximum of 3 artist profiles. Archive an existing artist to create a new one.
          </p>
        </div>
      )}
    </div>
  );
}
