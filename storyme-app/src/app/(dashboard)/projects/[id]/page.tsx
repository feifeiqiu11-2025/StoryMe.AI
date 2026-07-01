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
import type { PDFFormat, PDFLayout } from '@/lib/services/pdf.service';
import ExportPdfModal from '@/components/pdf/ExportPdfModal';
import ReadingModeViewer, { ReadingPage } from '@/components/story/ReadingModeViewer';
import Tooltip from '@/components/ui/Tooltip';
import TagSelector from '@/components/story/TagSelector';
import { getLanguageLabel, getLanguageConfig } from '@/lib/config/languages';
import Recorder, { RecordingPage, SaveRecordingArgs } from '@/components/audio/Recorder';

export default function StoryViewerPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [readingPages, setReadingPages] = useState<ReadingPage[]>([]);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasEnglishAudio, setHasEnglishAudio] = useState(false);
  const [hasChineseAudio, setHasChineseAudio] = useState(false);
  const [hasSecondaryAudio, setHasSecondaryAudio] = useState(false);
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

  // Recording mode is entered/exited; all in-progress recording state lives
  // inside <Recorder> (components/audio/Recorder.tsx).
  const [recordingMode, setRecordingMode] = useState(false);
  // Server-saved audio per page (keyed by 1-based pageNumber). Fetched on
  // entry to recording mode so the recorder can offer "Edit saved audio".
  const [existingPageAudio, setExistingPageAudio] = useState<Record<number, { audioUrl: string }>>({});
  // PR 2 — per-page draft + commit metadata. Passing this in unlocks the
  // recorder's Save draft button, server-side destructive delete, and
  // hydration on reopen. Populated alongside existingPageAudio.
  const [existingPageDrafts, setExistingPageDrafts] = useState<Record<number, {
    audioPageId?: string;
    draftVocalUrl?: string | null;
    draftLayers?: any;
    committedAt?: string | null;
  }>>({});
  const [showAudioDropdown, setShowAudioDropdown] = useState(false);
  const audioDropdownRef = useRef<HTMLDivElement>(null);

  // PDF dropdown ref
  const pdfDropdownRef = useRef<HTMLDivElement>(null);

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

    return () => stopAudioPoll();
  }, [router, projectId]);

  // Close PDF dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(event.target as Node)) {
        setShowPdfDropdown(false);
      }
    };

    if (showPdfDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPdfDropdown]);

  // Close Audio dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (audioDropdownRef.current && !audioDropdownRef.current.contains(event.target as Node)) {
        setShowAudioDropdown(false);
      }
    };

    if (showAudioDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAudioDropdown]);

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

  // Polling ref for audio generation status
  const audioPollRef = useRef<NodeJS.Timeout | null>(null);

  const stopAudioPoll = () => {
    if (audioPollRef.current) {
      clearInterval(audioPollRef.current);
      audioPollRef.current = null;
    }
  };

  const startAudioPoll = () => {
    stopAudioPoll();
    audioPollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/audio-pages`);
        const data = await response.json();
        setHasAudio(data.hasAudio || false);
        setHasEnglishAudio(data.hasEnglishAudio || false);
        setHasChineseAudio(data.hasChineseAudio || false);
        setHasSecondaryAudio(data.hasSecondaryAudio || data.hasChineseAudio || false);

        if (!data.isGenerating) {
          setGeneratingAudio(false);
          stopAudioPoll();
        }
      } catch (error) {
        console.error('Error polling audio status:', error);
      }
    }, 5000);
  };

  const checkAudioExists = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/audio-pages`);
      const data = await response.json();
      setHasAudio(data.hasAudio || false);
      setHasEnglishAudio(data.hasEnglishAudio || false);
      setHasChineseAudio(data.hasChineseAudio || false);
      setHasSecondaryAudio(data.hasSecondaryAudio || data.hasChineseAudio || false);

      // Detect if audio is currently being generated in the background
      if (data.isGenerating) {
        setGeneratingAudio(true);
        startAudioPoll();
      }
    } catch (error) {
      console.error('Error checking audio:', error);
      setHasAudio(false);
      setHasEnglishAudio(false);
      setHasChineseAudio(false);
      setHasSecondaryAudio(false);
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

  // Revert this story to draft and open it in the create flow
  // (lands on the image review page since the project already has scenes + images).
  // Refuses if the story is currently public — the user must make it private first.
  const handleEditStory = async () => {
    if (!project) return;

    if (project.visibility === 'public') {
      alert('This story is currently public. Please make it private first, then click Edit again.');
      return;
    }

    const ok = window.confirm(
      `Edit "${project.title}"?\n\nThis will move the story back to draft status so you can change scenes and regenerate images. The story will not be deleted.`
    );
    if (!ok) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to revert to draft (${response.status})`);
      }
      // Hand off to the create page's existing draft-resume flow.
      // The create page reads `projectId` from search params (not `resumeProjectId`).
      router.push(`/create?projectId=${projectId}`);
    } catch (error) {
      console.error('[admin-edit] Failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to start editing');
    }
  };

  const handleGenerateAudio = async (language: string = 'en') => {
    if (!project) {
      alert('Project not loaded');
      return;
    }

    setGeneratingAudio(true);
    setShowAudioDropdown(false);

    try {
      const languageLabel = language === 'en' ? 'English' : getLanguageLabel(language);
      console.log(`🎵 Starting ${languageLabel} audio generation...`);

      const response = await fetch('/api/generate-story-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, language }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`${languageLabel} audio generated successfully!\n\n${data.successfulPages} of ${data.totalPages} pages have audio narration.`);
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

    // Fetch per-page audio + draft metadata for the recorder. Uses the
    // authenticated v1 endpoint (different from the public read endpoint
    // the rest of this page polls). The v1 endpoint lazy-inits
    // story_audio_pages rows so every narratable scene has an audioPageId,
    // which unlocks Save draft + server-side destructive delete + hydration.
    // Best-effort: on failure the recorder still opens with reduced
    // functionality (legacy host-callback save path remains the fallback).
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/audio-pages`);
      if (res.ok) {
        const data = await res.json();
        const audioMap: Record<number, { audioUrl: string }> = {};
        const draftMap: Record<number, {
          audioPageId?: string;
          draftVocalUrl?: string | null;
          draftLayers?: any;
          committedAt?: string | null;
        }> = {};
        for (const p of data.pages ?? []) {
          // Include EVERY source with audio (ai_tts, user_recorded,
          // ai_voice_clone) so users can edit-on-top of AI narration
          // without re-recording.
          if (p.hasAudio && p.audioUrl) {
            audioMap[p.pageNumber] = { audioUrl: p.audioUrl };
          }
          if (p.audioPageId) {
            draftMap[p.pageNumber] = {
              audioPageId: p.audioPageId,
              draftVocalUrl: p.draftVocalUrl,
              draftLayers: p.draftLayers,
              committedAt: p.committedAt,
            };
          }
        }
        setExistingPageAudio(audioMap);
        setExistingPageDrafts(draftMap);
      }
    } catch (err) {
      console.warn('Could not load existing audio for editing:', err);
    }

    console.log('🎙️ Entering recording mode...');
    setRecordingMode(true);
  };

  const handleCloseRecorder = () => {
    setRecordingMode(false);
  };

  // Build pages array for <Recorder>: cover + scenes + (quiz if present).
  // Mirrors the picture-book viewer's allPages order so page numbers align
  // with the story_audio_pages rows the upload endpoint writes.
  const buildRecordingPages = (): RecordingPage[] => {
    if (!project) return [];
    const sortedScenes = (project.scenes || [])
      .slice()
      .sort((a: any, b: any) => a.sceneNumber - b.sceneNumber);
    const pages: RecordingPage[] = [
      {
        pageNumber: 1,
        pageType: 'cover',
        text: project.title || '',
        imageUrl: project.coverImageUrl,
      },
    ];
    sortedScenes.forEach((scene: any) => {
      pages.push({
        pageNumber: pages.length + 1,
        pageType: 'scene',
        text: scene.caption || scene.description || '',
        textSecondary: scene.captionSecondary || scene.captionChinese,
        imageUrl: scene.images?.[0]?.imageUrl,
        refId: scene.id,
      });
    });
    if (quizQuestions.length > 0) {
      pages.push({
        pageNumber: pages.length + 1,
        pageType: 'quiz_transition',
        text: "Let's see if our little readers and listeners are paying attention!",
        imageUrl: project.coverImageUrl,
      });
      quizQuestions.forEach((q: any) => {
        pages.push({
          pageNumber: pages.length + 1,
          pageType: 'quiz_question',
          text: q.question || '',
          imageUrl: project.coverImageUrl,
          refId: q.id,
        });
      });
    }
    return pages;
  };

  const handleSaveRecording = async ({
    page,
    pageIndex,
    blob,
    duration,
    language,
    trim,
  }: SaveRecordingArgs) => {
    try {
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('language', language);
      formData.append('voiceProfileName', `${user?.name || 'User'}'s Voice`);
      formData.append('audioMetadata', JSON.stringify([{
        pageNumber: pageIndex + 1,
        pageType: page.pageType,
        sceneId: page.pageType === 'scene' ? page.refId : undefined,
        quizQuestionId: page.pageType === 'quiz_question' ? page.refId : undefined,
        textContent: page.text,
        duration,
        ...(trim ? { trimStartSec: trim.startSec, trimEndSec: trim.endSec } : {}),
      }]));
      formData.append(`audio_${pageIndex + 1}`, blob, `page-${pageIndex + 1}.webm`);

      const res = await fetch('/api/upload-user-audio', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      // The recorder uploads exactly ONE page per request, so a genuine save
      // must come back with success AND a persisted page. Checking
      // successfulPages/audioPages (not just data.success) closes the silent-
      // loss path where the server accepted the request but stored nothing —
      // the recorder would otherwise mark the page saved and drop the blob.
      const firstPage = (data.audioPages ?? [])[0];
      if (!res.ok || !data.success || (data.successfulPages ?? 0) < 1 || !firstPage) {
        const reason = data.failedPages?.[0]?.error || data.error || 'Upload failed';
        return { success: false, error: reason };
      }
      setHasAudio(true);
      // firstPage.id / audio_url drive the post-upload PATCH /layers when SFX
      // were placed on the page.
      return {
        success: true,
        audioPageId: firstPage?.id,
        audioUrl: firstPage?.audio_url,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const handleAllRecordingsSaved = async () => {
    await checkAudioExists();
    alert('All pages recorded and saved! Your audio narration is ready.');
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
        audioUrlZh: coverAudioPage?.audio_url_zh,
        audioUrlSecondary: coverAudioPage?.audio_url_secondary || coverAudioPage?.audio_url_zh,
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
          textContentChinese: scene.captionChinese,
          textContentSecondary: scene.captionSecondary || scene.captionChinese,
          audioUrl: sceneAudioPage?.audio_url,
          audioUrlZh: sceneAudioPage?.audio_url_zh,
          audioUrlSecondary: sceneAudioPage?.audio_url_secondary || sceneAudioPage?.audio_url_zh,
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

  const handleDownloadPDF = async (format: PDFFormat, layout: PDFLayout = 'classic') => {
    if (!project || !project.scenes || project.scenes.length === 0) {
      alert('No scenes to generate PDF');
      return;
    }

    setGeneratingPDF(true);
    setShowPdfDropdown(false);

    try {
      // Prepare scenes data - MUST sort by sceneNumber to ensure correct page order
      const scenesData = project.scenes
        .filter((scene: any) => scene.images && scene.images.length > 0)
        .sort((a: any, b: any) => a.sceneNumber - b.sceneNumber)
        .map((scene: any) => ({
          sceneNumber: scene.sceneNumber,
          caption: scene.caption || scene.description,  // Use caption for PDF
          caption_chinese: scene.captionChinese || scene.caption_chinese,
          caption_secondary: scene.captionSecondary || scene.caption_secondary || scene.captionChinese || scene.caption_chinese,
          description: scene.description,  // Keep for backward compatibility
          imageUrl: scene.images[0].imageUrl,
        }));

      if (scenesData.length === 0) {
        alert('No scenes with images found');
        setGeneratingPDF(false);
        return;
      }

      // Format author string from project data (leave empty if not set — kids sign the printed book)
      let authorString = project.authorName || '';
      if (authorString && project.authorAge) {
        authorString += `, age ${project.authorAge}`;
      }

      console.log('📄 PDF Download Data:');
      console.log('  - Title:', project.title);
      console.log('  - Author:', authorString);
      console.log('  - Cover URL:', project.coverImageUrl || 'NULL - will use fallback');
      console.log('  - Scenes:', scenesData.length);
      console.log('  - Format:', format);

      // Map character data for PDF designer page
      const charactersData = (project.characters || []).map((pc: any) => ({
        name: pc.character?.name || pc.name || 'Unknown',
        designerName: pc.character?.designerName || undefined,
        originalCreationUrl: pc.character?.referenceImage?.url || undefined,
        storyVersionUrl: pc.character?.animatedPreviewUrl || undefined,
      }));

      // Generate and download PDF with selected format
      await generateAndDownloadStoryPDF({
        title: project.title,
        description: project.description,
        coverImageUrl: project.coverImageUrl,
        scenes: scenesData,
        characters: charactersData,
        createdDate: new Date(project.createdAt).toLocaleDateString(),
        author: authorString,
      }, undefined, format, layout);

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

  // Check if story has bilingual content (secondary language captions)
  const hasBilingualContent = scenes.some((scene: any) => scene.captionSecondary || scene.captionChinese || scene.caption_secondary || scene.caption_chinese);

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
                    {currentPage.scene?.caption || currentPage.scene?.description || 'No description available'}
                  </p>
                  {(currentPage.scene?.captionSecondary || currentPage.scene?.captionChinese) && (
                    <p className="text-gray-500 text-base leading-relaxed mt-2">
                      {currentPage.scene.captionSecondary || currentPage.scene.captionChinese}
                    </p>
                  )}
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
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Story Actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {/* Edit story — reverts to draft and opens the create flow at the image review step */}
                  <Tooltip text="Edit this story's scenes and images">
                    <button
                      onClick={handleEditStory}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-100 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-200 font-medium transition-all"
                    >
                      <span>✏️</span>
                      <span>Edit</span>
                    </button>
                  </Tooltip>
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

                  {/* Generate Audio with Dropdown */}
                  <div className="relative" ref={audioDropdownRef}>
                    <Tooltip text={hasAudio ? "Audio ready. Click to regenerate." : "Generate AI narration for this story"}>
                      <button
                        onClick={() => setShowAudioDropdown(!showAudioDropdown)}
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
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </Tooltip>

                    {/* Audio Language Dropdown */}
                    {showAudioDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[200px]">
                        <button
                          onClick={() => handleGenerateAudio('en')}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                        >
                          <span>English Narration</span>
                          {hasEnglishAudio && <span className="text-green-600">✓</span>}
                        </button>
                        {hasBilingualContent && (
                          <button
                            onClick={() => handleGenerateAudio(project?.secondaryLanguage || 'zh')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                          >
                            <span>{getLanguageLabel(project?.secondaryLanguage || 'zh')} Narration</span>
                            {hasSecondaryAudio && <span className="text-green-600">✓</span>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Record Your Voice */}
                  <Tooltip text="Record your own voice narration for this story">
                    <button
                      onClick={handleRecordAudio}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 font-medium shadow-md transition-all"
                    >
                      <span>🎙️</span>
                      <span>Record Audio</span>
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

                  {/* Customize & Export */}
                  <Tooltip text="Customize and export your story as a PDF">
                    <button
                      onClick={() => setShowPdfModal(true)}
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
                          <span>Export</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  <ExportPdfModal
                    open={showPdfModal}
                    onClose={() => setShowPdfModal(false)}
                    onExport={(format, layout) => {
                      setShowPdfModal(false);
                      handleDownloadPDF(format, layout);
                    }}
                    exporting={generatingPDF}
                  />
                </div>
              </div>

              {/* Section 2: Publishing */}
              <div className="mb-5">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
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
                  hideEmojis
                  unwrapped
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
          secondaryLanguage={project?.secondaryLanguage}
        />
      )}

      {/* Canvas Editor: removed in this build — see comment near state declarations above. */}

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
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
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

      {recordingMode && (() => {
        const recordingPages = buildRecordingPages();
        const secondaryCode = project?.secondaryLanguage as string | undefined;
        const recorderSecondary = hasBilingualContent && secondaryCode
          ? {
              code: secondaryCode,
              label: getLanguageConfig(secondaryCode)?.nativeLabel ?? secondaryCode.toUpperCase(),
            }
          : undefined;
        return (
          <Recorder
            pages={recordingPages}
            secondaryLanguage={recorderSecondary}
            maxSecondsPerPage={60}
            initialPageIndex={currentSceneIndex}
            onPageIndexChange={setCurrentSceneIndex}
            existingPageAudio={existingPageAudio}
            existingPageDrafts={existingPageDrafts}
            onSaveRecording={handleSaveRecording}
            onClose={handleCloseRecorder}
            onAllSaved={handleAllRecordingsSaved}
          />
        );
      })()}
    </>
  );
}
