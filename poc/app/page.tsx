'use client';

import { useState } from 'react';
import CharacterManager from '@/components/CharacterManager';
import ScriptInput from '@/components/ScriptInput';
import GenerationProgress from '@/components/GenerationProgress';
import ImageGallery from '@/components/ImageGallery';
import { StorySession } from '@/lib/types';
import { validateScript, parseScriptIntoScenes, validateCharacterReferences } from '@/lib/scene-parser';

export default function Home() {
  const [session, setSession] = useState<StorySession>({
    characters: [],
    script: '',
    scenes: [],
    generatedImages: [],
    status: 'idle',
  });

  const [error, setError] = useState<string | null>(null);

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

  const canGenerate =
    session.characters.length > 0 &&
    session.characters.every(c => c.referenceImage.url && c.name.trim()) &&
    session.script.trim() &&
    session.status === 'idle';

  const isGenerating = session.status === 'processing';
  const hasResults = session.status === 'completed' && session.generatedImages.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                StoryMe POC
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Multi-Character Story Generation with Fal.ai
              </p>
            </div>
            <a
              href="https://github.com/yourusername/storyme-poc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              About
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Input Section - only show if not generating and no results */}
          {!isGenerating && !hasResults && (
            <>
              {/* Step 1: Characters */}
              <section className="bg-white rounded-xl shadow-md p-8">
                <div className="flex items-center mb-6">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-3">
                    1
                  </span>
                  <h2 className="text-xl font-semibold text-gray-900">
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
              <section className="bg-white rounded-xl shadow-md p-8">
                <div className="flex items-center mb-6">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-3">
                    2
                  </span>
                  <h2 className="text-xl font-semibold text-gray-900">
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
                    px-8 py-4 rounded-lg font-semibold text-lg shadow-lg transition-all
                    ${canGenerate
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl transform hover:-translate-y-0.5'
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
            <ImageGallery
              characters={session.characters}
              generatedImages={session.generatedImages}
              onStartOver={handleStartOver}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-600">
            Built with Next.js, Tailwind CSS, and Fal.ai • StoryMe POC 2024
          </p>
        </div>
      </footer>
    </div>
  );
}
