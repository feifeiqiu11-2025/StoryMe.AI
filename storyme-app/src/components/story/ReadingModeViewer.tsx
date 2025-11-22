/**
 * Reading Mode Viewer
 * Full-screen storybook reader with audio narration
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';

export interface ReadingPage {
  pageNumber: number;
  pageType: 'cover' | 'scene' | 'quiz_transition' | 'quiz_question';
  imageUrl: string;
  textContent: string;
  textContentChinese?: string;
  audioUrl?: string;
  audioUrlZh?: string;
  audioDuration?: number;
  quizQuestion?: {
    id: string;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    explanation?: string;
  };
}

interface ReadingModeViewerProps {
  projectId: string;
  projectTitle: string;
  pages: ReadingPage[];
  onExit: () => void;
  autoPlayAudio?: boolean;
}

export default function ReadingModeViewer({
  projectId,
  projectTitle,
  pages,
  onExit,
  autoPlayAudio = false,
}: ReadingModeViewerProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(autoPlayAudio);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioLanguage, setAudioLanguage] = useState<'en' | 'zh'>('en');
  const audioRef = useRef<HTMLAudioElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const KIDS_APP_URL = 'https://apps.apple.com/us/app/kindlewood-kids/id6755075039';

  const currentPage = pages[currentPageIndex];
  const totalPages = pages.length;

  // Check if bilingual audio is available
  const hasEnglishAudio = pages.some(p => p.audioUrl);
  const hasChineseAudio = pages.some(p => p.audioUrlZh);
  const hasBilingualAudio = hasEnglishAudio && hasChineseAudio;

  // Get current audio URL based on selected language
  const getCurrentAudioUrl = (page: ReadingPage) => {
    if (audioLanguage === 'zh' && page.audioUrlZh) {
      return page.audioUrlZh;
    }
    return page.audioUrl;
  };

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, currentPageIndex]);

  // Play audio when page changes or on initial load (if audio enabled)
  useEffect(() => {
    const playAudio = () => {
      const audioUrl = currentPage ? getCurrentAudioUrl(currentPage) : null;
      if (audioEnabled && audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().then(() => {
          setAudioBlocked(false);
        }).catch(err => {
          // Browser autoplay policy blocks audio without user interaction
          if (err.name === 'NotAllowedError') {
            console.log('Audio autoplay blocked by browser policy - will play on user interaction');
            setAudioBlocked(true);
          } else if (err.name === 'AbortError') {
            // Play was interrupted by a new load - this is normal when quickly changing pages
            console.log('Audio play interrupted by new load');
          } else {
            console.error('Audio play error:', err);
          }
        });
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
    };

    // Small delay to ensure component is fully mounted
    const timer = setTimeout(playAudio, 100);
    return () => clearTimeout(timer);
  }, [currentPageIndex, audioEnabled, audioLanguage, currentPage]);

  // Handle audio play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPreviousPage();
      } else if (e.key === 'ArrowRight') {
        goToNextPage();
      } else if (e.key === 'Escape') {
        onExit();
      } else if (e.key === ' ') {
        e.preventDefault();
        toggleAudio();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, audioEnabled]);

  const goToNextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      setShowControls(true);
    } else {
      // Show completion screen when user tries to go past last page
      setShowCompletionScreen(true);
    }
  };

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
      setShowControls(true);
    }
  };

  const toggleAudio = () => {
    if (audioEnabled && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          console.error('Audio play error:', err);
        });
      }
    }
  };

  const toggleAudioEnabled = () => {
    const newEnabled = !audioEnabled;
    setAudioEnabled(newEnabled);

    if (!newEnabled && audioRef.current) {
      audioRef.current.pause();
    }
  };

  // Swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => goToNextPage(),
    onSwipedRight: () => goToPreviousPage(),
    preventScrollOnSwipe: true,
    trackMouse: false,
  });

  const handleScreenTap = (e: React.MouseEvent) => {
    // If audio was blocked by browser policy, try to play on tap
    const audioUrl = currentPage ? getCurrentAudioUrl(currentPage) : null;
    if (audioBlocked && audioEnabled && audioUrl && audioRef.current) {
      audioRef.current.play().then(() => {
        setAudioBlocked(false);
      }).catch(err => {
        console.error('Audio play error on tap:', err);
      });
    }
    // Toggle controls on tap
    setShowControls(!showControls);
  };

  const toggleLanguage = () => {
    setAudioLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  if (!currentPage) {
    return null;
  }

  const hasAudio = hasEnglishAudio || hasChineseAudio;

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      {...swipeHandlers}
      onClick={handleScreenTap}
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} />

      {/* Top Controls Bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between p-4">
          {/* Exit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="text-white hover:text-gray-300 transition-colors p-2"
            aria-label="Exit reading mode"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title */}
          <h1 className="text-white font-semibold text-lg truncate max-w-md">
            {projectTitle}
          </h1>

          {/* Audio Controls */}
          <div className="flex items-center gap-2">
            {/* Language Toggle - only show if bilingual audio available */}
            {hasBilingualAudio && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLanguage();
                }}
                className="px-2 py-1 rounded-lg bg-gray-700 text-white text-sm font-medium transition-all hover:bg-gray-600"
                aria-label={`Switch to ${audioLanguage === 'en' ? 'Chinese' : 'English'} audio`}
              >
                {audioLanguage === 'en' ? 'EN' : '中'}
              </button>
            )}

            {/* Audio Toggle */}
            {hasAudio && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAudioEnabled();
                }}
                className={`p-2 rounded-lg transition-all ${
                  audioEnabled
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
                aria-label={audioEnabled ? 'Disable audio' : 'Enable audio'}
              >
                {audioEnabled ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        {/* Page Content */}
        <div className="relative w-full h-full flex flex-col">
          {/* Image */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 overflow-hidden">
            <img
              src={currentPage.imageUrl}
              alt={`Page ${currentPage.pageNumber}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Text Content */}
          <div className="bg-white p-6 md:p-8">
            {currentPage.pageType === 'quiz_question' && currentPage.quizQuestion ? (
              <div className="max-w-3xl mx-auto">
                <h2 className="text-gray-900 text-2xl md:text-3xl font-bold mb-6 text-center">
                  {currentPage.quizQuestion.question}
                </h2>
                <div className="space-y-4">
                  {[
                    { letter: 'A', text: currentPage.quizQuestion.optionA },
                    { letter: 'B', text: currentPage.quizQuestion.optionB },
                    { letter: 'C', text: currentPage.quizQuestion.optionC },
                    { letter: 'D', text: currentPage.quizQuestion.optionD },
                  ].map((option) => (
                    <div
                      key={option.letter}
                      className="p-4 rounded-lg border-2 border-gray-300 bg-gray-50 transition-all hover:border-purple-400 hover:bg-purple-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-bold text-lg text-gray-700">
                          {option.letter}.
                        </span>
                        <span className="text-lg text-gray-800">
                          {option.text}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-800 text-xl md:text-2xl lg:text-3xl leading-relaxed font-medium">
                  {currentPage.textContent}
                </p>
                {currentPage.textContentChinese && (
                  <p className="text-gray-500 text-lg md:text-xl lg:text-2xl leading-relaxed mt-3">
                    {currentPage.textContentChinese}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Arrows */}
        <div
          className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-4 pointer-events-none transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Previous Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPreviousPage();
            }}
            disabled={currentPageIndex === 0}
            className={`pointer-events-auto bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all ${
              currentPageIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            aria-label="Previous page"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNextPage();
            }}
            className="pointer-events-auto bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all"
            aria-label={currentPageIndex === totalPages - 1 ? "Finish story" : "Next page"}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center p-4 space-y-3">
          {/* Page Indicator Dots */}
          <div className="flex gap-2 overflow-x-auto max-w-full pb-2">
            {pages.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentPageIndex(index);
                  setShowControls(true);
                }}
                className={`pointer-events-auto transition-all rounded-full ${
                  index === currentPageIndex
                    ? 'bg-white w-8 h-3'
                    : 'bg-white/50 hover:bg-white/70 w-3 h-3'
                }`}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>

          {/* Page Number */}
          <div className="text-white text-sm font-medium">
            Page {currentPageIndex + 1} of {totalPages}
          </div>
        </div>
      </div>

      {/* Audio Playing Indicator */}
      {audioEnabled && isPlaying && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <div className="flex gap-1">
            <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
            <div className="w-1 h-4 bg-white rounded-full animate-pulse delay-75"></div>
            <div className="w-1 h-4 bg-white rounded-full animate-pulse delay-150"></div>
          </div>
          <span className="text-sm font-medium">Playing audio</span>
        </div>
      )}

      {/* Tap to Start Audio Indicator */}
      {audioEnabled && audioBlocked && !isPlaying && currentPage?.audioUrl && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span className="text-sm font-medium">Tap to start audio</span>
        </div>
      )}

      {/* Completion Screen */}
      {showCompletionScreen && (
        <div className="absolute inset-0 bg-white flex items-center justify-center z-50 overflow-y-auto">
          <div className="text-center p-6 max-w-lg w-full">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-gray-900 text-2xl font-bold mb-1">The End!</h2>
            <p className="text-gray-600 text-sm mb-6">
              You finished reading "{projectTitle}"
            </p>

            {/* App Download Section */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 mb-4 text-left">
              <h3 className="text-gray-900 font-bold text-sm mb-2 flex items-center gap-2">
                📱 Get KindleWood Kids App
                <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">FREE</span>
              </h3>
              <ul className="text-gray-600 text-xs space-y-1 mb-3">
                <li>🎧 Listen to stories with audio narration</li>
                <li>🔤 Tap any word to hear pronunciation</li>
                <li>📊 Track reading progress & set goals</li>
                <li>📚 Access Cool Jobs, Sports & Adventure stories</li>
              </ul>
              <a
                href={KIDS_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors text-center"
              >
                Download Free App
              </a>
            </div>

            {/* Create Story Section */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 mb-4 text-left">
              <h3 className="text-gray-900 font-bold text-sm mb-2">
                ✨ Create Your Own Story
              </h3>
              <ul className="text-gray-600 text-xs space-y-1 mb-3">
                <li>✏️ Make your child the story character</li>
                <li>🤖 Add AI voice narration</li>
                <li>🎙️ Record your own voice to tell stories</li>
                <li>📄 Export as PDF or physical book</li>
              </ul>
              <a
                href="/signup"
                className="block w-full bg-purple-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-purple-700 transition-colors text-center"
              >
                Start Creating Free
              </a>
            </div>

            {/* Exit Button */}
            <button
              onClick={onExit}
              className="text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              ← Back to Story
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
