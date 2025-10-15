/**
 * Authenticated Story Creation Page
 * For logged-in users to create stories with character library
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import CharacterManager from '@/components/story/CharacterManager';
import ScriptInput from '@/components/story/ScriptInput';
import GenerationProgress from '@/components/story/GenerationProgress';
import ImageGallery from '@/components/story/ImageGallery';
import { Character, Scene, StorySession, GeneratedImage } from '@/lib/types/story';
import { parseScriptIntoScenes } from '@/lib/scene-parser';
import Link from 'next/link';
import { generateAndDownloadStoryPDF } from '@/lib/services/pdf.service';

const CHARACTERS_STORAGE_KEY = 'storyme_character_library';

export default function CreateStoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Story creation state
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scriptInput, setScriptInput] = useState('');
  const [parsedScenes, setParsedScenes] = useState<Scene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imageGenerationStatus, setImageGenerationStatus] = useState<GeneratedImage[]>([]);
  const [session, setSession] = useState<StorySession | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [libraryCharacters, setLibraryCharacters] = useState<Character[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (supabaseUser) {
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
          });
        } else {
          router.push('/login');
        }
      } else {
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
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

  const handleCharactersChange = (newCharacters: Character[]) => {
    setCharacters(newCharacters);
  };

  const loadLibraryCharacters = async (userId: string) => {
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

      setLibraryCharacters(transformedCharacters);
    } catch (error) {
      console.error('Error loading library characters:', error);
      setLibraryCharacters([]);
    }
  };

  const handleImportCharacter = (character: Character) => {
    // Check if character already exists
    const exists = characters.find(c => c.id === character.id);
    if (exists) {
      alert('This character is already added to your story');
      return;
    }

    // Add character to story
    const importedCharacter = {
      ...character,
      order: characters.length + 1,
    };
    setCharacters([...characters, importedCharacter]);
    setShowImportModal(false);
  };

  const handleScriptSubmit = () => {
    if (!scriptInput.trim()) return;

    const scenes = parseScriptIntoScenes(scriptInput, characters);
    setParsedScenes(scenes);

    // Create session
    const newSession: StorySession = {
      id: Date.now().toString(),
      userId: user?.id,
      characters,
      scenes,
      createdAt: new Date(),
    };
    setSession(newSession);
  };

  const handleSaveStory = async () => {
    if (!saveTitle.trim()) {
      setSaveError('Please enter a title for your story');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      // Prepare scenes data
      const scenesData = imageGenerationStatus
        .filter(img => img.status === 'completed')
        .map(img => ({
          sceneNumber: img.sceneNumber,
          description: img.sceneDescription,
          imageUrl: img.imageUrl,
          prompt: img.prompt,
          generationTime: img.generationTime,
        }));

      if (scenesData.length === 0) {
        setSaveError('No completed scenes to save');
        setIsSaving(false);
        return;
      }

      // Call save API
      const response = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveTitle.trim(),
          description: saveDescription.trim() || undefined,
          originalScript: scriptInput,
          characterIds: characters.map(c => c.id),
          scenes: scenesData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save story');
      }

      // Success! Redirect to My Stories page
      router.push('/projects');

    } catch (error) {
      console.error('Save error:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save story');
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    const completedScenes = imageGenerationStatus.filter(img => img.status === 'completed');

    if (completedScenes.length === 0) {
      alert('No completed scenes to generate PDF');
      return;
    }

    setGeneratingPDF(true);

    try {
      // Generate default title if not set
      const title = saveTitle || scriptInput.trim().split(' ').slice(0, 5).join(' ') || 'My Story';

      const scenesData = completedScenes.map(img => ({
        sceneNumber: img.sceneNumber,
        description: img.sceneDescription,
        imageUrl: img.imageUrl,
      }));

      await generateAndDownloadStoryPDF({
        title,
        description: saveDescription,
        scenes: scenesData,
        author: user?.name || 'My Family',
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!session || parsedScenes.length === 0) return;

    setIsGenerating(true);

    // Initialize image generation status for all scenes
    const initialStatus = parsedScenes.map((scene, index) => ({
      id: `temp-${index}`,
      sceneId: scene.id || `scene-${index}`,
      sceneNumber: scene.sceneNumber || index + 1,
      sceneDescription: scene.description || '',
      imageUrl: '',
      prompt: '', // Will be filled by the API
      generationTime: 0,
      status: 'pending' as const,
    }));
    setImageGenerationStatus(initialStatus);

    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characters: characters,
          script: scriptInput,
          artStyle: "children's book illustration, colorful, whimsical",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      // Update the image generation status with the actual results
      if (data.generatedImages) {
        setImageGenerationStatus(data.generatedImages);
      }

      // Extract image URLs for the gallery
      const imageUrls = data.generatedImages?.map((img: any) => img.imageUrl).filter(Boolean) || [];
      setGeneratedImages(imageUrls);
    } catch (error) {
      console.error('Generation error:', error);
      // Mark all as failed
      setImageGenerationStatus(initialStatus.map(img => ({
        ...img,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Generation failed',
      })));
    } finally {
      setIsGenerating(false);
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
              <Link href="/characters" className="text-gray-600 hover:text-gray-900 font-medium">
                Characters
              </Link>
              <Link href="/create" className="text-blue-600 font-semibold border-b-2 border-blue-600">
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Story</h1>
          <p className="text-gray-600">
            Add your characters, write your story scenes, and generate beautiful illustrations!
          </p>
        </div>

        {/* Step 1: Character Management */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Story Characters</h2>
            <button
              onClick={async () => {
                if (user?.id) {
                  await loadLibraryCharacters(user.id);
                  setShowImportModal(true);
                }
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium text-sm shadow transition-all"
            >
              Import from Library
            </button>
          </div>
          <CharacterManager
            characters={characters}
            onCharactersChange={handleCharactersChange}
          />
        </div>

        {/* Import Character Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Import from Character Library</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {libraryCharacters.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👦👧</div>
                  <p className="text-gray-600 mb-4">No characters in your library yet!</p>
                  <Link
                    href="/characters"
                    className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
                  >
                    Go to Character Library
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {libraryCharacters.map((character) => (
                    <div
                      key={character.id}
                      className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all"
                    >
                      {character.referenceImage.url ? (
                        <div className="h-32 bg-gradient-to-br from-blue-100 to-purple-100">
                          <img
                            src={character.referenceImage.url}
                            alt={character.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-32 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                          <div className="text-4xl">👤</div>
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 mb-2">{character.name}</h3>
                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          {character.description.hairColor && <p>Hair: {character.description.hairColor}</p>}
                          {character.description.age && <p>Age: {character.description.age}</p>}
                        </div>
                        <button
                          onClick={() => handleImportCharacter(character)}
                          disabled={characters.some(c => c.id === character.id)}
                          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                        >
                          {characters.some(c => c.id === character.id) ? 'Already Added' : 'Import Character'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Script Input */}
        {characters.length > 0 && (
          <div className="mb-8">
            <ScriptInput
              value={scriptInput}
              onChange={setScriptInput}
              characters={characters}
            />

            {/* Generate Story Button */}
            {scriptInput.trim() && parsedScenes.length === 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-8 mt-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Ready to Generate Your Story?
                </h3>
                <p className="text-gray-600 mb-6">
                  Review your characters and scenes, then click below to parse your story and prepare for illustration.
                </p>
                <button
                  onClick={handleScriptSubmit}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:from-purple-700 hover:to-pink-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
                >
                  Generate Story Scenes
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview Parsed Scenes */}
        {parsedScenes.length > 0 && generatedImages.length === 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Story Scenes Preview
            </h3>
            <div className="space-y-4 mb-6">
              {parsedScenes.map((scene, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-blue-700">Scene {index + 1}</span>
                    {scene.characterNames && scene.characterNames.length > 0 && (
                      <span className="text-sm text-gray-600">
                        ({scene.characterNames.join(', ')})
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700">{scene.description}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setParsedScenes([]);
                  setSession(null);
                }}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
              >
                ← Edit Scenes
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Generate Images */}
        {parsedScenes.length > 0 && !isGenerating && generatedImages.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Ready to Generate Images?
            </h3>
            <p className="text-gray-600 mb-6">
              You have {parsedScenes.length} scenes ready. Click below to generate AI illustrations!
            </p>
            <button
              onClick={handleGenerateImages}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Generate {parsedScenes.length} Images
            </button>
          </div>
        )}

        {/* Generation Progress */}
        {isGenerating && (
          <div className="mb-8">
            <GenerationProgress
              images={imageGenerationStatus}
              totalScenes={parsedScenes.length}
            />
          </div>
        )}

        {/* Generated Images */}
        {imageGenerationStatus.length > 0 && imageGenerationStatus.some(img => img.status === 'completed') && (
          <div className="mb-8">
            <ImageGallery
              generatedImages={imageGenerationStatus}
              characters={characters}
            />

            {/* Save & Export Options */}
            <div className="bg-white rounded-2xl shadow-xl p-8 mt-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Your Story is Ready! 🎉
              </h3>
              <p className="text-gray-600 mb-6">
                Save your story to your library or export it as a PDF.
              </p>
              <div className="flex gap-4 flex-wrap">
                <button
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    // Generate default title if not set
                    if (!saveTitle) {
                      const firstWords = scriptInput.trim().split(' ').slice(0, 5).join(' ');
                      setSaveTitle(firstWords || 'My Story');
                    }
                    setShowSaveModal(true);
                  }}
                  disabled={isSaving}
                >
                  💾 Save to Library
                </button>
                <button
                  className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                >
                  {generatingPDF ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating PDF...
                    </span>
                  ) : (
                    '📄 Download PDF'
                  )}
                </button>
                <Link
                  href="/dashboard"
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all flex items-center"
                >
                  ← Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Save Story Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Save Your Story</h2>
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setSaveError('');
                  }}
                  disabled={isSaving}
                  className="text-gray-400 hover:text-gray-600 text-2xl disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Story Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    disabled={isSaving}
                    placeholder="Enter a title for your story"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    disabled={isSaving}
                    placeholder="Add a brief description of your story"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                {saveError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{saveError}</p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    This will save your story with {imageGenerationStatus.filter(img => img.status === 'completed').length} scenes to your library.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveStory}
                  disabled={isSaving || !saveTitle.trim()}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </span>
                  ) : (
                    '💾 Save Story'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setSaveError('');
                  }}
                  disabled={isSaving}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
