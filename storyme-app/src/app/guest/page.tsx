'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CharacterManager from '@/components/story/CharacterManager';
import ScriptInput from '@/components/story/ScriptInput';
import GenerationProgress from '@/components/story/GenerationProgress';
import ImageGallery from '@/components/story/ImageGallery';
import { StorySession } from '@/lib/types/story';
import { validateScript, parseScriptIntoScenes, validateCharacterReferences } from '@/lib/scene-parser';

export default function GuestStoryPage() {
  const router = useRouter();
  const [session, setSession] = useState<StorySession>({
    characters: [],
    script: '',
    scenes: [],
    generatedImages: [],
    status: 'idle',
  });

  const [error, setError] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [signupAction, setSignupAction] = useState<'save' | 'download'>('save');

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

    setError(null);
    const scenes = parseScriptIntoScenes(session.script, session.characters);

    // Initialize generation
    setSession(prev => ({
      ...prev,
      status: 'processing',
      scenes,
      generatedImages: scenes.map(scene => ({
        id: `img-${scene.id}`,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneDescription: scene.description,
        imageUrl: '',
        prompt: '',
        generationTime: 0,
        status: 'pending',
        characterRatings: scene.characterNames?.map(name => ({
          characterId: session.characters.find(c => c.name === name)?.id || '',
          characterName: name,
        })),
      })),
    }));

    try {
      // Call the generation API
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characters: session.characters,
          script: session.script,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Generation failed');
      }

      const data = await response.json();

      // Update with results
      setSession(prev => ({
        ...prev,
        status: 'completed',
        generatedImages: data.generatedImages,
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
    });
    setError(null);
  };

  const handleSaveStory = () => {
    setSignupAction('save');
    setShowSignupPrompt(true);
  };

  const handleDownloadPDF = () => {
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
              <h1 className="text-2xl sm:text-3xl font-bold hover:opacity-80 transition-opacity">
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

              {/* Generate Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`
                    px-8 py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg transition-all
                    ${canGenerate
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-xl transform hover:-translate-y-0.5'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  ✨ Generate Story Images
                </button>
              </div>
            </>
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
              />
            </>
          )}
        </div>
      </main>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 sm:p-8">
            <div className="text-center">
              <div className="text-5xl mb-4">
                {signupAction === 'save' ? '💾' : '📄'}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {signupAction === 'save' ? 'Save Your Story' : 'Download as PDF'}
              </h3>
              <p className="text-gray-600 mb-6">
                {signupAction === 'save'
                  ? 'Create a free account to save your story and access it anytime from any device.'
                  : 'Create a free account to download your storybook as a beautiful PDF.'}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push('/signup')}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  Create Free Account
                </button>
                <button
                  onClick={() => setShowSignupPrompt(false)}
                  className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium transition-all"
                >
                  Maybe Later
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Already have an account? <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-xs sm:text-sm text-gray-600">
            Made with ❤️ for parents and their little storytellers • <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">StoryMe</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
