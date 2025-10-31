/**
 * Story Viewer Page
 * View individual story with all scenes
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { generateAndDownloadStoryPDF } from '@/lib/services/pdf.service';
import ReadingModeViewer, { ReadingPage } from '@/components/story/ReadingModeViewer';
import Tooltip from '@/components/ui/Tooltip';
import TagSelector from '@/components/story/TagSelector';

export default function StoryViewerPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [readingPages, setReadingPages] = useState<ReadingPage[]>([]);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [showPublicConfirm, setShowPublicConfirm] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
  const [publishingToSpotify, setPublishingToSpotify] = useState(false);
  const [kidsAppStatus, setKidsAppStatus] = useState<string | null>(null);
  const [publishingToKidsApp, setPublishingToKidsApp] = useState(false);
  const [kidsAppPublishedTo, setKidsAppPublishedTo] = useState<any[]>([]);
  const [showKidsAppModal, setShowKidsAppModal] = useState(false);
  const [childProfiles, setChildProfiles] = useState<any[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);

  // Recording mode state
  const [recordingMode, setRecordingMode] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [pageRecordings, setPageRecordings] = useState<Map<number, { blob: Blob; url: string; duration: number }>>(new Map());
  const [savedPages, setSavedPages] = useState<Set<number>>(new Set()); // Track which pages are uploaded to server
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordingChunks, setRecordingChunks] = useState<Blob[]>([]);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Draggable panel state
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
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

          // Fetch project
          await fetchProject();
        } else {
          router.push('/login');
        }
      } else {
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
            await fetchProject();
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

    loadData();
  }, [router, projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();

      if (response.ok) {
        setProject(data.project);
        // Check if audio exists
        await checkAudioExists();
        // Check Spotify status
        await checkSpotifyStatus();
        // Check Kids App status
        await checkKidsAppStatus();
        // Check Quiz status
        await checkQuizStatus();
      } else {
        console.error('Failed to fetch project:', data.error);
        router.push('/projects');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      router.push('/projects');
    }
  };

  const checkAudioExists = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/audio-pages`);
      const data = await response.json();
      setHasAudio(data.hasAudio || false);
    } catch (error) {
      console.error('Error checking audio:', error);
      setHasAudio(false);
    }
  };

  const checkSpotifyStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/spotify-status`);
      const data = await response.json();
      if (data.hasPublication) {
        setSpotifyStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking Spotify status:', error);
    }
  };

  const handleGenerateAudio = async () => {
    if (!project) {
      alert('Project not loaded');
      return;
    }

    setGeneratingAudio(true);

    try {
      console.log('🎵 Starting audio generation...');

      const response = await fetch('/api/generate-story-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Audio generated successfully!\n\n${data.successfulPages} of ${data.totalPages} pages have audio narration.`);
        setHasAudio(true);
        await checkAudioExists();
      } else {
        console.error('Audio generation failed:', data);
        alert(`❌ Audio generation failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Audio generation error:', error);
      alert(`❌ Error generating audio: ${error.message || 'Unknown error'}`);
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleRecordAudio = async () => {
    if (!project || !project.scenes || project.scenes.length === 0) {
      alert('No scenes available to record audio');
      return;
    }

    console.log('🎙️ Entering recording mode...');
    setRecordingMode(true);
  };

  const handleExitRecordingMode = () => {
    console.log('🎙️ Exiting recording mode...');

    // Stop recording if active
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
    }

    // Stop preview if playing
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Stop audio stream
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }

    setRecordingMode(false);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  // Request microphone access
  const requestMicrophoneAccess = async () => {
    try {
      if (!window.isSecureContext) {
        alert('❌ Audio recording requires HTTPS or localhost.\n\nPlease access via:\n• https://story-me-ai.vercel.app (production)\n• http://localhost:3001 (dev)');
        return null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('❌ Audio recording is not supported in your browser.\n\nPlease update to the latest version of Chrome, Firefox, Safari, or Edge.');
        return null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      return stream;
    } catch (error: any) {
      console.error('Microphone access error:', error);
      if (error.name === 'NotAllowedError') {
        alert('❌ Microphone access denied.\n\nPlease allow microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        alert('❌ No microphone found.\n\nPlease connect a microphone and try again.');
      } else {
        alert(`❌ Failed to access microphone: ${error.message}`);
      }
      return null;
    }
  };

  // Start recording for current page
  const startRecording = async () => {
    let stream = audioStream;
    if (!stream) {
      stream = await requestMicrophoneAccess();
      if (!stream) return;
    }

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000,
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = recordingTime;

        // Save recording for current page
        const newRecordings = new Map(pageRecordings);
        newRecordings.set(currentSceneIndex, { blob, url, duration });
        setPageRecordings(newRecordings);

        console.log(`✅ Recorded page ${currentSceneIndex + 1} - ${duration}s`);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecordingChunks(chunks);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      startTimeRef.current = Date.now();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          // Auto-stop at 60 seconds
          if (newTime >= 60) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (error) {
      console.error('Recording start error:', error);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);

      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= 60) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    }
  };

  const deleteRecording = () => {
    const newRecordings = new Map(pageRecordings);
    const recording = newRecordings.get(currentSceneIndex);
    if (recording) {
      URL.revokeObjectURL(recording.url);
      newRecordings.delete(currentSceneIndex);
      setPageRecordings(newRecordings);
    }
  };

  const playRecording = () => {
    const recording = pageRecordings.get(currentSceneIndex);
    if (recording && audioPreviewRef.current) {
      audioPreviewRef.current.src = recording.url;
      audioPreviewRef.current.play();
      setIsPlaying(true);
    }
  };

  const stopPreview = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Drag handlers for movable panel
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;

    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !panelRef.current) return;

    const maxX = window.innerWidth - panelRef.current.offsetWidth;
    const maxY = window.innerHeight - panelRef.current.offsetHeight;

    const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, maxX));
    const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, maxY));

    setPanelPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add/remove mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Save current page only and auto-advance to next
  const handleSaveCurrentPage = async () => {
    const recording = pageRecordings.get(currentSceneIndex);

    if (!recording) {
      alert('No recording for this page. Please record first.');
      return;
    }

    setUploadingAudio(true);

    try {
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('language', 'en');
      formData.append('voiceProfileName', `${user?.name || 'User'}'s Voice`);

      const page = allPages[currentSceneIndex];
      const metadata = [{
        pageNumber: currentSceneIndex + 1,
        pageType: page.type,
        sceneId: page.type === 'scene' ? page.scene?.id : undefined,
        quizQuestionId: page.type === 'quiz_question' ? page.question?.id : undefined,
        textContent: page.type === 'cover' ? `${page.title}` :
                    page.type === 'scene' ? page.scene?.description :
                    page.type === 'quiz_question' ? page.question?.question : '',
        duration: recording.duration,
      }];

      formData.append(`audio_${currentSceneIndex + 1}`, recording.blob, `page-${currentSceneIndex + 1}.webm`);
      formData.append('audioMetadata', JSON.stringify(metadata));

      const response = await fetch('/api/upload-user-audio', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`✅ Page ${currentSceneIndex + 1} saved successfully`);

        // Mark this page as saved
        const newSavedPages = new Set(savedPages);
        newSavedPages.add(currentSceneIndex);
        setSavedPages(newSavedPages);

        // Remove from unsaved recordings (keep blob for preview until exit)
        // URL.revokeObjectURL(recording.url);
        // const newRecordings = new Map(pageRecordings);
        // newRecordings.delete(currentSceneIndex);
        // setPageRecordings(newRecordings);

        setHasAudio(true);

        // Auto-advance to next page or exit if last page
        if (currentSceneIndex < allPages.length - 1) {
          // Go to next page
          setCurrentSceneIndex(currentSceneIndex + 1);

          // Stop any playing preview
          if (isPlaying) {
            stopPreview();
          }
        } else {
          // Last page - show success and exit
          alert(`✅ All pages recorded and saved!\n\nYour audio narration is ready.`);
          await checkAudioExists();
          handleExitRecordingMode();
        }
      } else {
        console.error('Audio upload failed:', data);
        alert(`❌ Failed to save page ${currentSceneIndex + 1}: ${data.error || 'Unknown error'}\n\nPlease try again.`);
      }
    } catch (error: any) {
      console.error('Audio upload error:', error);
      alert(`❌ Error saving audio: ${error.message || 'Unknown error'}\n\nPlease try again.`);
    } finally {
      setUploadingAudio(false);
    }
  };

  // Legacy: Save all recordings at once (keep for backward compatibility)
  const handleSaveAllRecordings = async () => {
    if (pageRecordings.size === 0) {
      alert('No recordings to save. Please record at least one page.');
      return;
    }

    setUploadingAudio(true);

    try {
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('language', 'en');
      formData.append('voiceProfileName', `${user?.name || 'User'}'s Voice`);

      const metadata: any[] = [];
      const recordings = Array.from(pageRecordings.entries());

      recordings.forEach(([pageIndex, recording]) => {
        const page = allPages[pageIndex];

        metadata.push({
          pageNumber: pageIndex + 1,
          pageType: page.type,
          sceneId: page.type === 'scene' ? page.scene?.id : undefined,
          quizQuestionId: page.type === 'quiz_question' ? page.question?.id : undefined,
          textContent: page.type === 'cover' ? `${page.title}` :
                      page.type === 'scene' ? page.scene?.description :
                      page.type === 'quiz_question' ? page.question?.question : '',
          duration: recording.duration,
        });

        formData.append(`audio_${pageIndex + 1}`, recording.blob, `page-${pageIndex + 1}.webm`);
      });

      formData.append('audioMetadata', JSON.stringify(metadata));

      const response = await fetch('/api/upload-user-audio', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Audio uploaded successfully!\n\n${data.successfulPages} of ${recordings.length} pages uploaded.`);
        setHasAudio(true);
        await checkAudioExists();
        handleExitRecordingMode();

        // Clear recordings
        pageRecordings.forEach(rec => URL.revokeObjectURL(rec.url));
        setPageRecordings(new Map());
        setSavedPages(new Set());
      } else {
        console.error('Audio upload failed:', data);
        alert(`❌ Audio upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Audio upload error:', error);
      alert(`❌ Error uploading audio: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleUploadRecordings = async (recordings: any[]) => {
    setUploadingAudio(true);

    try {
      console.log(`🎙️ Uploading ${recordings.length} audio recordings...`);

      // Prepare form data
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('language', 'en'); // TODO: Support multi-language
      formData.append('voiceProfileName', `${user?.name || 'User'}'s Voice`);

      // Build metadata array
      const metadata = recordings.map((rec, index) => {
        const page = recordingPages.find(p => p.pageNumber === rec.pageNumber);
        return {
          pageNumber: rec.pageNumber,
          pageType: page?.pageType || 'scene',
          sceneId: page?.sceneId,
          quizQuestionId: page?.quizQuestionId,
          textContent: page?.textContent || '',
          duration: rec.duration,
        };
      });

      formData.append('audioMetadata', JSON.stringify(metadata));

      // Append audio files
      recordings.forEach((rec) => {
        formData.append(`audio_${rec.pageNumber}`, rec.audioBlob, `page-${rec.pageNumber}.webm`);
      });

      // Upload to API
      const response = await fetch('/api/upload-user-audio', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Audio uploaded successfully!\n\n${data.successfulPages} of ${recordings.length} pages uploaded.`);
        setHasAudio(true);
        await checkAudioExists();
        setShowRecorder(false);
      } else {
        console.error('Audio upload failed:', data);
        alert(`❌ Audio upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Audio upload error:', error);
      alert(`❌ Error uploading audio: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleEnterReadingMode = async () => {
    if (!project || !project.scenes || project.scenes.length === 0) {
      alert('No scenes available for reading mode');
      return;
    }

    setLoadingAudio(true);

    try {
      // Fetch audio pages
      const audioResponse = await fetch(`/api/projects/${projectId}/audio-pages`);
      const audioData = await audioResponse.json();

      // Fetch quiz questions
      const quizResponse = await fetch(`/api/projects/${projectId}/quiz`);
      const quizData = await quizResponse.json();
      const quizQuestions = quizData.questions || [];

      // Build pages array
      const pages: ReadingPage[] = [];

      // Page 1: Cover page
      const coverText = project.authorName && project.authorAge
        ? `${project.title}, by ${project.authorName}, age ${project.authorAge}`
        : project.authorName
        ? `${project.title}, by ${project.authorName}`
        : project.title;

      const coverAudioPage = audioData.pages?.find((ap: any) => ap.page_type === 'cover');

      pages.push({
        pageNumber: 1,
        pageType: 'cover',
        imageUrl: project.coverImageUrl || '/api/placeholder/1024/1024',
        textContent: coverText,
        audioUrl: coverAudioPage?.audio_url,
        audioDuration: coverAudioPage?.audio_duration_seconds,
      });

      // Pages 2+: Scene pages
      const scenes = (project.scenes || [])
        .filter((scene: any) => scene.images && scene.images.length > 0)
        .sort((a: any, b: any) => a.sceneNumber - b.sceneNumber);

      scenes.forEach((scene: any, index: number) => {
        const sceneAudioPage = audioData.pages?.find((ap: any) => ap.scene_id === scene.id);

        pages.push({
          pageNumber: index + 2,
          pageType: 'scene',
          imageUrl: scene.images[0].imageUrl,
          textContent: scene.caption || scene.description,
          audioUrl: sceneAudioPage?.audio_url,
          audioDuration: sceneAudioPage?.audio_duration_seconds,
        });
      });

      // Quiz pages (if quiz exists)
      if (quizQuestions.length > 0) {
        console.log(`📚 Adding ${quizQuestions.length} quiz questions to reading mode`);

        // Add transition page
        const transitionAudioPage = audioData.pages?.find((ap: any) => ap.page_type === 'quiz_transition');
        pages.push({
          pageNumber: pages.length + 1,
          pageType: 'quiz_transition',
          imageUrl: project.coverImageUrl || '/api/placeholder/1024/1024', // Use cover image
          textContent: "Let's see if our little readers and listeners paid attention, answer some fun questions about the story!",
          audioUrl: transitionAudioPage?.audio_url,
          audioDuration: transitionAudioPage?.audio_duration_seconds,
        });

        // Add quiz question pages
        quizQuestions.forEach((question: any, index: number) => {
          const questionAudioPage = audioData.pages?.find((ap: any) => ap.quiz_question_id === question.id);

          pages.push({
            pageNumber: pages.length + 1,
            pageType: 'quiz_question',
            imageUrl: project.coverImageUrl || '/api/placeholder/1024/1024', // Use cover image
            textContent: question.question,
            audioUrl: questionAudioPage?.audio_url,
            audioDuration: questionAudioPage?.audio_duration_seconds,
            quizQuestion: {
              id: question.id,
              question: question.question,
              optionA: question.option_a,
              optionB: question.option_b,
              optionC: question.option_c,
              optionD: question.option_d,
              correctAnswer: question.correct_answer,
              explanation: question.explanation,
            },
          });
        });
      }

      console.log(`📖 Loading reading mode with ${pages.length} total pages (${scenes.length} scenes, ${quizQuestions.length} quiz questions)`);

      setReadingPages(pages);
      setReadingMode(true);

    } catch (error) {
      console.error('Error loading reading mode:', error);
      alert('Failed to load reading mode. Please try again.');
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!project || !project.scenes || project.scenes.length === 0) {
      alert('No scenes to generate PDF');
      return;
    }

    setGeneratingPDF(true);

    try {
      // Prepare scenes data - MUST sort by sceneNumber to ensure correct page order
      const scenesData = project.scenes
        .filter((scene: any) => scene.images && scene.images.length > 0)
        .sort((a: any, b: any) => a.sceneNumber - b.sceneNumber)
        .map((scene: any) => ({
          sceneNumber: scene.sceneNumber,
          description: scene.description,
          imageUrl: scene.images[0].imageUrl,
        }));

      if (scenesData.length === 0) {
        alert('No scenes with images found');
        setGeneratingPDF(false);
        return;
      }

      // Format author string from project data or fallback to user
      let authorString = project.authorName || '';
      if (authorString && project.authorAge) {
        authorString += `, age ${project.authorAge}`;
      } else if (!authorString) {
        authorString = user?.name || 'My Family';
      }

      console.log('📄 PDF Download Data:');
      console.log('  - Title:', project.title);
      console.log('  - Author:', authorString);
      console.log('  - Cover URL:', project.coverImageUrl || 'NULL - will use fallback');
      console.log('  - Scenes:', scenesData.length);

      // Generate and download PDF
      await generateAndDownloadStoryPDF({
        title: project.title,
        description: project.description,
        coverImageUrl: project.coverImageUrl,
        scenes: scenesData,
        createdDate: new Date(project.createdAt).toLocaleDateString(),
        author: authorString,
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleTogglePublic = () => {
    const currentVisibility = project?.visibility || 'private';
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';

    // If going public, show confirmation
    if (newVisibility === 'public') {
      setShowPublicConfirm(true);
    } else {
      // Going private, no confirmation needed
      updateVisibility(newVisibility);
    }
  };

  const updateVisibility = async (newVisibility: 'public' | 'private') => {
    setUpdatingVisibility(true);
    setShowPublicConfirm(false);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (response.ok) {
        // Update local state
        setProject({ ...project, visibility: newVisibility });
        alert(newVisibility === 'public' ? '✅ Story is now public!' : '✅ Story is now private.');
      } else {
        const data = await response.json();
        alert(`Failed to update visibility: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
      alert('Failed to update visibility. Please try again.');
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const handlePublishToSpotify = async () => {
    if (!project) return;

    const confirmed = confirm(
      'Publish to Spotify?\n\n' +
      'Your story will be published as an episode on the KindleWood Stories podcast. ' +
      'It will appear on Spotify within 1-6 hours.\n\n' +
      'Make sure you have generated audio for all scenes first.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setPublishingToSpotify(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/publish-spotify`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ ${data.message}`);
        setSpotifyStatus('published');
        await checkSpotifyStatus(); // Refresh status
      } else {
        alert(`❌ ${data.error}${data.details ? '\n\n' + data.details : ''}`);
      }
    } catch (error: any) {
      console.error('Spotify publishing error:', error);
      alert(`❌ Failed to publish to Spotify: ${error.message}`);
    } finally {
      setPublishingToSpotify(false);
    }
  };

  const checkKidsAppStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/publish-kids-app`);
      const data = await response.json();
      if (data.isPublished) {
        setKidsAppStatus(data.status);
        setKidsAppPublishedTo(data.publishedTo || []);
      }
    } catch (error) {
      console.error('Error checking Kids App status:', error);
    }
  };

  const fetchChildProfiles = async () => {
    try {
      const supabase = createClient();
      const { data: profiles, error } = await supabase
        .from('child_profiles')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching child profiles:', error);
        return [];
      }

      return profiles || [];
    } catch (error) {
      console.error('Error fetching child profiles:', error);
      return [];
    }
  };

  const handleKidsAppButtonClick = async () => {
    if (kidsAppStatus === 'live') {
      // Already published, show who it's published to
      const childNames = kidsAppPublishedTo.map(c => c.childName).join(', ');
      const confirmed = confirm(
        `This story is published to: ${childNames}\n\n` +
        'Would you like to unpublish it from the Kids App?'
      );
      if (confirmed) {
        await handleUnpublishFromKidsApp();
      }
      return;
    }

    // Not published yet, show selection modal
    const profiles = await fetchChildProfiles();
    if (profiles.length === 0) {
      alert('No child profiles found. Please create child profiles in the KindleWood Kids App first.');
      return;
    }

    setChildProfiles(profiles);
    setSelectedChildren(profiles.map(p => p.id)); // Select all by default
    setShowKidsAppModal(true);
  };

  const handlePublishToKidsApp = async () => {
    if (!project || selectedChildren.length === 0) {
      alert('Please select at least one child profile');
      return;
    }

    setPublishingToKidsApp(true);
    setShowKidsAppModal(false);

    try {
      const response = await fetch(`/api/projects/${projectId}/publish-kids-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childProfileIds: selectedChildren,
          category: 'bedtime',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ ${data.message}`);
        setKidsAppStatus('live');
        await checkKidsAppStatus();
      } else {
        alert(`❌ ${data.error}${data.message ? '\n\n' + data.message : ''}`);
      }
    } catch (error: any) {
      console.error('Kids App publishing error:', error);
      alert(`❌ Failed to publish to Kids App: ${error.message}`);
    } finally {
      setPublishingToKidsApp(false);
    }
  };

  const handleUnpublishFromKidsApp = async () => {
    setPublishingToKidsApp(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/publish-kids-app`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ Story unpublished from Kids App');
        setKidsAppStatus(null);
        setKidsAppPublishedTo([]);
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error: any) {
      console.error('Kids App unpublish error:', error);
      alert(`❌ Failed to unpublish: ${error.message}`);
    } finally {
      setPublishingToKidsApp(false);
    }
  };

  const checkQuizStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/quiz`);
      const data = await response.json();
      if (data.exists) {
        setHasQuiz(true);
        setQuizQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Error checking quiz status:', error);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!project) return;

    const confirmed = confirm(
      'Generate Quiz?\n\n' +
      'AI will create 3 comprehension questions for this story.\n' +
      (hasAudio ? 'Audio will be generated automatically for the questions.\n\n' : 'Note: Story has no audio, quiz will be text-only.\n\n') +
      'This may take 1-2 minutes. Continue?'
    );

    if (!confirmed) return;

    setGeneratingQuiz(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/quiz`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ ${data.message}\n\n${data.questions.length} questions created!`);
        setHasQuiz(true);
        setQuizQuestions(data.questions);
        await checkQuizStatus();
      } else {
        alert(`❌ ${data.error}${data.details ? '\n\n' + data.details : ''}`);
      }
    } catch (error: any) {
      console.error('Quiz generation error:', error);
      alert(`❌ Failed to generate quiz: ${error.message}`);
    } finally {
      setGeneratingQuiz(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading story...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  // IMPORTANT: Sort scenes by sceneNumber to ensure correct page order
  const scenes = (project.scenes || []).sort((a: any, b: any) => a.sceneNumber - b.sceneNumber);

  // Build combined pages array: cover + scenes + quiz
  const allPages = [
    // Cover page (first page)
    {
      type: 'cover',
      title: project.title,
      author: project.authorName,
      age: project.authorAge,
      coverImageUrl: project.coverImageUrl,
    },
    // Scene pages
    ...scenes.map((scene: any, index: number) => ({
      type: 'scene',
      sceneIndex: index,
      scene: scene,
      image: scene.images?.[0],
    })),
    // Quiz pages (if any)
    ...(quizQuestions.length > 0 ? [
      {
        type: 'quiz_transition',
        title: "Let's see if our little readers and listeners are paying attention!",
      },
      ...quizQuestions.map((question: any, index: number) => ({
        type: 'quiz_question',
        questionIndex: index,
        question: question,
      }))
    ] : [])
  ];

  const currentPage = allPages[currentSceneIndex];

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Story Header */}
        <div className="mb-8">
          <Link href="/projects" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
            ← Back to My Stories
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{project.title}</h1>
          {project.description && (
            <p className="text-gray-600 text-lg">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>{scenes.length} scenes</span>
            {quizQuestions.length > 0 && (
              <>
                <span>•</span>
                <span>{quizQuestions.length} quiz questions</span>
              </>
            )}
            <span>•</span>
            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Story Viewer */}
        {scenes.length > 0 ? (
          <div className="space-y-6">
            {/* Page Display with Overlay Controls */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden relative">
              {/* Content Area */}
              {currentPage?.type === 'cover' ? (
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  {currentPage.coverImageUrl ? (
                    <img
                      src={currentPage.coverImageUrl}
                      alt="Story cover"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-8xl">📖</span>
                    </div>
                  )}
                </div>
              ) : currentPage?.type === 'scene' && currentPage.image?.imageUrl ? (
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
                  <img
                    src={currentPage.image.imageUrl}
                    alt={`Scene ${currentPage.sceneIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : currentPage?.type === 'quiz_transition' ? (
                <div className="aspect-video bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📚</div>
                    <h2 className="text-3xl font-bold text-gray-900">Quiz Time!</h2>
                  </div>
                </div>
              ) : currentPage?.type === 'quiz_question' ? (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-8 min-h-[400px]">
                  <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-4">
                      <span className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                        Question {currentPage.questionIndex + 1} of {quizQuestions.length}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                      {currentPage.question.question}
                    </h3>
                    <div className="space-y-3">
                      {[
                        { letter: 'A', text: currentPage.question.option_a },
                        { letter: 'B', text: currentPage.question.option_b },
                        { letter: 'C', text: currentPage.question.option_c },
                        { letter: 'D', text: currentPage.question.option_d },
                      ].map((option) => (
                        <div
                          key={option.letter}
                          className="p-4 rounded-lg border-2 border-gray-300 bg-white transition-all hover:border-purple-400 hover:bg-purple-50"
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
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
                  <img
                    src={project.coverImageUrl || '/api/placeholder/1024/1024'}
                    alt="Story cover"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Navigation Controls */}
              <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                <button
                  onClick={() => setCurrentSceneIndex(Math.max(0, currentSceneIndex - 1))}
                  disabled={currentSceneIndex === 0}
                  className="pointer-events-auto bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => setCurrentSceneIndex(Math.min(allPages.length - 1, currentSceneIndex + 1))}
                  disabled={currentSceneIndex === allPages.length - 1}
                  className="pointer-events-auto bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Page Indicator */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black bg-opacity-60 px-4 py-2 rounded-full max-w-[90%] overflow-x-auto">
                {allPages.map((_: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSceneIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all flex-shrink-0 ${
                      index === currentSceneIndex
                        ? 'bg-white w-6'
                        : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                    }`}
                  />
                ))}
              </div>

              {/* Page Counter */}
              <div className="absolute top-4 right-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm font-semibold">
                {currentSceneIndex + 1} / {allPages.length}
              </div>

              {/* Text Content */}
              {currentPage?.type === 'scene' && (
                <div className="p-8">
                  <p className="text-gray-800 text-lg leading-relaxed">
                    {currentPage.scene?.description || 'No description available'}
                  </p>
                </div>
              )}

              {currentPage?.type === 'quiz_transition' && (
                <div className="p-8 text-center">
                  <p className="text-gray-600 text-xl font-medium">
                    {currentPage.title}
                  </p>
                </div>
              )}

              {/* Explanation hidden - kids should figure out on their own */}
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              {/* Section 1: Story Actions */}
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Story Actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {/* Read Mode */}
                  <Tooltip text="Read this story in fullscreen mode with narration">
                    <button
                      onClick={handleEnterReadingMode}
                      disabled={loadingAudio}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingAudio ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <span>📖</span>
                          <span>Read Mode</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Generate Audio / Audio Ready */}
                  <Tooltip text={hasAudio ? "Audio ready. Click to regenerate." : "Generate AI narration for this story"}>
                    <button
                      onClick={handleGenerateAudio}
                      disabled={generatingAudio}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        hasAudio
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-500 text-white hover:bg-gray-600'
                      }`}
                    >
                      {generatingAudio ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <span>🎵</span>
                          <span>{hasAudio ? 'Audio Ready ✓' : 'Generate Audio'}</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Record Your Voice */}
                  <Tooltip text="Record your own voice narration for this story">
                    <button
                      onClick={handleRecordAudio}
                      disabled={uploadingAudio}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingAudio ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <span>🎙️</span>
                          <span>Record Audio</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Generate Quiz */}
                  <Tooltip text={hasQuiz ? `Quiz ready (${quizQuestions.length} questions). Click to regenerate.` : "Generate quiz questions with AI"}>
                    <button
                      onClick={handleGenerateQuiz}
                      disabled={generatingQuiz}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        hasQuiz
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      {generatingQuiz ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <span>🧠</span>
                          <span>{hasQuiz ? 'Quiz Ready ✓' : 'Generate Quiz'}</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Export PDF */}
                  <Tooltip text="Download this story as a PDF file">
                    <button
                      onClick={handleDownloadPDF}
                      disabled={generatingPDF}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingPDF ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Exporting...</span>
                        </>
                      ) : (
                        <>
                          <span>📄</span>
                          <span>Export PDF</span>
                        </>
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Section 2: Publishing */}
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Publishing
                </h3>
                <div className="flex flex-wrap gap-2">
                  {/* Make Public / Private */}
                  <Tooltip text={project?.visibility === 'public' ? "Make this story private" : "Make this story visible to everyone"}>
                    <button
                      onClick={handleTogglePublic}
                      disabled={updatingVisibility}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        project?.visibility === 'public'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      {updatingVisibility ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <span>{project?.visibility === 'public' ? '🌍' : '🔒'}</span>
                          <span>{project?.visibility === 'public' ? 'Public' : 'Make Public'}</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Publish to Spotify */}
                  <Tooltip text={
                    spotifyStatus === 'live'
                      ? "Live on Spotify! Click to view"
                      : spotifyStatus === 'published'
                      ? "Published! Will appear on Spotify within 1-6 hours"
                      : spotifyStatus === 'compiling'
                      ? "Compiling audio for Spotify..."
                      : "Publish this story to Spotify as a podcast episode"
                  }>
                    <button
                      onClick={handlePublishToSpotify}
                      disabled={publishingToSpotify || ['compiling', 'published', 'live'].includes(spotifyStatus || '')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        spotifyStatus === 'live'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : spotifyStatus === 'published'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : spotifyStatus === 'compiling'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-500 text-white hover:bg-gray-600'
                      }`}
                    >
                      {publishingToSpotify ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Publishing...</span>
                        </>
                      ) : (
                        <>
                          <span>🎵</span>
                          <span>
                            {spotifyStatus === 'live'
                              ? 'On Spotify ✓'
                              : spotifyStatus === 'published'
                              ? 'Published'
                              : spotifyStatus === 'compiling'
                              ? 'Compiling...'
                              : 'Spotify'
                            }
                          </span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Kids App Publishing */}
                  <Tooltip text={kidsAppStatus === 'live' ? `Published to ${kidsAppPublishedTo.length} child(ren)` : "Publish this story to KindleWood Kids App"}>
                    <button
                      onClick={handleKidsAppButtonClick}
                      disabled={publishingToKidsApp}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all ${
                        kidsAppStatus === 'live'
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      } ${publishingToKidsApp ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {publishingToKidsApp ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Publishing...</span>
                        </>
                      ) : (
                        <>
                          <span>📱</span>
                          <span>
                            {kidsAppStatus === 'live' ? 'Kids App ✓' : 'Kids App'}
                          </span>
                        </>
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Section 3: Tags & Categories */}
              <div className="mb-5">
                <TagSelector
                  projectId={projectId}
                  initialTags={project.tags || []}
                />
              </div>

              {/* Back to Top - Bottom Right */}
              <div className="flex justify-end">
                <Tooltip text="Scroll back to top of page">
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium shadow-md transition-all"
                  >
                    <span>↑</span>
                    <span>Back to Top</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Scenes Found
            </h2>
            <p className="text-gray-600">
              This story doesn't have any scenes yet.
            </p>
          </div>
        )}
      </div>

      {/* Reading Mode Viewer */}
      {readingMode && readingPages.length > 0 && (
        <ReadingModeViewer
          projectId={projectId}
          projectTitle={project?.title || 'Storybook'}
          pages={readingPages}
          onExit={() => setReadingMode(false)}
        />
      )}

      {/* Public Confirmation Modal */}
      {showPublicConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Make Story Public?</h3>
            <p className="text-gray-600 mb-4">
              Your story will be visible to everyone on the landing page and public gallery.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 font-medium">
                💡 Important: Make sure your story doesn't contain personal information like addresses, phone numbers, or school names.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => updateVisibility('public')}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-semibold transition-all"
              >
                Make Public
              </button>
              <button
                onClick={() => setShowPublicConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kids App Child Selection Modal */}
      {showKidsAppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Publish to Kids App
            </h2>
            <p className="text-gray-600 mb-6">
              Select which children can read "{project?.title}" in the KindleWood Kids App:
            </p>

            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
              {childProfiles.map((child) => (
                <label
                  key={child.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedChildren.includes(child.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedChildren([...selectedChildren, child.id]);
                      } else {
                        setSelectedChildren(selectedChildren.filter(id => id !== child.id));
                      }
                    }}
                    className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-lg font-medium text-gray-900">
                    {child.name}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePublishToKidsApp}
                disabled={selectedChildren.length === 0}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                  selectedChildren.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Publish to {selectedChildren.length} {selectedChildren.length === 1 ? 'Child' : 'Children'}
              </button>
              <button
                onClick={() => setShowKidsAppModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recording Mode Overlay - Shows recording controls over the story viewer */}
      {recordingMode && (
        <>
          {/* Hidden audio element for preview */}
          <audio
            ref={audioPreviewRef}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Recording panel - draggable, positioned at bottom-right by default */}
          <div
            ref={panelRef}
            className="fixed z-50 max-w-md"
            style={{
              left: panelPosition.x ? `${panelPosition.x}px` : 'auto',
              top: panelPosition.y ? `${panelPosition.y}px` : 'auto',
              right: !panelPosition.x ? '1rem' : 'auto',
              bottom: !panelPosition.y ? '1rem' : 'auto',
              cursor: isDragging ? 'grabbing' : 'auto',
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl p-6 border-2 border-purple-200">
              {/* Drag Handle + Header */}
              <div
                onMouseDown={handleMouseDown}
                className="flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="w-3 h-0.5 bg-gray-400 rounded"></div>
                      <div className="w-3 h-0.5 bg-gray-400 rounded"></div>
                      <div className="w-3 h-0.5 bg-gray-400 rounded"></div>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">🎙️ Recording Mode</h3>
                  </div>
                  <p className="text-xs text-gray-600 ml-5">
                    <span className="text-green-600 font-semibold">{savedPages.size} saved</span>
                    {pageRecordings.size > savedPages.size && (
                      <span className="text-yellow-600 font-semibold">, {pageRecordings.size - savedPages.size} recorded</span>
                    )}
                    <span className="text-gray-500">, {allPages.length - pageRecordings.size} remaining</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveCurrentPage}
                    disabled={uploadingAudio || !pageRecordings.has(currentSceneIndex)}
                    className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-1.5 rounded-lg hover:from-green-700 hover:to-blue-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                  >
                    {uploadingAudio ? (
                      <span className="flex items-center gap-1.5">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        Saving...
                      </span>
                    ) : currentSceneIndex === allPages.length - 1 ? (
                      'Save & Finish'
                    ) : (
                      'Save & Continue'
                    )}
                  </button>
                  <button
                    onClick={handleExitRecordingMode}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Recording Controls */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4">
                <div className="mb-3 text-center">
                  <span className="text-xs font-semibold text-gray-700">Page {currentSceneIndex + 1} of {allPages.length}</span>
                </div>

                {pageRecordings.has(currentSceneIndex) ? (
                  // Has recording - show preview controls
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      {savedPages.has(currentSceneIndex) ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-green-700 font-semibold text-sm">✅ Saved ({formatTime(pageRecordings.get(currentSceneIndex)!.duration)})</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                          <span className="text-yellow-700 font-semibold text-sm">🟡 Recorded ({formatTime(pageRecordings.get(currentSceneIndex)!.duration)}) - Not saved yet</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={isPlaying ? stopPreview : playRecording}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold shadow-lg transition-all text-sm"
                      >
                        {isPlaying ? '⏹️ Stop' : '▶️ Play'}
                      </button>
                      <button
                        onClick={deleteRecording}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold shadow-lg transition-all text-sm"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ) : !isRecording ? (
                  // No recording - show start button
                  <div className="text-center">
                    <button
                      onClick={startRecording}
                      className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-full hover:from-red-600 hover:to-pink-600 font-semibold shadow-lg transition-all w-full"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                        <span>Start Recording</span>
                      </div>
                    </button>
                    <p className="text-xs text-gray-600 mt-2">
                      Max 60s per page
                    </p>
                  </div>
                ) : (
                  // Recording in progress
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="flex gap-1">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1.5 h-6 bg-red-500 rounded-full animate-pulse"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                      <span className="text-xl font-bold text-gray-900">
                        {formatTime(recordingTime)}
                      </span>
                      <span className="text-xs text-gray-600">/ 60s</span>
                    </div>

                    <div className="w-full mb-4">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all"
                          style={{ width: `${(recordingTime / 60) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {!isPaused ? (
                        <button
                          onClick={pauseRecording}
                          className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 font-semibold shadow-lg transition-all text-sm"
                        >
                          ⏸️ Pause
                        </button>
                      ) : (
                        <button
                          onClick={resumeRecording}
                          className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 font-semibold shadow-lg transition-all text-sm"
                        >
                          ▶️ Resume
                        </button>
                      )}
                      <button
                        onClick={stopRecording}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold shadow-lg transition-all text-sm"
                      >
                        ⏹️ Stop
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
