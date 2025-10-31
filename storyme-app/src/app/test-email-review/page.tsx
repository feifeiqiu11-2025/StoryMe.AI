/**
 * Test Email Review Page
 * Simulates the admin email with approve/reject buttons
 * Access: /test-email-review
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Artist {
  id: string;
  name: string;
  age?: number;
  bio?: string;
  profile_photo_url?: string;
  parent_consent_text: string;
  parent_consent_date: string;
}

interface Artwork {
  id: string;
  character_name?: string;
  description?: string;
  original_sketch_url: string;
  animated_version_url?: string;
}

export default function TestEmailReviewPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artworks, setArtworks] = useState<Record<string, Artwork[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPendingArtists();
  }, []);

  const loadPendingArtists = async () => {
    try {
      // Use admin API to fetch all pending artists (only accessible by feifei_qiu@hotmail.com)
      const response = await fetch('/api/admin/pending-artists', {
        credentials: 'include',
      });

      console.log('Admin API Response status:', response.status);

      if (response.status === 403) {
        setError('Access denied. Only admin (feifei_qiu@hotmail.com) can access this page.');
        setLoading(false);
        return;
      }

      if (response.status === 401) {
        setError('Please sign in with admin account (feifei_qiu@hotmail.com) to access this page.');
        setLoading(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        console.log('Admin API Response data:', data);
        const pendingArtists = data.artists || [];
        setArtists(pendingArtists);
        console.log('Pending artists:', pendingArtists);

        // Fetch artworks for each artist
        for (const artist of pendingArtists) {
          const artworksResponse = await fetch(`/api/little-artists/${artist.id}/artworks`);
          if (artworksResponse.ok) {
            const artworksData = await artworksResponse.json();
            setArtworks(prev => ({
              ...prev,
              [artist.id]: artworksData.artworks || []
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReviewUrl = (artistId: string, action: 'approve' | 'reject') => {
    // In real email, this would have a secure token
    // For testing, we'll create a simple mock token
    // Convert to base64url (browser-compatible)
    const tokenData = `${artistId}:${Date.now()}:mock`;
    const base64 = btoa(tokenData);
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `/api/little-artists/${artistId}/review?action=${action}&token=${base64url}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pending artists...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <Link
              href="/api/auth/signin"
              className="block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
            >
              Sign In
            </Link>
            <Link
              href="/my-artists"
              className="block px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
            >
              Go to My Artists
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Pending Reviews</h2>
          <p className="text-gray-600 mb-6">
            There are no artist profiles waiting for review at the moment.
          </p>
          <Link
            href="/my-artists"
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
          >
            Go to My Artists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📧 Admin Review Dashboard
          </h1>
          <p className="text-gray-600 mb-2">
            This page simulates what the admin would receive via email.
            Click on an artist to see their email preview.
          </p>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
            <span className="font-semibold text-purple-900">Admin Only:</span>{' '}
            <span className="text-purple-700">feifei_qiu@hotmail.com</span>
          </div>
        </div>

        {/* Artist List */}
        <div className="grid gap-4 mb-8">
          {artists.map((artist) => (
            <div
              key={artist.id}
              onClick={() => setSelectedArtist(artist)}
              className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
                selectedArtist?.id === artist.id ? 'ring-2 ring-purple-600' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 flex-shrink-0">
                  {artist.profile_photo_url ? (
                    <img src={artist.profile_photo_url} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🎨</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{artist.name}</h3>
                  <p className="text-sm text-gray-600">
                    Age {artist.age || 'N/A'} • {artworks[artist.id]?.length || 0} artworks
                  </p>
                </div>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold">
                  View Email →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Email Preview */}
        {selectedArtist && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Email Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-8">
              <h2 className="text-2xl font-bold mb-2">🎨 New Little Artist Awaiting Review</h2>
              <p className="text-purple-100">Review and approve directly from this email</p>
            </div>

            {/* Email Content */}
            <div className="p-8">
              {/* Artist Profile */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6 flex gap-6 items-center">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 flex-shrink-0 border-4 border-purple-600">
                  {selectedArtist.profile_photo_url ? (
                    <img src={selectedArtist.profile_photo_url} alt={selectedArtist.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">🎨</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedArtist.name}</h3>
                  <div className="space-y-1 text-sm">
                    <div><strong>Age:</strong> {selectedArtist.age || 'Not specified'}</div>
                    <div><strong>Artworks:</strong> {artworks[selectedArtist.id]?.length || 0} uploaded</div>
                    <div><strong>Submitted:</strong> {new Date(selectedArtist.parent_consent_date).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              {selectedArtist.bio && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-700">
                    <strong>Bio:</strong> {selectedArtist.bio}
                  </p>
                </div>
              )}

              {/* Consent Statement */}
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-2">Parental Consent Statement</h4>
                <div className="bg-white border-l-4 border-purple-600 p-4 italic text-gray-700">
                  "{selectedArtist.parent_consent_text}"
                </div>
              </div>

              {/* Artworks */}
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-4">
                  Artworks ({artworks[selectedArtist.id]?.length || 0})
                </h4>
                <div className="space-y-4">
                  {artworks[selectedArtist.id]?.map((artwork) => (
                    <div key={artwork.id} className="border border-gray-200 rounded-lg p-4">
                      <h5 className="font-semibold text-gray-900 mb-3">
                        {artwork.character_name || 'Untitled'}
                      </h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-gray-600 mb-2">ORIGINAL SKETCH</p>
                          <img
                            src={artwork.original_sketch_url}
                            alt="Original"
                            className="w-full rounded-lg border border-gray-300"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-600 mb-2">AI TRANSFORMED</p>
                          {artwork.animated_version_url ? (
                            <img
                              src={artwork.animated_version_url}
                              alt="Transformed"
                              className="w-full rounded-lg border border-gray-300"
                            />
                          ) : (
                            <div className="w-full aspect-square bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center text-xs text-gray-500">
                              No transformation
                            </div>
                          )}
                        </div>
                      </div>
                      {artwork.description && (
                        <p className="text-sm text-gray-600 mt-3">{artwork.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="text-center space-x-4">
                <a
                  href={generateReviewUrl(selectedArtist.id, 'approve')}
                  className="inline-block px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg text-lg transition-colors"
                >
                  ✅ Approve & Publish
                </a>
                <a
                  href={generateReviewUrl(selectedArtist.id, 'reject')}
                  className="inline-block px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-lg transition-colors"
                >
                  ❌ Reject
                </a>
              </div>

              <p className="text-center text-xs text-gray-500 mt-6">
                This review link is valid for 30 days.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
