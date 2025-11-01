'use client';

import { useState } from 'react';
import { GeneratedImage, Character } from '@/lib/types/story';
import SceneRatingCard from './SceneRatingCard';
import RegenerateSceneControl from './RegenerateSceneControl';

interface ImageGalleryProps {
  characters: Character[];
  generatedImages: GeneratedImage[];
  onRating?: (imageId: string, characterId: string, rating: 'good' | 'bad') => void;
  onDownloadAll?: () => void;
  onStartOver?: () => void;
  onRegenerateScene?: (imageId: string, newImageData: any) => void;
  artStyle?: string;
  isGuestMode?: boolean; // Hide individual downloads in guest mode
}

export default function ImageGallery({
  characters,
  generatedImages,
  onRating,
  onDownloadAll,
  onStartOver,
  onRegenerateScene,
  artStyle,
  isGuestMode = false,
}: ImageGalleryProps) {
  // Track ratings per image per character
  const [ratings, setRatings] = useState<Record<string, Record<string, 'good' | 'bad'>>>({});

  // Track overall scene ratings
  const [sceneRatings, setSceneRatings] = useState<Record<string, {
    overallRating: number;
    ratingFeedback?: string;
  }>>({});

  const handleRating = (imageId: string, characterId: string, rating: 'good' | 'bad') => {
    setRatings(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId],
        [characterId]: rating,
      }
    }));
    onRating?.(imageId, characterId, rating);
  };

  const handleSceneRating = async (imageId: string, ratings: {
    overallRating: number;
    ratingFeedback?: string;
  }) => {
    try {
      // Save to state
      setSceneRatings(prev => ({
        ...prev,
        [imageId]: ratings,
      }));

      // Save to backend
      const response = await fetch(`/api/images/${imageId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ratings),
      });

      if (!response.ok) {
        throw new Error('Failed to save rating');
      }

      console.log('Rating saved successfully:', ratings);
    } catch (error) {
      console.error('Error saving scene rating:', error);
      throw error;
    }
  };

  const successfulImages = generatedImages.filter(img => img.status === 'completed');

  // Calculate overall scene rating statistics
  const sceneRatingStats = (() => {
    const allRatings = successfulImages.map(img => ({
      imageId: img.id,
      sceneNumber: img.sceneNumber,
      overall: img.overallRating || sceneRatings[img.id]?.overallRating || 0,
    }));

    const ratedScenes = allRatings.filter(r => r.overall > 0);
    const lowRatedScenes = ratedScenes.filter(r => r.overall < 3);

    if (ratedScenes.length === 0) {
      return null;
    }

    const avgOverall = ratedScenes.reduce((sum, r) => sum + r.overall, 0) / ratedScenes.length;

    return {
      totalRated: ratedScenes.length,
      totalScenes: successfulImages.length,
      avgOverall,
      lowRatedScenes,
      ratedScenes,
    };
  })();

  // Calculate per-character consistency scores
  const characterScores = characters.map(char => {
    const charRatings = Object.values(ratings)
      .map(imageRatings => imageRatings[char.id])
      .filter(r => r !== undefined);

    const goodCount = charRatings.filter(r => r === 'good').length;
    const totalCount = charRatings.length;
    const score = totalCount > 0 ? Math.round((goodCount / totalCount) * 100) : null;

    return {
      character: char,
      goodCount,
      totalCount,
      score,
    };
  });

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Generated Story Images</h2>
          <p className="text-sm text-gray-600 mt-1">
            {successfulImages.length} image{successfulImages.length !== 1 ? 's' : ''} generated
          </p>
        </div>
        <div className="flex gap-2">
          {onDownloadAll && successfulImages.length > 0 && (
            <button
              onClick={onDownloadAll}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Download All
            </button>
          )}
          {onStartOver && (
            <button
              onClick={onStartOver}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Character References */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Character References</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {characters.map(char => (
            <div key={char.id} className="text-center">
              {char.referenceImage.url ? (
                <img
                  src={char.referenceImage.url}
                  alt={char.name}
                  className="w-24 h-24 object-cover rounded-lg shadow-md border-2 border-white mx-auto"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg shadow-md border-2 border-white mx-auto flex items-center justify-center text-3xl">
                  👤
                </div>
              )}
              <p className="text-sm font-medium text-gray-900 mt-2">{char.name}</p>
              {char.isPrimary && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Primary</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Generated images grid */}
      <div className="space-y-6">
        {generatedImages.map((image) => (
          <div
            key={image.id}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex gap-6">
              {/* Image with download overlay */}
              <div className="flex-shrink-0 relative">
                {image.status === 'completed' && image.imageUrl ? (
                  <>
                    <img
                      src={image.imageUrl}
                      alt={`Scene ${image.sceneNumber}`}
                      className="w-80 h-80 object-cover rounded-lg shadow-md"
                      onError={(e) => {
                        // Handle broken image links
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement?.classList.add('broken-image');
                      }}
                    />
                    {/* Download icon overlay - bottom right */}
                    {!isGuestMode && (
                      <a
                        href={image.imageUrl}
                        download={`scene-${image.sceneNumber}.jpg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-2 right-2 bg-white/90 hover:bg-white p-2 rounded-lg shadow-md hover:shadow-lg transition-all"
                        title="Download this image"
                      >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )}
                  </>
                ) : image.status === 'completed' && !image.imageUrl ? (
                  // Handle case where status is completed but no imageUrl (ERROR STATE)
                  <div className="w-80 h-80 bg-red-50 rounded-lg flex items-center justify-center border-2 border-red-200">
                    <div className="text-center text-red-600">
                      <span className="text-4xl">⚠️</span>
                      <p className="mt-2 text-sm font-medium">Image URL Missing</p>
                      <p className="mt-1 text-xs">Please regenerate this scene</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-80 h-80 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      {image.status === 'failed' ? (
                        <>
                          <span className="text-4xl">✗</span>
                          <p className="mt-2 text-sm">Failed to generate</p>
                        </>
                      ) : (
                        <>
                          <span className="text-4xl">⏳</span>
                          <p className="mt-2 text-sm">Generating...</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Scene {image.sceneNumber}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {image.sceneDescription}
                  </p>
                  {image.characterRatings && image.characterRatings.length > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      Characters: {image.characterRatings.map(r => r.characterName).join(', ')}
                    </p>
                  )}

                  {/* Regenerate Button - Below characters, left-aligned, smaller */}
                  {image.status === 'completed' && onRegenerateScene && (
                    <div className="mt-3">
                      <RegenerateSceneControl
                        sceneId={image.id}
                        sceneNumber={image.sceneNumber}
                        originalPrompt={image.prompt}
                        sceneDescription={image.sceneDescription}
                        characters={characters}
                        artStyle={artStyle}
                        onRegenerate={(newImageData) => onRegenerateScene(image.id, newImageData)}
                      />
                    </div>
                  )}
                </div>

                {image.status === 'completed' && (
                  <>
                    {/* Temporarily hidden - Overall Scene Rating */}
                    {false && (
                      <SceneRatingCard
                        imageId={image.id}
                        sceneNumber={image.sceneNumber}
                        initialRatings={{
                          overallRating: image.overallRating || sceneRatings[image.id]?.overallRating,
                          ratingFeedback: image.ratingFeedback || sceneRatings[image.id]?.ratingFeedback,
                        }}
                        onSave={(ratings) => handleSceneRating(image.id, ratings)}
                      />
                    )}

                    {/* Temporarily hidden - Per-character rating buttons */}
                    {false && image.characterRatings && Array.isArray(image.characterRatings) && image.characterRatings.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <p className="text-sm font-medium text-gray-700">
                          Rate character consistency:
                        </p>
                        {image.characterRatings.map(charRating => (
                          <div key={charRating.characterId} className="flex items-center gap-2">
                            <span className="text-sm text-gray-700 min-w-[140px] font-medium">
                              {charRating.characterName}:
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRating(image.id, charRating.characterId, 'good')}
                                className={`
                                  px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                  ${ratings[image.id]?.[charRating.characterId] === 'good'
                                    ? 'bg-green-100 text-green-700 border-2 border-green-500'
                                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                                  }
                                `}
                              >
                                👍 Good
                              </button>
                              <button
                                onClick={() => handleRating(image.id, charRating.characterId, 'bad')}
                                className={`
                                  px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                  ${ratings[image.id]?.[charRating.characterId] === 'bad'
                                    ? 'bg-red-100 text-red-700 border-2 border-red-500'
                                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                                  }
                                `}
                              >
                                👎 Poor
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {image.status === 'failed' && image.error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                    <p className="font-medium">Error:</p>
                    <p>{image.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-character consistency summary */}
      {successfulImages.length > 0 && characterScores.some(s => s.score !== null) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Character Consistency Scores</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {characterScores.map(({ character, goodCount, totalCount, score }) => (
              <div key={character.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  {character.referenceImage.url ? (
                    <img
                      src={character.referenceImage.url}
                      alt={character.name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center text-xl">
                      👤
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{character.name}</p>
                    {character.isPrimary && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center mt-3">
                  <div className={`text-3xl font-bold ${
                    score === null ? 'text-gray-400' :
                    score >= 75 ? 'text-green-600' :
                    score >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {score !== null ? `${score}%` : '-'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {totalCount > 0 ? `${goodCount}/${totalCount} good ratings` : 'No ratings yet'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overall stats */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600">{successfulImages.length}</div>
                <div className="text-sm text-gray-600 mt-1">Images Generated</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">
                  {characterScores.reduce((sum, s) => sum + s.goodCount, 0)}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total Good Ratings</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-600">
                  {(() => {
                    const avgScore = characterScores
                      .filter(s => s.score !== null)
                      .reduce((sum, s, _, arr) => sum + (s.score || 0) / arr.length, 0);
                    return avgScore > 0 ? `${Math.round(avgScore)}%` : '-';
                  })()}
                </div>
                <div className="text-sm text-gray-600 mt-1">Average Consistency</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overall Scene Ratings Analytics */}
      {sceneRatingStats && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Scene Quality Analytics</h3>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <div className="text-3xl font-bold text-blue-600">{sceneRatingStats.totalRated}/{sceneRatingStats.totalScenes}</div>
              <div className="text-xs text-gray-600 mt-1">Scenes Rated</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <div className={`text-3xl font-bold ${
                sceneRatingStats.avgOverall >= 4 ? 'text-green-600' :
                sceneRatingStats.avgOverall >= 3 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {sceneRatingStats.avgOverall.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Average Rating</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <div className={`text-3xl font-bold ${
                sceneRatingStats.lowRatedScenes.length === 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {sceneRatingStats.lowRatedScenes.length}
              </div>
              <div className="text-xs text-gray-600 mt-1">Low Rated (&lt;3)</div>
            </div>
          </div>

          {/* Low Rated Scenes Alert */}
          {sceneRatingStats.lowRatedScenes.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 mb-2">
                    {sceneRatingStats.lowRatedScenes.length} Scene{sceneRatingStats.lowRatedScenes.length > 1 ? 's' : ''} Need{sceneRatingStats.lowRatedScenes.length === 1 ? 's' : ''} Improvement
                  </h4>
                  <p className="text-sm text-red-700 mb-3">
                    The following scenes received low ratings (below 3 stars). Consider regenerating these scenes:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sceneRatingStats.lowRatedScenes.map(scene => (
                      <span
                        key={scene.imageId}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"
                      >
                        Scene {scene.sceneNumber} ({scene.overall}/5)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* High Rated Scenes */}
          {sceneRatingStats.ratedScenes.filter(s => s.overall >= 4).length > 0 && (
            <div className="mt-4 bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✨</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900 mb-2">
                    {sceneRatingStats.ratedScenes.filter(s => s.overall >= 4).length} High Quality Scene{sceneRatingStats.ratedScenes.filter(s => s.overall >= 4).length > 1 ? 's' : ''}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {sceneRatingStats.ratedScenes.filter(s => s.overall >= 4).map(scene => (
                      <span
                        key={scene.imageId}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                      >
                        Scene {scene.sceneNumber} ({scene.overall}/5)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
