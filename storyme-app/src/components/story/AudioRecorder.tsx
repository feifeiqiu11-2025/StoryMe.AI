/**
 * Audio Recorder Component
 * Page-by-page voice recording for stories
 * Supports user-recorded audio with preview and re-record
 */

'use client';

import { useState, useRef, useEffect } from 'react';

export interface RecordingPage {
  pageNumber: number;
  pageType: 'cover' | 'scene' | 'quiz_transition' | 'quiz_question';
  imageUrl: string;
  textContent: string;
  textContentChinese?: string;
  sceneId?: string;
  quizQuestionId?: string;
}

interface AudioRecording {
  pageNumber: number;
  audioBlob: Blob;
  audioUrl: string; // Local preview URL
  duration: number;
}

interface AudioRecorderProps {
  projectId: string;
  projectTitle: string;
  pages: RecordingPage[];
  onComplete: (recordings: AudioRecording[], language: 'en' | 'zh') => Promise<void>;
  onExit: () => void;
  defaultLanguage?: 'en' | 'zh';
}

export default function AudioRecorder({
  projectId,
  projectTitle,
  pages,
  onComplete,
  onExit,
  defaultLanguage = 'en',
}: AudioRecorderProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Map<number, AudioRecording>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'zh'>(defaultLanguage);

  // Check if any page has Chinese content
  const hasBilingualContent = pages.some(page => page.textContentChinese);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const startTimeRef = useRef<number>(0);

  const currentPage = pages[currentPageIndex];
  const totalPages = pages.length;
  const currentRecording = recordings.get(currentPage.pageNumber);

  // Debug logging
  useEffect(() => {
    console.log('📄 AudioRecorder - Current Page:', currentPageIndex + 1, '/', totalPages);
    console.log('📄 Current Page Data:', currentPage);
    console.log('🖼️ Image URL:', currentPage?.imageUrl);
    console.log('📝 Text:', currentPage?.textContent);
  }, [currentPageIndex, currentPage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Revoke blob URLs to free memory
      recordings.forEach(rec => URL.revokeObjectURL(rec.audioUrl));
    };
  }, []);

  // Request microphone permission on mount
  useEffect(() => {
    requestMicPermission();
  }, []);

  const requestMicPermission = async () => {
    try {
      // Check if running in secure context FIRST (HTTPS or localhost)
      // This is the most common issue - browsers hide navigator.mediaDevices in insecure contexts
      if (!window.isSecureContext) {
        console.error('Not a secure context - HTTPS required for microphone access');
        console.log('Current URL:', window.location.href);
        alert('❌ Audio recording requires HTTPS or localhost.\n\nYou are currently on: ' + window.location.hostname + '\n\nPlease access via:\n• https://story-me-ai.vercel.app (production)\n• http://localhost:3001 (dev)');
        setMicPermissionDenied(true);
        return;
      }

      // Check if MediaDevices API is supported (after secure context check)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not supported');
        console.log('navigator.mediaDevices:', navigator.mediaDevices);
        console.log('User Agent:', navigator.userAgent);
        alert('❌ Audio recording is not supported in your browser.\n\nPlease update to the latest version of Chrome, Firefox, Safari, or Edge.');
        setMicPermissionDenied(true);
        return;
      }

      console.log('✅ Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicPermissionDenied(false);
      console.log('✅ Microphone access granted');
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      console.log('Error name:', error.name);
      console.log('Error message:', error.message);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('❌ Microphone access denied.\n\nPlease click the microphone icon in your browser\'s address bar and allow access, then try again.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('❌ No microphone found.\n\nPlease connect a microphone device and try again.');
      } else {
        alert(`❌ Failed to access microphone.\n\nError: ${error.message || 'Unknown error'}\n\nPlease check your browser settings.`);
      }

      setMicPermissionDenied(true);
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      await requestMicPermission();
      if (!streamRef.current) return;
    }

    try {
      audioChunksRef.current = [];

      // Try multiple codec options in order of preference
      // Safari/macOS prefers audio/mp4, Chrome prefers webm
      let mediaRecorder: MediaRecorder | null = null;
      const codecOptions = [
        { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 },
        { mimeType: 'audio/webm', audioBitsPerSecond: 128000 },
        { mimeType: 'audio/mp4', audioBitsPerSecond: 128000 },
        { mimeType: 'audio/ogg;codecs=opus', audioBitsPerSecond: 128000 },
        {}, // Fallback: Let browser choose default
      ];

      for (const options of codecOptions) {
        try {
          // Check if mime type is supported (if specified)
          if (options.mimeType && !MediaRecorder.isTypeSupported(options.mimeType)) {
            console.log(`❌ Codec not supported: ${options.mimeType}`);
            continue;
          }

          // Try to create MediaRecorder with these options
          mediaRecorder = new MediaRecorder(streamRef.current!, options as MediaRecorderOptions);
          console.log(`✅ Using codec: ${options.mimeType || 'browser default'}`);
          break; // Success!
        } catch (err) {
          console.warn(`Failed to create MediaRecorder with ${options.mimeType || 'default'}:`, err);
          continue; // Try next option
        }
      }

      if (!mediaRecorder) {
        throw new Error('No supported audio codec found');
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const duration = recordingTime;

        // Save recording
        const newRecordings = new Map(recordings);

        // Revoke old URL if exists
        const oldRecording = newRecordings.get(currentPage.pageNumber);
        if (oldRecording) {
          URL.revokeObjectURL(oldRecording.audioUrl);
        }

        newRecordings.set(currentPage.pageNumber, {
          pageNumber: currentPage.pageNumber,
          audioBlob,
          audioUrl,
          duration,
        });

        setRecordings(newRecordings);
        setRecordingTime(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 0.1;
          // Auto-stop at 60 seconds
          if (newTime >= 60) {
            stopRecording();
            return 60;
          }
          return newTime;
        });
      }, 100);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 0.1;
          if (newTime >= 60) {
            stopRecording();
            return 60;
          }
          return newTime;
        });
      }, 100);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const deleteRecording = () => {
    const newRecordings = new Map(recordings);
    const recording = newRecordings.get(currentPage.pageNumber);
    if (recording) {
      URL.revokeObjectURL(recording.audioUrl);
      newRecordings.delete(currentPage.pageNumber);
      setRecordings(newRecordings);
    }
  };

  const playPreview = () => {
    if (audioPreviewRef.current && currentRecording) {
      audioPreviewRef.current.src = currentRecording.audioUrl;
      audioPreviewRef.current.play();
      setIsPlaying(true);
    }
  };

  const stopPreview = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const goToNextPage = () => {
    stopPreview();
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const goToPreviousPage = () => {
    stopPreview();
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const skipPage = () => {
    goToNextPage();
  };

  const handleComplete = async () => {
    if (recordings.size === 0) {
      alert('Please record at least one page before saving.');
      return;
    }

    const confirmMessage = recordings.size < totalPages
      ? `You've recorded ${recordings.size} of ${totalPages} pages. Pages without recordings will use AI-generated audio. Continue?`
      : `Save all ${recordings.size} recordings?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setUploading(true);

    try {
      // Convert Map to Array
      const recordingsArray = Array.from(recordings.values());
      await onComplete(recordingsArray, selectedLanguage);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to save recordings. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const recordingProgress = (recordings.size / totalPages) * 100;

  if (micPermissionDenied) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🎤</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Microphone Access Required
          </h2>
          <p className="text-gray-600 mb-4">
            Audio recording requires microphone access to work.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-700 mb-2 font-semibold">To fix this:</p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Make sure you're using HTTPS (not HTTP)</li>
              <li>Click the lock icon in your browser's address bar</li>
              <li>Allow microphone permissions for this site</li>
              <li>Refresh the page and try again</li>
            </ol>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={requestMicPermission}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all"
            >
              Try Again
            </button>
            <button
              onClick={onExit}
              className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-300 font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-50 to-blue-50 overflow-hidden">
      {/* Hidden audio element for preview */}
      <audio
        ref={audioPreviewRef}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onExit}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                disabled={uploading}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Record Audio</h1>
                <p className="text-sm text-gray-600">{projectTitle}</p>
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {recordings.size} of {totalPages} pages recorded
                </p>
                <div className="w-48 h-2 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all"
                    style={{ width: `${recordingProgress}%` }}
                  />
                </div>
              </div>
              <button
                onClick={handleComplete}
                disabled={uploading || recordings.size === 0}
                className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-blue-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </span>
                ) : (
                  'Save & Continue'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-[calc(100vh-88px)] flex flex-col items-center p-8 overflow-y-auto">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">

          {/* Page Info */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">
                  Page {currentPageIndex + 1} of {totalPages}
                </p>
                <p className="text-xs opacity-75 mt-1">
                  {currentPage.pageType === 'cover' ? 'Cover Page' :
                   currentPage.pageType === 'scene' ? 'Story Scene' :
                   currentPage.pageType === 'quiz_transition' ? 'Quiz Introduction' :
                   'Quiz Question'}
                </p>
              </div>
              {currentRecording && (
                <div className="flex items-center gap-2 bg-green-500/20 px-4 py-2 rounded-full">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Recorded</span>
                </div>
              )}
            </div>
          </div>

          {/* Image Preview with Overlay Navigation */}
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden aspect-video flex items-center justify-center">
              {currentPage.imageUrl ? (
                <img
                  src={currentPage.imageUrl}
                  alt={`Page ${currentPage.pageNumber}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    console.error('Image load error:', currentPage.imageUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-gray-400 text-center p-8">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">No image available</p>
                </div>
              )}
            </div>

            {/* Overlay Navigation Controls */}
            <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
              <button
                onClick={goToPreviousPage}
                disabled={currentPageIndex === 0}
                className="pointer-events-auto bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={goToNextPage}
                disabled={currentPageIndex === totalPages - 1}
                className="pointer-events-auto bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Page Indicator Dots */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black bg-opacity-60 px-4 py-2 rounded-full max-w-[90%] overflow-x-auto">
              {pages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    stopPreview();
                    setCurrentPageIndex(index);
                  }}
                  className={`w-2 h-2 rounded-full transition-all flex-shrink-0 ${
                    index === currentPageIndex
                      ? 'bg-white w-6'
                      : recordings.has(pages[index].pageNumber)
                      ? 'bg-green-400 bg-opacity-90'
                      : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                  }`}
                />
              ))}
            </div>

            {/* Page Counter */}
            <div className="absolute top-4 right-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm font-semibold">
              {currentPageIndex + 1} / {totalPages}
            </div>

            {/* Recorded Indicator */}
            {currentRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-4 py-2 rounded-full text-sm font-semibold">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Recorded
              </div>
            )}
          </div>

          <div className="p-8">

            {/* Text to Read */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Read this text:</h3>
                </div>

                {/* Language Selector */}
                {hasBilingualContent && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Recording language:</span>
                    <div className="flex rounded-lg overflow-hidden border border-gray-300">
                      <button
                        onClick={() => setSelectedLanguage('en')}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                          selectedLanguage === 'en'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => setSelectedLanguage('zh')}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                          selectedLanguage === 'zh'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        中
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                <p className="text-gray-800 text-xl leading-relaxed">
                  {selectedLanguage === 'zh' && currentPage.textContentChinese
                    ? currentPage.textContentChinese
                    : currentPage.textContent}
                </p>
                {/* Show both languages if bilingual */}
                {hasBilingualContent && currentPage.textContentChinese && (
                  <p className="text-gray-500 text-base leading-relaxed mt-4 pt-4 border-t border-gray-200">
                    {selectedLanguage === 'zh'
                      ? currentPage.textContent
                      : currentPage.textContentChinese}
                  </p>
                )}
              </div>
            </div>

            {/* Recording Controls */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 mb-6">
              {!currentRecording ? (
                // No recording yet - show record button
                <div className="text-center">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-8 py-4 rounded-full hover:from-red-600 hover:to-pink-600 font-semibold shadow-lg transition-all transform hover:scale-105 flex items-center gap-3 mx-auto"
                    >
                      <div className="w-4 h-4 bg-white rounded-full"></div>
                      <span className="text-lg">Start Recording</span>
                    </button>
                  ) : (
                    // Currently recording
                    <div>
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="flex gap-1">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="w-2 h-8 bg-red-500 rounded-full animate-pulse"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatTime(recordingTime)}
                        </span>
                        <span className="text-sm text-gray-600">/ 60s max</span>
                      </div>

                      {/* Recording progress bar */}
                      <div className="w-full max-w-md mx-auto mb-6">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all"
                            style={{ width: `${(recordingTime / 60) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-4">
                        {!isPaused ? (
                          <button
                            onClick={pauseRecording}
                            className="bg-yellow-500 text-white px-6 py-3 rounded-xl hover:bg-yellow-600 font-semibold shadow-lg transition-all"
                          >
                            ⏸️ Pause
                          </button>
                        ) : (
                          <button
                            onClick={resumeRecording}
                            className="bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 font-semibold shadow-lg transition-all"
                          >
                            ▶️ Resume
                          </button>
                        )}
                        <button
                          onClick={stopRecording}
                          className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold shadow-lg transition-all"
                          >
                          ⏹️ Stop & Save
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recording Tips */}
                  {!isRecording && (
                    <div className="mt-6 text-left max-w-md mx-auto">
                      <p className="text-sm font-semibold text-gray-700 mb-2">💡 Recording Tips:</p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Find a quiet space with minimal background noise</li>
                        <li>• Speak clearly at a comfortable pace</li>
                        <li>• Add emotion and character voices for fun!</li>
                        <li>• Maximum 60 seconds per page</li>
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                // Recording exists - show preview and controls
                <div className="text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-lg font-semibold text-gray-900">
                      Recording saved ({formatTime(currentRecording.duration)})
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    {!isPlaying ? (
                      <button
                        onClick={playPreview}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold shadow-lg transition-all flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Preview Recording
                      </button>
                    ) : (
                      <button
                        onClick={stopPreview}
                        className="bg-gray-600 text-white px-6 py-3 rounded-xl hover:bg-gray-700 font-semibold shadow-lg transition-all flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 6h12v12H6z" />
                        </svg>
                        Stop
                      </button>
                    )}
                    <button
                      onClick={deleteRecording}
                      className="bg-red-500 text-white px-6 py-3 rounded-xl hover:bg-red-600 font-semibold shadow-lg transition-all"
                    >
                      🔄 Re-record
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={goToPreviousPage}
                disabled={currentPageIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <button
                onClick={skipPage}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Skip this page →
              </button>

              <button
                onClick={goToNextPage}
                disabled={currentPageIndex === totalPages - 1}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 font-semibold shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {currentRecording ? 'Next Page' : 'Skip & Next'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
