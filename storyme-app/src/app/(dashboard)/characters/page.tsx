/**
 * Character Library Page
 * Manage and reuse characters across stories
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Character } from '@/lib/types/story';
import Link from 'next/link';
import Image from 'next/image';

const CHARACTERS_STORAGE_KEY = 'storyme_character_library';

// Helper to ensure user exists in database
async function ensureUserExists(userId: string, email?: string, name?: string) {
  const supabase = createClient();

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (existingUser) {
    return { success: true, created: false };
  }

  // Create user if doesn't exist
  const { error } = await supabase
    .from('users')
    .insert([{
      id: userId,
      email: email || `user-${userId}@storyme.app`,
      name: name || 'StoryMe User',
      subscription_tier: 'free'
    }]);

  if (error && error.code !== '23505') { // Ignore duplicate key error
    console.error('Error creating user:', error);
    return { success: false, error };
  }

  return { success: true, created: true };
}

export default function CharactersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showNewCharacterForm, setShowNewCharacterForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    hairColor: '',
    skinTone: '',
    clothing: '',
    age: '',
    otherFeatures: '',
    imageUrl: '',
    imageFileName: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);

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
      setFormData({
        name: character.name,
        hairColor: character.description.hairColor || '',
        skinTone: character.description.skinTone || '',
        clothing: character.description.clothing || '',
        age: character.description.age || '',
        otherFeatures: character.description.otherFeatures || '',
        imageUrl: character.referenceImage.url,
        imageFileName: character.referenceImage.fileName,
      });
    } else {
      setEditingCharacter(null);
      setFormData({
        name: '',
        hairColor: '',
        skinTone: '',
        clothing: '',
        age: '',
        otherFeatures: '',
        imageUrl: '',
        imageFileName: '',
      });
    }
    setShowNewCharacterForm(true);
  };

  const handleCloseForm = () => {
    setShowNewCharacterForm(false);
    setEditingCharacter(null);
    setUploadingImage(false);
    setFormData({
      name: '',
      hairColor: '',
      skinTone: '',
      clothing: '',
      age: '',
      otherFeatures: '',
      imageUrl: '',
      imageFileName: '',
    });
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      setFormData({
        ...formData,
        imageUrl: data.url,
        imageFileName: file.name,
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveCharacter = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a character name');
      return;
    }

    if (!user?.id) {
      alert('User not found');
      return;
    }

    try {
      // Ensure user exists in database first
      console.log('Ensuring user exists...', { userId: user.id, email: user.email, name: user.name });
      const userResult = await ensureUserExists(user.id, user.email, user.name);
      console.log('User ensure result:', userResult);

      const supabase = createClient();

      const characterData = {
        user_id: user.id,
        name: formData.name.trim(),
        reference_image_url: formData.imageUrl || null,
        reference_image_filename: formData.imageFileName || null,
        hair_color: formData.hairColor || null,
        skin_tone: formData.skinTone || null,
        clothing: formData.clothing || null,
        age: formData.age || null,
        other_features: formData.otherFeatures || null,
      };

      console.log('Saving character data:', characterData);

      let result;
      if (editingCharacter) {
        // Update existing character
        result = await supabase
          .from('character_library')
          .update(characterData)
          .eq('id', editingCharacter.id)
          .select();

        console.log('Update result:', result);
        if (result.error) throw result.error;
      } else {
        // Insert new character
        result = await supabase
          .from('character_library')
          .insert([characterData])
          .select();

        console.log('Insert result:', result);
        if (result.error) throw result.error;
      }

      // Reload characters
      await loadCharacters(user.id);
      handleCloseForm();
    } catch (error: any) {
      console.error('Error saving character:', error);
      const errorMessage = error?.message || 'Failed to save character. Please try again.';
      alert(`Error: ${errorMessage}\n\nPlease check the browser console for more details.`);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header Navigation */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-2xl font-bold">
              Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Me</span>
            </Link>
            <nav className="flex gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium">
                Dashboard
              </Link>
              <Link href="/projects" className="text-gray-600 hover:text-gray-900 font-medium">
                My Stories
              </Link>
              <Link href="/characters" className="text-blue-600 font-semibold border-b-2 border-blue-600">
                Characters
              </Link>
              <Link href="/create" className="text-gray-600 hover:text-gray-900 font-medium">
                Create Story
              </Link>
            </nav>
          </div>
          <div className="text-sm text-gray-600">
            {user.name}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
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

        {/* Character Form Modal */}
        {showNewCharacterForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingCharacter ? 'Edit Character' : 'Create New Character'}
                </h2>
                <button
                  onClick={handleCloseForm}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Character Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Character Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Connor, Emma, Max"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Image (optional)
                  </label>

                  {formData.imageUrl ? (
                    <div className="relative">
                      <img
                        src={formData.imageUrl}
                        alt="Character preview"
                        className="w-full h-48 object-cover rounded-lg border-2 border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '', imageFileName: '' })}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg"
                      >
                        ✕
                      </button>
                      <p className="text-xs text-gray-600 mt-1">{formData.imageFileName}</p>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('image-upload-input')?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                        const files = e.dataTransfer.files;
                        if (files.length > 0) {
                          handleImageUpload(files[0]);
                        }
                      }}
                    >
                      <input
                        id="image-upload-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            handleImageUpload(files[0]);
                          }
                        }}
                      />
                      {uploadingImage ? (
                        <div>
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">Uploading...</p>
                        </div>
                      ) : (
                        <div>
                          <div className="text-4xl mb-2">📷</div>
                          <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Character Description Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hair Color
                    </label>
                    <input
                      type="text"
                      value={formData.hairColor}
                      onChange={(e) => setFormData({ ...formData, hairColor: e.target.value })}
                      placeholder="e.g., brown, blonde"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Age
                    </label>
                    <input
                      type="text"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="e.g., 8 years old"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Skin Tone
                  </label>
                  <input
                    type="text"
                    value={formData.skinTone}
                    onChange={(e) => setFormData({ ...formData, skinTone: e.target.value })}
                    placeholder="e.g., light, tan, dark"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clothing
                  </label>
                  <input
                    type="text"
                    value={formData.clothing}
                    onChange={(e) => setFormData({ ...formData, clothing: e.target.value })}
                    placeholder="e.g., blue shirt, red jacket"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Other Features
                  </label>
                  <textarea
                    value={formData.otherFeatures}
                    onChange={(e) => setFormData({ ...formData, otherFeatures: e.target.value })}
                    placeholder="e.g., glasses, freckles, curly hair"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleCloseForm}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCharacter}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
                >
                  {editingCharacter ? 'Update Character' : 'Save Character'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                {character.referenceImage.url ? (
                  <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
                    <img
                      src={character.referenceImage.url}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <div className="text-6xl">👤</div>
                  </div>
                )}

                {/* Character Info */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {character.name}
                  </h3>

                  {/* Character Details */}
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    {character.description.hairColor && (
                      <p>Hair: {character.description.hairColor}</p>
                    )}
                    {character.description.age && (
                      <p>Age: {character.description.age}</p>
                    )}
                    {character.description.skinTone && (
                      <p>Skin: {character.description.skinTone}</p>
                    )}
                    {character.description.clothing && (
                      <p className="text-xs">Clothing: {character.description.clothing}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href="/create"
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm text-center"
                    >
                      Use in Story
                    </Link>
                    <button
                      onClick={() => handleOpenForm(character)}
                      className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 font-medium text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCharacter(character.id)}
                      className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 font-medium text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
