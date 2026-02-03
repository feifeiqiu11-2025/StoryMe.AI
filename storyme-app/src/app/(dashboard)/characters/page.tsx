/**
 * Character Library Page (Refactored)
 * Uses UnifiedCharacterFormModal for all character creation/editing
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Character } from '@/lib/types/story';
import Link from 'next/link';
import UnifiedCharacterFormModal from '@/components/characters/UnifiedCharacterFormModal';

export default function CharactersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showNewCharacterForm, setShowNewCharacterForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  // Load characters from database
  const loadCharacters = async (userId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('character_library')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform database records to Character type
      const transformedCharacters: Character[] = (data || []).map((char: any) => ({
        id: char.id,
        name: char.name,
        referenceImage: {
          url: char.reference_image_url || '',
          fileName: char.reference_image_filename || '',
        },
        animatedPreviewUrl: char.animated_preview_url || undefined,
        sketchImageUrl: char.sketch_image_url || undefined,
        description: {
          hairColor: char.hair_color,
          skinTone: char.skin_tone,
          clothing: char.clothing,
          age: char.age,
          otherFeatures: char.other_features,
        },
        isPrimary: false,
        order: 0,
      }));

      setCharacters(transformedCharacters);
    } catch (error) {
      console.error('Error loading characters:', error);
      setCharacters([]);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (supabaseUser) {
          const userData = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
          };
          setUser(userData);
          await loadCharacters(supabaseUser.id);
        } else {
          router.push('/login');
        }
      } else {
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
            await loadCharacters(session.user.id);
          } else {
            localStorage.removeItem('storyme_session');
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [router]);

  const handleOpenForm = (character?: Character) => {
    if (character) {
      setEditingCharacter(character);
    } else {
      setEditingCharacter(null);
    }
    setShowNewCharacterForm(true);
  };

  const handleCloseForm = () => {
    setShowNewCharacterForm(false);
    setEditingCharacter(null);
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm('Are you sure you want to delete this character?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('character_library')
        .delete()
        .eq('id', characterId);

      if (error) throw error;

      // Reload characters
      if (user?.id) {
        await loadCharacters(user.id);
      }
    } catch (error) {
      console.error('Error deleting character:', error);
      alert('Failed to delete character. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Character Library</h1>
          <p className="text-gray-600">
            Save and reuse characters across multiple stories
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          + New Character
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="text-3xl">💡</div>
          <div>
            <h3 className="font-bold text-gray-900 mb-2">How Character Library Works</h3>
            <ul className="text-gray-700 space-y-1 text-sm">
              <li>✅ Create characters once, reuse them in multiple stories</li>
              <li>✅ Upload photos and descriptions for consistent illustrations</li>
              <li>✅ Track character usage across your storybooks</li>
              <li>✅ Edit or delete characters anytime</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Unified Character Form Modal */}
      <UnifiedCharacterFormModal
        isOpen={showNewCharacterForm}
        onClose={handleCloseForm}
        onSave={async () => {
          // Library mode handles saving internally, just need to reload
        }}
        editingCharacter={editingCharacter}
        mode="library"
        userId={user?.id}
        onReloadCharacters={() => loadCharacters(user.id)}
      />

      {/* Characters Grid */}
      {characters.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <div className="text-6xl mb-4">👦👧</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Characters Yet
          </h2>
          <p className="text-gray-600 mb-6">
            Click "New Character" above or create your first story to start building your character library!
          </p>
          <Link
            href="/create"
            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Create a Story
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {characters.map((character) => (
            <div
              key={character.id}
              className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
              {/* Character Image */}
              {character.referenceImage.url || character.animatedPreviewUrl ? (
                <div className="relative h-56 bg-gradient-to-br from-blue-100 to-purple-100">
                  <img
                    src={character.animatedPreviewUrl || character.referenceImage.url}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-56 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <div className="text-6xl">👤</div>
                </div>
              )}

              {/* Character Info */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{character.name}</h3>

                {/* Description Summary */}
                <div className="text-sm text-gray-600 space-y-1 mb-4">
                  {character.description.age && (
                    <p>Age: {character.description.age}</p>
                  )}
                  {character.description.hairColor && (
                    <p>Hair: {character.description.hairColor}</p>
                  )}
                  {character.description.otherFeatures && (
                    <p className="line-clamp-2">{character.description.otherFeatures}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenForm(character)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCharacter(character.id)}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
