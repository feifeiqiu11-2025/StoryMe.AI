'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CharacterManager from '@/components/story/CharacterManager';
import ScriptInput from '@/components/story/ScriptInput';
import StorySettingsPanel from '@/components/story/StorySettingsPanel';
import EnhancementPreview from '@/components/story/EnhancementPreview';
import GenerationProgress from '@/components/story/GenerationProgress';
import ImageGallery from '@/components/story/ImageGallery';
import GuestSignupModal from '@/components/auth/GuestSignupModal';
import { StorySession, StoryTone, EnhancedScene } from '@/lib/types/story';
import { validateScript, parseScriptIntoScenes, validateCharacterReferences } from '@/lib/scene-parser';
import { saveGuestStory, getGuestStory, saveGuestStoryToAccount } from '@/lib/utils/guest-story-storage';
import { createClient } from '@/lib/supabase/client';

const ART_STYLE = "children's book illustration, colorful, whimsical";

export default function GuestStoryPage() {
  const router = useRouter();
  const [session, setSession] = useState<StorySession>({
    characters: [],
    script: '',
    scenes: [],
    generatedImages: [],
    status: 'idle',
    artStyle: ART_STYLE,
  });

  // Story settings (NEW)
  const [readingLevel, setReadingLevel] = useState<number>(5);
  const [storyTone, setStoryTone] = useState<StoryTone>('playful');

  // Enhancement state (NEW)
  const [enhancedScenes, setEnhancedScenes] = useState<EnhancedScene[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [signupAction, setSignupAction] = useState<'save' | 'download'>('save');

  // Check for authenticated user and restore guest story
  useEffect(() => {
    async function checkAuthAndRestoreStory() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // User is authenticated - check for saved guest story
        const guestStory = getGuestStory();

        if (guestStory && guestStory.generatedImages.length > 0) {
          console.log('Found guest story with images, redirecting to /create page...');

          // Story will be preserved in sessionStorage, just redirect to authenticated create page
          // The /create page should check for guest story and restore it
          router.push('/create');
        } else {
          // User is authenticated but no completed guest story - redirect to dashboard
          // This covers: no guest story, or guest story without generated images
          console.log('No completed guest story found, redirecting to dashboard');
          router.push('/dashboard');
        }
      }
    }

    checkAuthAndRestoreStory();
  }, [router]);

  const handleCharactersChange = (characters: typeof session.characters) => {
    setSession(prev => ({
      ...prev,
      characters,
    }));
    setError(null);
  };

  const handleScriptChange = (newScript: string) => {
    setSession(prev => ({
      ...prev,
      script: newScript,
    }));
    setError(null);
  };

  // NEW: Handle AI scene enhancement
  const handleEnhanceScenes = async () => {
    if (!session.script.trim() || session.characters.length === 0) {
      setError('Please add characters and write scenes first');
      return;
    }

    setIsEnhancing(true);
    setError(null);

    try {
      // Parse raw script into scenes
      const rawScenes = parseScriptIntoScenes(session.script, session.characters);

      console.log(`Enhancing ${rawScenes.length} scenes with reading level ${readingLevel} and ${storyTone} tone`);

      // Call AI enhancement API
      const response = await fetch('/api/enhance-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: rawScenes.map(s => ({
            sceneNumber: s.sceneNumber,
            rawDescription: s.description,
            characterNames: s.characterNames || []
          })),
          readingLevel,
          storyTone,
          characters: session.characters,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Enhancement failed');
      }

      const { enhancedScenes: enhanced } = await response.json();
      console.log(`✓ Enhanced ${enhanced.length} scenes successfully`);

      setEnhancedScenes(enhanced);
    } catch (error) {
      console.error('Scene enhancement error:', error);
      setError(error instanceof Error ? error.message : 'Failed to enhance scenes');
    } finally {
      setIsEnhancing(false);
    }
  };

  // NEW: Handle caption edit
  const handleCaptionEdit = (sceneNumber: number, newCaption: string) => {
    setEnhancedScenes(prev =>
      prev.map(scene =>
        scene.sceneNumber === sceneNumber
          ? { ...scene, caption: newCaption }
          : scene
      )
    );
  };

  const handleGenerate = async () => {
    // Validate inputs
    if (session.characters.length === 0) {
      setError('Please add at least one character');
      return;
    }

    const missingPhotos = session.characters.filter(c => !c.referenceImage.url);
    if (missingPhotos.length > 0) {
      setError(`Please upload photos for: ${missingPhotos.map(c => c.name || 'Unnamed').join(', ')}`);
      return;
    }

    const missingNames = session.characters.filter(c => !c.name.trim());
    if (missingNames.length > 0) {
      setError('Please name all characters');
      return;
    }

    // Check if characters have at least one description field filled
    const incompleteDescriptions = session.characters.filter(c => {
      const desc = c.description;
      return !desc.hairColor && !desc.skinTone && !desc.clothing && !desc.age && !desc.otherFeatures;
    });
    if (incompleteDescriptions.length > 0) {
      const names = incompleteDescriptions.map(c => c.name).join(', ');
      setError(`Please add descriptions for: ${names}. Fill in at least hair color, clothing, or age.`);
      return;
    }

    const validation = validateScript(session.script);
    if (!validation.valid) {
      setError(validation.error || 'Invalid script');
      return;
    }

    const charValidation = validateCharacterReferences(session.script, session.characters);
    if (!charValidation.valid) {
      setError(charValidation.error || 'Invalid character references');
      return;
    }

    // Check if scenes have been enhanced
    if (enhancedScenes.length === 0) {
      setError('Please enhance scenes first');
      return;
    }

    setError(null);

    // Build enhanced script for image generation using enhanced prompts
    const enhancedScript = enhancedScenes.map(s => s.enhanced_prompt).join('\n');

    // Parse scenes for character references
    const scenes = parseScriptIntoScenes(session.script, session.characters);

    // Initialize generation with captions
    setSession(prev => ({
      ...prev,
      status: 'processing',
      scenes,
      generatedImages: scenes.map(scene => {
        const enhancedScene = enhancedScenes.find(es => es.sceneNumber === scene.sceneNumber);
        return {
          id: `img-${scene.id}`,
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          sceneDescription: enhancedScene?.caption || scene.description, // Use caption for display
          imageUrl: '',
          prompt: '',
          generationTime: 0,
          status: 'pending',
          characterRatings: scene.characterNames?.map(name => ({
            characterId: session.characters.find(c => c.name === name)?.id || '',
            characterName: name,
          })),
        };
      }),
    }));

    try {
      // Call the generation API with enhanced prompts
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characters: session.characters,
          script: enhancedScript, // Use enhanced prompts for image generation
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Generation failed');
      }

      const data = await response.json();

      // Update with results - preserve captions
      const updatedImages = data.generatedImages.map((img: any) => {
        const enhancedScene = enhancedScenes.find(es => es.sceneNumber === img.sceneNumber);
        return {
          ...img,
          sceneDescription: enhancedScene?.caption || img.sceneDescription,
        };
      });

      setSession(prev => ({
        ...prev,
        status: 'completed',
        generatedImages: updatedImages,
      }));

      if (data.errors && data.errors.length > 0) {
        setError(`Some images failed to generate: ${data.errors.join(', ')}`);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate images');
      setSession(prev => ({
        ...prev,
        status: 'error',
      }));
    }
  };

  const handleStartOver = () => {
    setSession({
      characters: [],
      script: '',
      scenes: [],
      generatedImages: [],
      status: 'idle',
      artStyle: ART_STYLE,
    });
    setError(null);
  };

  const handleSaveStory = async () => {
    // Check if user is authenticated
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // User is authenticated - save directly to their account
      console.log('Authenticated user, saving story to account...');

      try {
        const saved = await saveGuestStoryToAccount(user.id);

        if (saved) {
          alert('✅ Your story has been saved to your account!');
          // Redirect to dashboard after saving
          setTimeout(() => router.push('/dashboard'), 1000);
        } else {
          console.error('Failed to save story to account');
          alert('❌ Failed to save story. Please try again.');
        }
      } catch (error) {
        console.error('Error saving story:', error);

        // If unauthorized, the auth token might be stale - show signup modal
        if (error instanceof Error && error.message === 'UNAUTHORIZED') {
          console.log('Authentication expired, showing signup modal');
          // Save to sessionStorage and show signup
          if (session.generatedImages.length > 0) {
            saveGuestStory({
              characters: session.characters,
              script: session.script,
              readingLevel,
              storyTone,
              enhancedScenes,
              generatedImages: session.generatedImages,
            });
          }
          setSignupAction('save');
          setShowSignupPrompt(true);
        } else {
          alert('❌ Failed to save story. Please try again.');
        }
      }
    } else {
      // User is not authenticated - save to sessionStorage and show signup modal
      if (session.generatedImages.length > 0) {
        saveGuestStory({
          characters: session.characters,
          script: session.script,
          readingLevel,
          storyTone,
          enhancedScenes,
          generatedImages: session.generatedImages,
        });
      }
      setSignupAction('save');
      setShowSignupPrompt(true);
    }
  };

  const handleDownloadPDF = () => {
    // Save guest story to sessionStorage before showing signup prompt
    if (session.generatedImages.length > 0) {
      saveGuestStory({
        characters: session.characters,
        script: session.script,
        readingLevel,
        storyTone,
        enhancedScenes,
        generatedImages: session.generatedImages,
      });
    }
    setSignupAction('download');
    setShowSignupPrompt(true);
  };

  const canGenerate =
    session.characters.length > 0 &&
    session.characters.every(c => c.referenceImage.url && c.name.trim()) &&
    session.script.trim() &&
    session.status === 'idle';

  const isGenerating = session.status === 'processing';
  const hasResults = session.status === 'completed' && session.generatedImages.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <h1 className="text-2xl sm:text-3xl font-bold hover:opacity-80 transition-opacity text-gray-900">
                📚 Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Me</span> ✨
              </h1>
              <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">BETA</span>
              <span className="text-xs sm:text-sm text-gray-500 ml-2">Guest Mode</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="space-y-6 sm:space-y-8">
          {/* Guest Mode Info Banner */}
          {!isGenerating && !hasResults && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 text-2xl">✨</div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Guest Mode - Try It Free!</h3>
                  <p className="text-sm text-gray-700">
                    Create your story now. Sign up later to save and download your storybook as a PDF.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Input Section - only show if not generating and no results */}
          {!isGenerating && !hasResults && (
            <>
              {/* Step 1: Characters */}
              <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-200">
                <div className="flex items-center mb-6">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold mr-3 text-sm">
                    1
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Add Your Characters
                  </h2>
                </div>
                <CharacterManager
                  characters={session.characters}
                  onCharactersChange={handleCharactersChange}
                  disabled={isGenerating}
                />
              </section>

              {/* Step 2: Script */}
              <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-200">
                <div className="flex items-center mb-6">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold mr-3 text-sm">
                    2
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Write Your Story Scenes
                  </h2>
                </div>
                <ScriptInput
                  value={session.script}
                  onChange={handleScriptChange}
                  disabled={isGenerating}
                  characters={session.characters}
                />
              </section>

              {/* Step 3: Story Settings (NEW) */}
              <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-200">
                <div className="flex items-center mb-6">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold mr-3 text-sm">
                    3
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Story Settings
                  </h2>
                </div>
                <StorySettingsPanel
                  readingLevel={readingLevel}
                  onReadingLevelChange={setReadingLevel}
                  storyTone={storyTone}
                  onStoryToneChange={setStoryTone}
                  disabled={isEnhancing || isGenerating}
                />
              </section>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhance Button (NEW) */}
              {enhancedScenes.length === 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleEnhanceScenes}
                    disabled={!canGenerate || isEnhancing}
                    className={`
                      px-8 py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg transition-all
                      ${canGenerate && !isEnhancing
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 hover:shadow-xl transform hover:-translate-y-0.5'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {isEnhancing ? '⏳ Enhancing...' : '🎨 Enhance Scenes & Captions'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Enhancement Preview (NEW) - Show after enhancement */}
          {enhancedScenes.length > 0 && !isGenerating && !hasResults && (
            <EnhancementPreview
              enhancedScenes={enhancedScenes}
              onCaptionEdit={handleCaptionEdit}
              onRegenerateAll={() => {
                setEnhancedScenes([]);
                handleEnhanceScenes();
              }}
              onProceedToGenerate={handleGenerate}
            />
          )}

          {/* Generation Progress */}
          {isGenerating && (
            <GenerationProgress
              images={session.generatedImages}
              totalScenes={session.scenes.length}
            />
          )}

          {/* Results */}
          {hasResults && (
            <>
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 text-2xl">🎉</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-2">Your Story is Ready!</h3>
                    <p className="text-sm text-gray-700 mb-4">
                      Love your story? Save it or download as PDF by creating a free account.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleSaveStory}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                      >
                        💾 Save Story
                      </button>
                      <button
                        onClick={handleDownloadPDF}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-teal-700 font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                      >
                        📄 Download PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <ImageGallery
                characters={session.characters}
                generatedImages={session.generatedImages}
                onStartOver={handleStartOver}
                artStyle={session.artStyle}
                onRegenerateScene={(imageId, newImageData) => {
                  // Replace the image in session
                  setSession(prev => ({
                    ...prev,
                    generatedImages: prev.generatedImages.map(img =>
                      img.id === imageId
                        ? { ...img, ...newImageData }
                        : img
                    ),
                  }));
                }}
                isGuestMode={true}
              />
            </>
          )}
        </div>
      </main>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <GuestSignupModal
          action={signupAction}
          onClose={() => setShowSignupPrompt(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-xs sm:text-sm text-gray-600">
            Made with ❤️ for parents and their little storytellers • <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">KindleWood Studio</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
