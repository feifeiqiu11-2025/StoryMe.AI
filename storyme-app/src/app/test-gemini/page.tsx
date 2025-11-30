'use client';

import { useState } from 'react';

export default function TestGeminiPage() {
  const [sceneDescription, setSceneDescription] = useState(
    'A happy child playing on a swing at a sunny park with green grass and blue sky'
  );
  const [characterImageUrl, setCharacterImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    imageUrl?: string;
    error?: string;
    generationTimeMs?: number;
  } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneDescription,
          characterImageUrl: characterImageUrl || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          imageUrl: data.imageUrl,
          generationTimeMs: data.generationTimeMs,
        });
      } else {
        setResult({ error: data.error });
      }
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Gemini Image Generation Test</h1>
        <p className="text-gray-600 mb-8">
          Test the Gemini 2.5 Flash Image model for character-consistent story images
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Scene Description</label>
            <textarea
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Describe the scene you want to generate..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Character Reference Image URL (optional)
            </label>
            <input
              type="text"
              value={characterImageUrl}
              onChange={(e) => setCharacterImageUrl(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://your-domain.com/uploads/character.jpg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Provide a URL to a character photo to test character consistency
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !sceneDescription}
            className={`w-full py-3 px-6 rounded-lg font-medium text-white transition ${
              loading || !sceneDescription
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating with Gemini...
              </span>
            ) : (
              'Generate Image'
            )}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            {result.error ? (
              <div className="text-red-600">
                <h3 className="font-bold mb-2">Error</h3>
                <p>{result.error}</p>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">Generated Image</h3>
                  {result.generationTimeMs && (
                    <span className="text-sm text-gray-500">
                      Generated in {(result.generationTimeMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {result.imageUrl && (
                  <img
                    src={result.imageUrl}
                    alt="Generated scene"
                    className="w-full rounded-lg border"
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-bold text-yellow-800 mb-2">Test Suggestions</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Try: &quot;Connor playing at the park on a swing&quot;</li>
            <li>• Try: &quot;Connor and a golden retriever dog in the backyard&quot;</li>
            <li>• Try: &quot;Connor standing next to a lion at the zoo&quot; (test human-animal separation)</li>
            <li>• Add a character reference URL to test consistency</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
