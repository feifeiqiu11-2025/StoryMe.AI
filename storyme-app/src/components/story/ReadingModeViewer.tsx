/**
 * Reading Mode Viewer
 * Full-screen storybook reader with audio narration
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { getLanguageLabel } from '@/lib/config/languages';
import { Sparkles, BookOpen, Smartphone } from 'lucide-react';

export interface ReadingPage {
  pageNumber: number;
  pageType: 'cover' | 'scene' | 'quiz_transition' | 'quiz_question';
  imageUrl: string;
  textContent: string;
  textContentChinese?: string;
  textContentSecondary?: string;
  audioUrl?: string;
  audioUrlZh?: string;
  audioUrlSecondary?: string;
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
  /** @default true */
  autoPlayAudio?: boolean;
  secondaryLanguage?: string | null;
}

export default function ReadingModeViewer({
  projectId,
  projectTitle,
  pages,
  onExit,
  autoPlayAudio = true,
  secondaryLanguage,
}: ReadingModeViewerProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(autoPlayAudio);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioLanguage, setAudioLanguage] = useState<string>('en');
  const [showAudioHint, setShowAudioHint] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const KIDS_APP_URL_IOS = 'https://apps.apple.com/us/app/kindlewood-kids/id6755075039';
  const KIDS_APP_URL_ANDROID = 'https://play.google.com/store/apps/details?id=com.kindlewood.kindlewood_kids';

  const currentPage = pages[currentPageIndex];
  const totalPages = pages.length;

  // Check if bilingual audio is available
  const hasEnglishAudio = pages.some(p => p.audioUrl);
  const hasChineseAudio = pages.some(p => p.audioUrlZh);
  const hasSecondaryAudio = pages.some(p => p.audioUrlSecondary || p.audioUrlZh);
  const hasBilingualAudio = hasEnglishAudio && hasSecondaryAudio;

  // Derive the secondary language label for the toggle button
  const secondaryLangCode = secondaryLanguage || (hasSecondaryAudio ? 'zh' : hasChineseAudio ? 'zh' : null);

  // Get current audio URL based on selected language
  const getCurrentAudioUrl = (page: ReadingPage) => {
    if (audioLanguage !== 'en') {
      // Prefer audioUrlSecondary, fall back to audioUrlZh for backward compatibility
      return page.audioUrlSecondary || page.audioUrlZh || page.audioUrl;
    }
    return page.audioUrl;
  };

  // Controls are always visible — no auto-hide timer.

  // Show a brief hint when audio is off so users know it's available
  useEffect(() => {
    if (!audioEnabled && hasAudio) {
      setShowAudioHint(true);
      const timer = setTimeout(() => setShowAudioHint(false), 4000);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    } else {
      // Show completion screen when user tries to go past last page
      setShowCompletionScreen(true);
    }
  };

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
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
  };

  const toggleLanguage = () => {
    setAudioLanguage(prev => prev === 'en' ? (secondaryLangCode || 'zh') : 'en');
  };

  if (!currentPage) {
    return null;
  }

  const hasAudio = hasEnglishAudio || hasSecondaryAudio;

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
        className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent"
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
                aria-label={`Switch to ${audioLanguage === 'en' ? getLanguageLabel(secondaryLangCode) : 'English'} audio`}
              >
                {audioLanguage === 'en' ? 'EN' : (secondaryLangCode === 'zh' ? '中' : (secondaryLangCode || 'EN').toUpperCase().slice(0, 2))}
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
                {(currentPage.textContentSecondary || currentPage.textContentChinese) && (
                  <p className="text-gray-500 text-lg md:text-xl lg:text-2xl leading-relaxed mt-3">
                    {currentPage.textContentSecondary || currentPage.textContentChinese}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Arrows */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-4 pointer-events-none"
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
        className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent"
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
      {audioEnabled && audioBlocked && !isPlaying && getCurrentAudioUrl(currentPage) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span className="text-sm font-medium">Tap to start audio</span>
        </div>
      )}

      {/* Audio Available Hint — shown briefly when audio is off */}
      {showAudioHint && !audioEnabled && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg transition-opacity duration-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span className="text-sm font-medium">Audio available — tap speaker to listen</span>
        </div>
      )}

      {/* Completion Screen */}
      {showCompletionScreen && (
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="p-6 max-w-md w-full">
            {/* Hero */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur px-4 py-1.5 rounded-full shadow-sm mb-3">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-purple-700 text-xs font-semibold tracking-wide uppercase">Story complete</span>
              </div>
              <h2 className="text-gray-900 text-2xl font-bold mb-1">Yay, you finished!</h2>
              <p className="text-gray-600 text-sm">
                Hope you loved <span className="font-semibold text-gray-800">{projectTitle}</span>. Want to keep the magic going?
              </p>
            </div>

            {/* Card 1 — Get the Kids App (slight left tilt) */}
            <div className="relative bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100 rounded-[28px] p-5 mb-5 shadow-md border border-white/60 -rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="absolute -top-3 left-5 inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                <Smartphone className="w-3 h-3" />
                Free for families
              </div>
              <div className="mt-3">
                <h3 className="text-gray-900 text-lg font-bold mb-1">Read with audio anywhere</h3>
                <p className="text-gray-700 text-sm mb-4">
                  Take stories on the go with narration, tap-to-read words, and reading goals.
                </p>
                <div className="flex gap-2">
                  <a
                    href={KIDS_APP_URL_IOS}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-black text-white px-2 py-2 rounded-lg font-semibold text-xs hover:bg-gray-900 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M16.365 1.43c0 1.14-.435 2.255-1.295 3.114-.85.864-2.005 1.388-3.13 1.31-.13-1.116.42-2.27 1.27-3.13.85-.86 2.04-1.41 3.155-1.294zm4.555 17.45c-.85 1.31-1.99 2.65-3.535 2.665-1.475.015-1.96-.96-3.65-.96-1.69 0-2.21.94-3.625.985-1.46.05-2.575-1.42-3.435-2.72-1.785-2.585-3.155-7.31-1.32-10.485.91-1.575 2.535-2.575 4.31-2.6 1.43-.025 2.78.965 3.65.965.87 0 2.5-1.19 4.21-1.015.715.03 2.715.29 4.005 2.18-.105.07-2.39 1.395-2.36 4.165.025 3.31 2.92 4.42 2.95 4.43-.025.07-.46 1.575-1.51 3.21z"/>
                    </svg>
                    App Store
                  </a>
                  <a
                    href={KIDS_APP_URL_ANDROID}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-black text-white px-2 py-2 rounded-lg font-semibold text-xs hover:bg-gray-900 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.198 12l2.5-2.491zM5.864 2.658L16.802 8.99l-2.302 2.303-8.636-8.635z"/>
                    </svg>
                    Google Play
                  </a>
                </div>
              </div>
            </div>

            {/* Card 2 — Explore community stories (slight right tilt) */}
            <div className="relative bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 rounded-[28px] p-5 mb-5 shadow-md border border-white/60 rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="absolute -top-3 left-5 inline-flex items-center gap-1.5 bg-amber-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                <BookOpen className="w-3 h-3" />
                Free to read
              </div>
              <div className="mt-3">
                <h3 className="text-gray-900 text-lg font-bold mb-1">More stories from other kids</h3>
                <p className="text-gray-700 text-sm mb-4">
                  Free stories dreamed up by other little storytellers — pick one and dive in.
                </p>
                <a
                  href="/stories"
                  className="block w-full bg-amber-600 text-white px-4 py-3 rounded-xl font-semibold text-sm hover:bg-amber-700 transition-colors text-center shadow-sm"
                >
                  Browse stories
                </a>
              </div>
            </div>

            {/* Card 3 — Create your own (slight left tilt, opposite of Card 1) */}
            <div className="relative bg-gradient-to-br from-violet-100 via-purple-100 to-pink-100 rounded-[28px] p-5 mb-6 shadow-md border border-white/60 -rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="absolute -top-3 left-5 inline-flex items-center gap-1.5 bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                <Sparkles className="w-3 h-3" />
                Your turn!
              </div>
              <div className="mt-3">
                <h3 className="text-gray-900 text-lg font-bold mb-1">Star in your own story</h3>
                <p className="text-gray-700 text-sm mb-4">
                  Make your child the hero of their very own adventure.
                </p>
                <a
                  href="/signup"
                  className="block w-full bg-purple-600 text-white px-4 py-3 rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors text-center shadow-sm"
                >
                  Create your story
                </a>
              </div>
            </div>

            {/* Exit Button */}
            <button
              onClick={onExit}
              className="text-gray-400 hover:text-gray-600 text-xs transition-colors block mx-auto"
            >
              Back to story
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
