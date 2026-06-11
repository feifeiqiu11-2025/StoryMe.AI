/**
 * Authenticated Story Creation Page
 * For logged-in users to create stories with character library
 */

'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import CharacterManager from '@/components/story/CharacterManager';
import CharacterFormModal from '@/components/story/CharacterFormModal';
import ScriptInput from '@/components/story/ScriptInput';
import StorySettingsPanel from '@/components/story/StorySettingsPanel';
import ScenePreviewApproval from '@/components/story/ScenePreviewApproval';
import { ArtStyleType } from '@/components/story/StyleSelector';
import GenerationProgress from '@/components/story/GenerationProgress';
import ImageGallery from '@/components/story/ImageGallery';
import FeedbackModal from '@/components/feedback/FeedbackModal';
import { Character, Scene, StorySession, GeneratedImage, StoryTone, EnhancedScene, ExpansionLevel, ClothingConsistency, ImageProvider, DEFAULT_SCENE_IMAGE_PROVIDER, VISIBLE_IMAGE_PROVIDER_OPTIONS } from '@/lib/types/story';
import type { StoryBibleResult } from '@/lib/ai/scene-enhancer';
import { StoryTemplateId, STORY_TEMPLATES } from '@/lib/ai/story-templates';
import { parseScriptIntoScenes } from '@/lib/scene-parser';
import Link from 'next/link';
import { generateAndDownloadStoryPDF } from '@/lib/services/pdf.service';
import { getGuestStory, clearGuestStory } from '@/lib/utils/guest-story-storage';
import { thumbnailUrl } from '@/lib/utils/image-transform';
import EditImageControl from '@/components/story/EditImageControl';
import { WritingCoachContent } from '@/components/story/WritingCoachModal';
import { buildCoverPrompt } from '@/lib/ai/cover-prompt-builder';
import {
  saveClicked,
  savePreuploadStarted,
  savePreuploadFailed,
  saveRequestSent,
  saveRequestSucceeded,
  saveRequestFailed,
} from '@/lib/telemetry/save-events';
import { identify as identifyTelemetry } from '@/lib/telemetry/posthog';
import { useAutosaveDraft, type RunAutosaveResult } from './useAutosaveDraft';

// Safety margin under the ~500KB JSONB metadata cap on the save-draft route.
const MAX_DRAFT_PAYLOAD_BYTES = 450 * 1024;
const AUTOSAVE_DEBOUNCE_MS = 3 * 60 * 1000;

const CHARACTERS_STORAGE_KEY = 'storyme_character_library';
const ART_STYLE = "children's book illustration, colorful, whimsical";

function CreateStoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Story creation state
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scriptInput, setScriptInput] = useState('');
  const [parsedScenes, setParsedScenes] = useState<Scene[]>([]);

  // Story settings (NEW)
  const [readingLevel, setReadingLevel] = useState<number>(5);
  const [storyTone, setStoryTone] = useState<StoryTone>('playful');
  const [clothingConsistency, setClothingConsistency] = useState<ClothingConsistency>('consistent');
  const [expansionLevel, setExpansionLevel] = useState<ExpansionLevel>('as_written');

  // Template + Writing Coach state
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplateId | null>('sel');
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);

  // Language selection (NEW - Bilingual Support)
  const [contentLanguage, setContentLanguage] = useState<'en' | 'zh'>('en');

  // Secondary language for bilingual support (NEW - replaces generateChineseTranslation)
  const [secondaryLanguage, setSecondaryLanguage] = useState<string | null>(null);

  // Enhancement state (NEW)
  const [enhancedScenes, setEnhancedScenes] = useState<EnhancedScene[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Story bible (pronoun-resolved scenes + locked locations). Produced by enhance-scenes
  // when enableStoryBible=true and threaded through generate-images + save for persistence.
  const [storyBible, setStoryBible] = useState<StoryBibleResult | null>(null);
  // Bible location temp_ids the user has already promoted to their character library via the
  // "Save to library" bookmark. Used to disable the bookmark button after a successful save.
  const [savedLocationTempIds, setSavedLocationTempIds] = useState<Set<string>>(new Set());
  // Scenes whose prompts/captions need rewriting because the user edited characters/location on them.
  // Cleared after the Approve-time refresh-prompts call succeeds.
  const [stalePromptSceneNumbers, setStalePromptSceneNumbers] = useState<Set<number>>(new Set());
  // When the user clicks "+ Add" on a scene's chip row, we reuse the existing Import modal.
  // This number tells the import handler to ALSO append the character to that scene's bible entry
  // and mark the scene stale. Null outside of that flow. Cleared on modal close or success.
  const [addCharToSceneNumber, setAddCharToSceneNumber] = useState<number | null>(null);

  // Story metadata state (NEW - generated during enhancement)
  const [storyTitle, setStoryTitle] = useState<string>('');
  const [storyDescription, setStoryDescription] = useState<string>('');

  // Image generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imageGenerationStatus, setImageGenerationStatus] = useState<GeneratedImage[]>([]);
  const [imageProvider, setImageProvider] = useState<ImageProvider>(DEFAULT_SCENE_IMAGE_PROVIDER);

  // Art style selection (3D Pixar default for better quality)
  const [artStyle, setArtStyle] = useState<ArtStyleType>('pixar');

  // UI state
  const [session, setSession] = useState<StorySession | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddCharacterModal, setShowAddCharacterModal] = useState(false);
  const [definingNewCharacterName, setDefiningNewCharacterName] = useState<string | null>(null);
  const [libraryCharacters, setLibraryCharacters] = useState<Character[]>([]);
  const [communityCharacters, setCommunityCharacters] = useState<Character[]>([]);
  // Pagination + lazy-load flags for the Import-from-Library modal.
  // `loaded` lets us cache results across modal close→reopen; `hasMore` drives
  // the Load-more button. Tabs are fetched on demand: Mine when the modal
  // opens, Community only when the user clicks that tab.
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryHasMore, setLibraryHasMore] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const [communityHasMore, setCommunityHasMore] = useState(false);
  const [importTab, setImportTab] = useState<'mine' | 'community'>('mine');
  // Search filter for the import-from-library modal. Reused by both the
  // top-level "Import from Library" button and the per-scene "+ Add to
  // scene" entrypoint — keeps the picker usable as libraries grow large.
  const [importSearch, setImportSearch] = useState('');
  // Server-side search results for the import modal. Without these, the
  // search box would only filter the paginated `libraryCharacters` /
  // `communityCharacters` cache — meaning a kid with 400 characters who
  // hasn't clicked "Load more" enough times would get phantom "no results"
  // for a character that exists. `null` = no active search; `[]` = searched
  // and empty.
  const [importSearchResults, setImportSearchResults] = useState<Character[] | null>(null);
  const [importSearching, setImportSearching] = useState(false);
  // Race-condition guard: each search bump invalidates earlier in-flight
  // queries so a slow first result can't overwrite a fast second.
  const importSearchKeyRef = useRef(0);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorAge, setAuthorAge] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Surfaces image-generation failures (e.g. trial/daily image limit → 429, or a
  // server error) that previously failed silently. isLimit drives the upgrade CTA.
  const [generationError, setGenerationError] = useState<{ message: string; isLimit: boolean } | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  // Cover preview state
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImagePrompt, setCoverImagePrompt] = useState<string>('');
  const [customCoverPrompt, setCustomCoverPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [coverApproved, setCoverApproved] = useState(false);

  // Quiz generation state
  const [quizData, setQuizData] = useState<any>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(3);

  // Draft state
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);
  const [restoringDraft, setRestoringDraft] = useState(false);
  // Prevents the resume-draft effect from re-running when we push ?projectId=
  // into the URL after a first save — otherwise server state would overwrite
  // the user's in-memory edits.
  const hasResumedRef = useRef(false);

  useEffect(() => {
    const loadUser = async () => {
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
          identifyTelemetry(supabaseUser.id);
        } else {
          router.push('/login');
        }
      } else {
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
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

    loadUser();
  }, [router]);

  // Check story creation limits on page load
  useEffect(() => {
    const checkLimits = async () => {
      if (!user) return;

      try {
        const response = await fetch('/api/usage/limits');
        const data = await response.json();

        if (!response.ok) {
          console.error('Failed to check limits:', data);
          return;
        }

        // Check if user can create stories
        if (!data.canCreate) {
          // Redirect to limit-reached transition page
          router.push('/limit-reached');
        }
      } catch (error) {
        console.error('Error checking limits:', error);
      }
    };

    checkLimits();
  }, [user, router]);

  // Restore guest story if user just signed in from guest mode
  useEffect(() => {
    if (user) {
      const guestStory = getGuestStory();

      if (guestStory && guestStory.generatedImages.length > 0) {
        console.log('Restoring guest story to authenticated create page...');

        // Restore the story state
        setCharacters(guestStory.characters);
        setScriptInput(guestStory.script);
        setReadingLevel(guestStory.readingLevel);
        setStoryTone(guestStory.storyTone as StoryTone);
        setEnhancedScenes(guestStory.enhancedScenes);
        setImageGenerationStatus(guestStory.generatedImages);

        // Set session to completed state
        setSession({
          characters: guestStory.characters,
          script: guestStory.script,
          scenes: [],
          generatedImages: guestStory.generatedImages,
          status: 'completed',
        });

        // Show save modal automatically
        setShowSaveModal(true);

        console.log('✓ Guest story restored, showing save modal');
      }
    }
  }, [user]);

  // Lazy-fetch character lists for the Import-from-Library modal.
  // - Mine: fetched the first time the modal opens (Mine is the default tab).
  // - Community: fetched the first time the user clicks the Community tab.
  // Cached across modal close→reopen via the `loaded` flags; refreshed
  // explicitly by handleSaveToLibrary after a new char is added.
  useEffect(() => {
    if (!showImportModal || !user?.id) return;
    if (importTab === 'mine' && !libraryLoaded && !libraryLoading) {
      loadLibraryCharacters(user.id, 0);
    } else if (importTab === 'community' && !communityLoaded && !communityLoading) {
      loadCommunityCharacters(0);
    }
    // loadLibraryCharacters/loadCommunityCharacters are stable references in
    // this component; intentionally omitted from deps to avoid re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showImportModal, importTab, user?.id, libraryLoaded, communityLoaded]);

  // Clear the search box every time the modal reopens so each session
  // feels fresh. Not all close paths clear it on the way out — e.g.
  // handleImportCharacter just sets showImportModal(false) — so the open
  // side is where we guarantee a clean state.
  useEffect(() => {
    if (showImportModal) setImportSearch('');
  }, [showImportModal]);

  // Debounced server-side search for the import modal. Client-side filter
  // on the paginated cache misses characters that haven't been loaded yet
  // (matches the fix already in CharacterPickerModal). Debounce so a kid
  // typing "dragon" produces one query, not seven.
  useEffect(() => {
    if (!showImportModal) return;
    const q = importSearch.trim();
    if (!q) {
      setImportSearchResults(null);
      setImportSearching(false);
      return;
    }
    if (!user?.id) return;

    importSearchKeyRef.current += 1;
    const myKey = importSearchKeyRef.current;
    setImportSearching(true);

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const isMine = importTab === 'mine';
        const base = supabase
          .from('character_library')
          .select(IMPORT_SELECT_COLUMNS)
          .ilike('name', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(100);
        const { data, error } = isMine
          ? await base.eq('user_id', user.id)
          : await base.eq('is_public', true);
        if (myKey !== importSearchKeyRef.current) return; // stale
        if (error) throw error;
        const rows = (data || []).map((char: any) => mapLibraryRow(char, !isMine));
        setImportSearchResults(rows);
      } catch (err) {
        if (myKey !== importSearchKeyRef.current) return;
        console.error('Character search failed:', err);
        setImportSearchResults([]);
      } finally {
        if (myKey === importSearchKeyRef.current) setImportSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
    // IMPORT_SELECT_COLUMNS and mapLibraryRow are stable in-component constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showImportModal, importTab, importSearch, user?.id]);

  // Resume from draft via ?projectId= URL parameter
  useEffect(() => {
    const resumeProjectId = searchParams.get('projectId');
    if (!user || !resumeProjectId || restoringDraft || hasResumedRef.current) return;

    const restoreDraft = async () => {
      setRestoringDraft(true);
      hasResumedRef.current = true;
      try {
        console.log(`Resuming draft: ${resumeProjectId}`);
        const response = await fetch(`/api/projects/${resumeProjectId}`);
        const data = await response.json();

        if (!response.ok) {
          console.error('Failed to load draft:', data.error);
          setRestoringDraft(false);
          return;
        }

        const project = data.project;
        if (project.status !== 'draft') {
          console.log('Project is not a draft, skipping restore');
          setRestoringDraft(false);
          return;
        }

        setDraftProjectId(resumeProjectId);
        const meta = project.draftMetadata || {};

        // Restore characters from draft metadata (has full client-side Character shape)
        if (meta.characters && meta.characters.length > 0) {
          setCharacters(meta.characters);
        }

        // Restore script
        if (project.originalScript) {
          setScriptInput(project.originalScript);
        }

        // Restore settings from project columns + metadata
        if (project.readingLevel) setReadingLevel(project.readingLevel);
        if (meta.storyTone) setStoryTone(meta.storyTone as StoryTone);
        if (meta.clothingConsistency) setClothingConsistency(meta.clothingConsistency as ClothingConsistency);
        if (meta.expansionLevel) setExpansionLevel(meta.expansionLevel as ExpansionLevel);
        if (meta.artStyle) setArtStyle(meta.artStyle as ArtStyleType);
        if (meta.imageProvider) {
          // Coerce drafts saved with a now-hidden/legacy model to the current default.
          const savedProvider = meta.imageProvider as ImageProvider;
          const stillVisible = VISIBLE_IMAGE_PROVIDER_OPTIONS.some((o) => o.value === savedProvider);
          setImageProvider(stillVisible ? savedProvider : DEFAULT_SCENE_IMAGE_PROVIDER);
        }
        if (meta.secondaryLanguage) {
          setSecondaryLanguage(meta.secondaryLanguage);
        } else if (meta.generateChineseTranslation === true) {
          setSecondaryLanguage('zh'); // migrate old format
        }
        if (meta.selectedTemplate) setSelectedTemplate(meta.selectedTemplate);
        if (meta.contentLanguage) setContentLanguage(meta.contentLanguage);

        // Restore enhanced scenes from metadata
        if (meta.enhancedScenes && meta.enhancedScenes.length > 0) {
          setEnhancedScenes(meta.enhancedScenes);
        }

        // Restore story bible (Characters/Scene chips + editors rehydrate from this).
        // Only surfaces for drafts saved AFTER the bible changes; older drafts have no storyBible
        // field and the user can re-click Enhance to generate one.
        if (meta.storyBible) {
          setStoryBible(meta.storyBible as StoryBibleResult);
        }

        // Restore story metadata
        if (project.title && project.title !== 'Untitled Draft') setStoryTitle(project.title);
        if (project.description) setStoryDescription(project.description);

        // Restore image generation status from metadata
        if (meta.imageGenerationStatus && meta.imageGenerationStatus.length > 0) {
          setImageGenerationStatus(meta.imageGenerationStatus);
          // Extract image URLs for the generatedImages array
          const urls = meta.imageGenerationStatus
            .filter((img: any) => img.imageUrl && img.status === 'completed')
            .map((img: any) => img.imageUrl);
          if (urls.length > 0) setGeneratedImages(urls);

          // Set session to completed state if images exist
          setSession({
            characters: meta.characters || [],
            script: project.originalScript || '',
            scenes: [],
            generatedImages: meta.imageGenerationStatus,
            status: 'completed',
          });
        }

        // Restore cover state
        if (meta.coverImagePrompt) setCoverImagePrompt(meta.coverImagePrompt);
        if (meta.customCoverPrompt) setCustomCoverPrompt(meta.customCoverPrompt);
        if (meta.coverApproved !== undefined) setCoverApproved(meta.coverApproved);
        if (project.coverImageUrl) setCoverImageUrl(project.coverImageUrl);

        // Restore quiz state
        if (meta.quizData) setQuizData(meta.quizData);
        if (meta.quizDifficulty) setQuizDifficulty(meta.quizDifficulty);
        if (meta.quizQuestionCount) setQuizQuestionCount(meta.quizQuestionCount);

        // Restore author info
        if (meta.authorName) setAuthorName(meta.authorName);
        if (meta.authorAge) setAuthorAge(meta.authorAge);

        console.log('Draft restored successfully');
      } catch (error) {
        console.error('Error restoring draft:', error);
      } finally {
        setRestoringDraft(false);
      }
    };

    restoreDraft();
  }, [user, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCharactersChange = (newCharacters: Character[]) => {
    setCharacters(newCharacters);
  };

  // Page size for the Import-from-Library modal. Matches the chunk size used
  // by CharacterPickerModal so behavior is consistent across pickers.
  const IMPORT_PAGE_SIZE = 24;

  // Columns the modal actually needs. Avoids the previous `select('*')` which
  // pulled `character_embedding`, `reference_images[]` (with per-pose embeddings),
  // `ai_description`, etc. — heavy payloads that the picker grid doesn't use.
  const IMPORT_SELECT_COLUMNS =
    'id, name, reference_image_url, reference_image_filename, animated_preview_url, hair_color, skin_tone, clothing, age, other_features, subject_type, role';

  const mapLibraryRow = (char: any, isPublic = false): Character => ({
    id: char.id,
    name: char.name,
    referenceImage: {
      url: char.reference_image_url || '',
      fileName: char.reference_image_filename || '',
    },
    animatedPreviewUrl: char.animated_preview_url || undefined,
    description: {
      hairColor: char.hair_color,
      skinTone: char.skin_tone,
      clothing: char.clothing,
      age: char.age,
      otherFeatures: char.other_features,
      // subject_type plumbing: 'scenery'/'scene' marks a location-capable character.
      // Without this the bible can't link Rainbow House (a scene-type char) as a location backer.
      subjectType: char.subject_type || undefined,
    },
    // User-set "Use as" toggle. Authoritative over subjectType for scene-eligibility
    // in the story-bible builder — see scene-enhancer.ts sceneTypeCharacters filter.
    role: (char.role as 'character' | 'scene_element' | undefined) ?? undefined,
    isPrimary: false,
    order: 0,
    isFromLibrary: true,
    ...(isPublic ? { isPublic: true } : {}),
  });

  const loadLibraryCharacters = async (userId: string, offset = 0) => {
    setLibraryLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('character_library')
        .select(IMPORT_SELECT_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + IMPORT_PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data || []).map((char: any) => mapLibraryRow(char));
      setLibraryCharacters(prev => (offset === 0 ? page : [...prev, ...page]));
      setLibraryHasMore(page.length === IMPORT_PAGE_SIZE);
      setLibraryLoaded(true);
    } catch (error) {
      console.error('Error loading library characters:', error);
      if (offset === 0) setLibraryCharacters([]);
    } finally {
      setLibraryLoading(false);
    }
  };

  const loadCommunityCharacters = async (offset = 0) => {
    setCommunityLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('character_library')
        .select(IMPORT_SELECT_COLUMNS)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + IMPORT_PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data || []).map((char: any) => mapLibraryRow(char, true));
      setCommunityCharacters(prev => (offset === 0 ? page : [...prev, ...page]));
      setCommunityHasMore(page.length === IMPORT_PAGE_SIZE);
      setCommunityLoaded(true);
    } catch (error) {
      console.error('Error loading community characters:', error);
      if (offset === 0) setCommunityCharacters([]);
    } finally {
      setCommunityLoading(false);
    }
  };

  const handleImportCharacter = (character: Character) => {
    const exists = characters.find(c => c.id === character.id);

    // If opened from a scene chip's "+ Add", always route to the scene even for
    // already-in-story characters. Otherwise keep the legacy "already added" alert.
    if (exists && addCharToSceneNumber === null) {
      alert('This character is already added to your story');
      return;
    }

    // Add to story if new; otherwise skip the import but still handle scene routing below.
    if (!exists) {
      const importedCharacter = {
        ...character,
        isPrimary: characters.length === 0,
        order: characters.length + 1,
        isFromLibrary: true,
      };
      setCharacters([...characters, importedCharacter]);
    }

    // If the import was initiated from a scene chip, append the character to that scene's
    // bible entry and mark the scene stale so its prompt gets refreshed on next generation.
    if (addCharToSceneNumber !== null) {
      const target = addCharToSceneNumber;
      setStoryBible(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map(s => {
            if (s.sceneNumber !== target) return s;
            const current = s.resolved_character_names || [];
            if (current.some(n => n.toLowerCase() === character.name.toLowerCase())) return s;
            return { ...s, resolved_character_names: [...current, character.name] };
          }),
        };
      });
      setStalePromptSceneNumbers(prev => new Set(prev).add(target));
      setAddCharToSceneNumber(null);
    }

    setShowImportModal(false);
  };

  const handleSaveToLibrary = async (character: Character) => {
    if (!character.name || !character.referenceImage.url) {
      alert('Please add a name and image before saving to library');
      return;
    }

    if (!user?.id) {
      alert('You must be logged in to save characters to library');
      return;
    }

    try {
      const supabase = createClient();

      // Check if character already exists in library
      const { data: existing } = await supabase
        .from('character_library')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', character.name)
        .single();

      if (existing) {
        alert('A character with this name already exists in your library');
        return;
      }

      // Save character to library
      const { error } = await supabase
        .from('character_library')
        .insert({
          user_id: user.id,
          name: character.name,
          reference_image_url: character.referenceImage.url,
          reference_image_filename: character.referenceImage.fileName,
          hair_color: character.description.hairColor,
          skin_tone: character.description.skinTone,
          clothing: character.description.clothing,
          age: character.description.age,
          other_features: character.description.otherFeatures,
        });

      if (error) throw error;

      alert(`${character.name} saved to library!`);

      // Reload library characters if modal is open (fresh page 1).
      if (showImportModal) {
        await loadLibraryCharacters(user.id, 0);
      }
    } catch (error) {
      console.error('Error saving character to library:', error);
      alert('Failed to save character to library. Please try again.');
    }
  };

  const handleScriptSubmit = () => {
    if (!scriptInput.trim()) return;

    const scenes = parseScriptIntoScenes(scriptInput, characters);
    setParsedScenes(scenes);

    // Create session
    const newSession: StorySession = {
      id: Date.now().toString(),
      userId: user?.id,
      characters,
      scenes,
      createdAt: new Date(),
    };
    setSession(newSession);
  };

  // NEW: Handle AI scene enhancement
  const handleEnhanceScenes = async () => {
    if (!scriptInput.trim() || characters.length === 0) {
      alert('Please add characters and write scenes first');
      return;
    }

    setIsEnhancing(true);

    try {
      // Parse raw script into scenes
      const rawScenes = parseScriptIntoScenes(scriptInput, characters);
      setParsedScenes(rawScenes);

      console.log(`Enhancing ${rawScenes.length} scenes with reading level ${readingLevel}, ${storyTone} tone, and ${contentLanguage} language`);

      // Call AI enhancement API (now includes metadata generation)
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
          expansionLevel,
          language: contentLanguage,
          templateBasePrompt: selectedTemplate ? STORY_TEMPLATES[selectedTemplate]?.basePrompt : undefined,
          templateId: selectedTemplate,  // NEW: Pass template ID for story architecture
          secondaryLanguage, // NEW: For bilingual English stories with secondary language captions
          script: scriptInput,  // NEW: Pass raw script for title/description generation
          enableStoryBible: contentLanguage === 'en',  // Turn on bible pass (English only in Phase 1/2)
          characters: characters.map(c => ({
            name: c.name,
            // Exclude clothing from character description - let scene enhancer decide
            // based on story theme (Christmas → pajamas, Beach → swimwear, etc.)
            description: [
              c.description.age ? `${c.description.age} years old` : '',
              c.description.hairColor ? `${c.description.hairColor} hair` : '',
              c.description.skinTone ? `${c.description.skinTone} skin` : '',
              c.description.otherFeatures || ''
            ].filter(Boolean).join(', '),
            // Signal scene-type characters so the bible can link locations to them (Dragonfly Land etc.)
            subjectType: c.description.subjectType,
            // Authoritative "Use as" toggle — overrides subjectType when deciding
            // whether the bible may use this character as a location.
            role: c.role,
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Enhancement failed');
      }

      const data = await response.json();

      if (data.warning) {
        alert('AI enhancement unavailable, using original descriptions');
      }

      // Capture the story bible (may be null if enableStoryBible=false or parse failed server-side).
      // Persisted later via save-draft/save and forwarded to generate-images for pronoun + location resolution.
      setStoryBible(data.storyBible ?? null);
      // Reset the "already saved" set when a fresh bible arrives, so new locations show the bookmark active.
      setSavedLocationTempIds(new Set());
      // Fresh enhancement → no stale prompts yet.
      setStalePromptSceneNumbers(new Set());

      // Phase 3: kick off eager reference-image generation for non-backed locations
      // in the background. Non-blocking — the review page loads immediately; URLs
      // merge into storyBible.locations as the server responds. generate-images reads
      // them from the bible prop and passes them as additional references to the provider.
      if (data.storyBible?.locations?.length) {
        (async () => {
          try {
            const resp = await fetch('/api/locations/generate-references', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ locations: data.storyBible.locations }),
            });
            if (!resp.ok) {
              console.warn('[location refs] non-ok response, skipping reference images');
              return;
            }
            const json = await resp.json();
            const urlMap: Record<string, string> = json?.locations || {};
            if (Object.keys(urlMap).length === 0) return;
            setStoryBible(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                locations: prev.locations.map(l =>
                  urlMap[l.temp_id] ? { ...l, reference_image_url: urlMap[l.temp_id] } : l
                ),
              };
            });
            console.log(`✓ Location reference images ready for ${Object.keys(urlMap).length} locations`);
          } catch (err) {
            // Non-fatal: image gen will still work with locked-prose consistency
            console.error('[location refs] Failed, continuing without reference images:', err);
          }
        })();
      }

      // Extract and store metadata (title, description)
      if (data.metadata) {
        setStoryTitle(data.metadata.title);
        setStoryDescription(data.metadata.description);
        console.log(`✓ Generated title: "${data.metadata.title}"`);
        console.log(`✓ Generated description: "${data.metadata.description}"`);

        // Create Scene 0 (cover) and prepend to enhanced scenes
        const coverScene: EnhancedScene = {
          sceneNumber: 0,
          isCover: true,
          storyTitle: data.metadata.title,
          storyDescription: data.metadata.description,
          raw_description: data.metadata.coverPrompt,
          enhanced_prompt: data.metadata.coverPrompt,
          caption: '', // Cover has no caption (title is the caption)
          characterNames: characters.map(c => c.name)
        };

        // Prepend cover scene to enhanced scenes
        setEnhancedScenes([coverScene, ...data.enhancedScenes]);
        console.log(`✓ Enhanced ${data.enhancedScenes.length} scenes + 1 cover successfully`);
      } else {
        // Fallback: no metadata generated
        setEnhancedScenes(data.enhancedScenes);
        console.log(`✓ Enhanced ${data.enhancedScenes.length} scenes successfully`);
      }

    } catch (error) {
      console.error('Enhancement error:', error);
      alert('Failed to enhance scenes. Please try again.');

      // Fallback: use raw descriptions
      const fallbackScenes = parsedScenes.map(s => ({
        sceneNumber: s.sceneNumber,
        raw_description: s.description,
        enhanced_prompt: s.description,
        caption: s.description,
        characterNames: s.characterNames || []
      }));
      setEnhancedScenes(fallbackScenes);
    } finally {
      setIsEnhancing(false);
    }
  };

  // NEW: Handle back button (go back to settings and clear enhanced scenes)
  const handleRegenerateAll = () => {
    setEnhancedScenes([]);
    setStoryTitle('');  // NEW: Clear title
    setStoryDescription('');  // NEW: Clear description
  };

  // NEW: Handle caption editing in preview
  const handleCaptionEdit = (sceneNumber: number, newCaption: string) => {
    setEnhancedScenes(prev =>
      prev.map(scene =>
        scene.sceneNumber === sceneNumber
          ? { ...scene, caption: newCaption }
          : scene
      )
    );
  };

  // Handle secondary language caption editing (bilingual support)
  const handleCaptionSecondaryEdit = (sceneNumber: number, newCaption: string) => {
    setEnhancedScenes(prev =>
      prev.map(scene =>
        scene.sceneNumber === sceneNumber
          ? {
              ...scene,
              caption_secondary: newCaption,
              // Also write caption_chinese for backward compatibility when language is Chinese
              ...(secondaryLanguage === 'zh' ? { caption_chinese: newCaption } : {}),
            }
          : scene
      )
    );
  };

  // NEW: Handle title editing (for Scene 0/cover)
  // This updates the title in state AND rebuilds the cover prompt
  // Called onBlur (when user leaves the field) for better UX
  const handleTitleEdit = (newTitle: string) => {
    setStoryTitle(newTitle);
    // Update Scene 0 in enhancedScenes and rebuild cover prompt
    setEnhancedScenes(prev =>
      prev.map(scene => {
        if (scene.sceneNumber === 0) {
          return {
            ...scene,
            storyTitle: newTitle,
            enhanced_prompt: buildCoverPrompt({
              title: newTitle,
              description: scene.storyDescription || storyDescription,
              characterNames: characters.map(c => c.name),
              language: contentLanguage as 'en' | 'zh'
            })
          };
        }
        return scene;
      })
    );
  };

  // NEW: Handle description editing (for Scene 0/cover)
  // This updates the description in state AND rebuilds the cover prompt
  // Called onBlur (when user leaves the field) for better UX
  const handleDescriptionEdit = (newDescription: string) => {
    setStoryDescription(newDescription);
    // Update Scene 0 in enhancedScenes and rebuild cover prompt
    setEnhancedScenes(prev =>
      prev.map(scene => {
        if (scene.sceneNumber === 0) {
          return {
            ...scene,
            storyDescription: newDescription,
            enhanced_prompt: buildCoverPrompt({
              title: scene.storyTitle || storyTitle,
              description: newDescription,
              characterNames: characters.map(c => c.name),
              language: contentLanguage as 'en' | 'zh'
            })
          };
        }
        return scene;
      })
    );
  };

  // NEW: Handle image prompt editing
  const handleImagePromptEdit = (sceneNumber: number, newPrompt: string) => {
    setEnhancedScenes(prev =>
      prev.map(scene =>
        scene.sceneNumber === sceneNumber
          ? { ...scene, enhanced_prompt: newPrompt }
          : scene
      )
    );
  };

  // NEW: Handle scenes update (delete/add)
  const handleScenesUpdate = (updatedScenes: EnhancedScene[]) => {
    setEnhancedScenes(updatedScenes);
  };

  // NEW: Generate AI-powered title and description
  const handleGenerateMetadata = async () => {
    setIsGeneratingMetadata(true);
    setSaveError('');

    try {
      console.log('🎨 Requesting AI-generated title and description...');

      const response = await fetch('/api/generate-story-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptInput,
          readingLevel,
          storyTone,
          language: contentLanguage, // NEW: Pass language for Chinese title generation
          characterNames: characters.map(c => c.name),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate metadata');
      }

      const data = await response.json();

      console.log('✅ AI generated:', data);

      // Set the title and description
      setSaveTitle(data.title || 'My Amazing Story');
      setSaveDescription(data.description || 'A wonderful adventure!');

      if (data.warning) {
        console.warn('Metadata generation warning:', data.warning);
      }
    } catch (error) {
      console.error('Metadata generation error:', error);
      // Fallback to simple defaults
      const firstWords = scriptInput.trim().split(' ').slice(0, 5).join(' ');
      setSaveTitle(firstWords || 'My Story');
      setSaveDescription('An amazing adventure!');
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  const generateCoverPreview = async (useCustomPrompt: boolean = false) => {
    if (!saveTitle.trim()) {
      setSaveError('Please enter a title for your story');
      return;
    }

    setGeneratingCover(true);
    setSaveError('');

    try {
      const response = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveTitle.trim(),
          description: saveDescription || '',
          author: authorName.trim() || undefined,
          age: authorAge || undefined,
          language: contentLanguage,
          characters: characters,
          illustrationStyle: artStyle, // 'pixar' (3D) or 'classic' (2D storybook)
          imageProvider: imageProvider, // 'gemini' or 'flux' - same as scenes for consistency
          customPrompt: useCustomPrompt ? customCoverPrompt : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate cover');
      }

      const data = await response.json();

      if (data.imageUrl) {
        setCoverImageUrl(data.imageUrl);
        setCoverImagePrompt(data.prompt || '');
        // Initialize custom prompt with the AI-generated prompt for user to edit
        if (!customCoverPrompt) {
          setCustomCoverPrompt(data.prompt || '');
        }
        console.log('✓ Cover preview generated:', data.imageUrl);
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('Cover generation error:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to generate cover image');
    } finally {
      setGeneratingCover(false);
    }
  };

  const regenerateCover = async () => {
    setCoverApproved(false);
    await generateCoverPreview();
  };

  const approveCover = () => {
    setCoverApproved(true);
    setSaveError('');
  };

  const handleGenerateQuiz = async () => {
    if (!scriptInput.trim()) {
      setSaveError('Story script is required to generate quiz');
      return;
    }

    setGeneratingQuiz(true);
    setSaveError('');

    try {
      console.log(`Generating ${quizQuestionCount} ${quizDifficulty} quiz questions...`);

      const response = await fetch('/api/generate-quiz-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptInput,
          readingLevel,
          storyTone,
          language: contentLanguage, // NEW: Pass language for Chinese quiz questions
          difficulty: quizDifficulty,
          questionCount: quizQuestionCount,
          characterNames: characters.map(c => c.name),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate quiz');
      }

      const data = await response.json();
      setQuizData(data.questions);
      setShowQuizModal(true);
      console.log('✓ Quiz generated:', data.questions.length, 'questions');
    } catch (error) {
      console.error('Quiz generation error:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to generate quiz');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const approveQuiz = () => {
    setShowQuizModal(false);
    setSaveError('');
  };

  /**
   * Upload any base64 scene images to Supabase Storage before a manual save.
   * Throws with a specific, scene-aware message on failure so the user knows
   * which scene to retry — earlier behavior silently kept 1–2 MB data: URLs,
   * which could blow the draft payload past the JSONB cap.
   */
  const uploadPendingBase64Images = async (): Promise<void> => {
    const pendingImages = imageGenerationStatus.filter(
      img => img.imageUrl && img.imageUrl.startsWith('data:')
    );
    if (pendingImages.length === 0) return;

    savePreuploadStarted({ base64Count: pendingImages.length });

    for (const img of pendingImages) {
      let response: Response;
      try {
        response = await fetch('/api/upload-scene-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: img.imageUrl,
            folderPath: draftProjectId || `temp-save-${Date.now()}`,
            sceneId: img.sceneId || `scene-${img.sceneNumber}`,
          }),
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'network error';
        savePreuploadFailed({ sceneNumber: img.sceneNumber, error: errMsg });
        throw new Error(
          `Scene ${img.sceneNumber}'s image couldn't be uploaded (${errMsg}). Check your connection and try Save again.`
        );
      }
      if (!response.ok) {
        // Surface the server's actual reason (route returns { error, details })
        // so failures are diagnosable from the console instead of a generic 500.
        let serverDetail = '';
        try {
          const errBody = await response.json();
          serverDetail = errBody?.details || errBody?.error || '';
        } catch {
          /* non-JSON error body */
        }
        console.error(
          `[uploadPendingBase64Images] scene ${img.sceneNumber} upload failed:`,
          response.status,
          serverDetail,
          `(payload ~${Math.round((img.imageUrl?.length || 0) / 1024)}KB)`
        );
        savePreuploadFailed({ sceneNumber: img.sceneNumber, error: `http ${response.status}: ${serverDetail}` });
        throw new Error(
          `Scene ${img.sceneNumber}'s image couldn't be uploaded (status ${response.status}${serverDetail ? `: ${serverDetail}` : ''}). Try Save again.`
        );
      }
      const data = await response.json();
      img.imageUrl = data.url;
    }

    // Propagate CDN URLs back into React state.
    setImageGenerationStatus([...imageGenerationStatus]);
  };

  /**
   * Builds the draft-save POST body from current state. Assumes any temp
   * character IDs have already been resolved to real UUIDs by the caller
   * (autosave skips when temp IDs are present, so this branch is
   * manual-save-only). Returns the stringified body and the scenes array.
   */
  const buildDraftBody = (finalCharacterIds: string[] | undefined): {
    draftBody: string;
    scenesPayload: any[] | undefined;
  } => {
    let scenesPayload: any[] | undefined;
    if (imageGenerationStatus.length > 0) {
      scenesPayload = imageGenerationStatus
        .filter(img => img.sceneNumber > 0)
        .map(img => {
          const enhancedScene = enhancedScenes.find(es => es.sceneNumber === img.sceneNumber);
          return {
            sceneNumber: img.sceneNumber,
            description: img.sceneDescription,
            raw_description: enhancedScene?.raw_description || img.sceneDescription,
            enhanced_prompt: enhancedScene?.enhanced_prompt || img.sceneDescription,
            caption: enhancedScene?.caption || img.sceneDescription,
            caption_chinese: enhancedScene?.caption_chinese,
            caption_secondary: enhancedScene?.caption_secondary,
            imageUrl: img.imageUrl || null,
            prompt: img.prompt,
            generationTime: img.generationTime,
          };
        });
    } else if (enhancedScenes.length > 0) {
      scenesPayload = enhancedScenes
        .filter(es => es.sceneNumber > 0)
        .map(es => ({
          sceneNumber: es.sceneNumber,
          description: es.raw_description || es.enhanced_prompt || '',
          raw_description: es.raw_description,
          enhanced_prompt: es.enhanced_prompt,
          caption: es.caption,
          caption_chinese: es.caption_chinese,
          caption_secondary: es.caption_secondary,
        }));
    }

    const lightCharacters = characters.map(c => ({
      ...c,
      referenceImage: c.referenceImage
        ? { ...c.referenceImage, url: c.referenceImage.url?.startsWith('data:') ? '' : c.referenceImage.url }
        : c.referenceImage,
      animatedPreviewUrl: c.animatedPreviewUrl?.startsWith('data:') ? '' : c.animatedPreviewUrl,
    }));

    const draftMetadata: Record<string, any> = {
      characters: lightCharacters,
      clothingConsistency,
      expansionLevel,
      imageProvider,
      artStyle,
      secondaryLanguage,
      storyTone,
      selectedTemplate,
      contentLanguage,
      enhancedScenes,
      imageGenerationStatus,
      coverImagePrompt,
      customCoverPrompt,
      coverApproved,
      quizData: quizData || undefined,
      quizDifficulty,
      quizQuestionCount,
      authorName,
      authorAge,
      // Persist a snapshot of the story bible so reopening the draft can rehydrate the
      // client UI (Characters/Scene chips, + Add button, Scene swap). The structured
      // story_locations / scene columns remain authoritative for image gen and save.
      storyBible,
    };

    const coverImage = imageGenerationStatus.find(img => img.sceneNumber === 0 && img.status === 'completed');
    const coverImageUrlToSave = coverImage?.imageUrl || coverImageUrl || undefined;

    const draftBody = JSON.stringify({
      projectId: draftProjectId || undefined,
      title: storyTitle || saveTitle || undefined,
      description: storyDescription || saveDescription || undefined,
      authorName: authorName || undefined,
      authorAge: authorAge ? parseInt(authorAge) : undefined,
      coverImageUrl: coverImageUrlToSave,
      originalScript: scriptInput || undefined,
      readingLevel,
      storyTone,
      language: contentLanguage,
      characterIds: finalCharacterIds,
      scenes: scenesPayload,
      draftMetadata,
      storyBible,  // Persist locations + resolved scene entities (null when bible disabled)
    });

    return { draftBody, scenesPayload };
  };

  /**
   * For manual save only: resolves any temp `char-*` IDs to real UUIDs by
   * creating library entries. Skipped entirely by autosave (it bails early
   * when temp IDs are present so it never creates side-effects silently).
   */
  const resolveCharacterIdsForManualSave = async (): Promise<string[] | undefined> => {
    if (characters.length === 0) return undefined;
    const hasTemporaryIds = characters.some(c => c.id.startsWith('char-'));
    if (!hasTemporaryIds) return characters.map(c => c.id);

    const characterIdMap: Record<string, string> = {};
    for (const character of characters) {
      if (character.id.startsWith('char-')) {
        const characterPayload: Record<string, any> = { name: character.name };
        if (character.referenceImage?.url) {
          characterPayload.reference_image_url = character.referenceImage.url;
          characterPayload.reference_image_filename = character.referenceImage.fileName;
        }
        if (character.animatedPreviewUrl) {
          characterPayload.animated_preview_url = character.animatedPreviewUrl;
        }
        if (character.description?.hairColor) characterPayload.hair_color = character.description.hairColor;
        if (character.description?.skinTone) characterPayload.skin_tone = character.description.skinTone;
        if (character.description?.clothing) characterPayload.clothing = character.description.clothing;
        if (character.description?.age) characterPayload.age = character.description.age;
        if (character.description?.otherFeatures) characterPayload.other_features = character.description.otherFeatures;

        const charResponse = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(characterPayload),
        });
        if (!charResponse.ok) throw new Error(`Failed to create character ${character.name}`);
        const charData = await charResponse.json();
        characterIdMap[character.id] = charData.character.id;
        character.id = charData.character.id;
      } else {
        characterIdMap[character.id] = character.id;
      }
    }
    const ids = characters.map(c => characterIdMap[c.id] || c.id);
    setCharacters([...characters]);
    return ids;
  };

  /**
   * After any successful draft save where no `?projectId=` was in the URL
   * yet, push it in so a page refresh resumes the same draft instead of
   * creating a duplicate. `hasResumedRef` prevents this from re-triggering
   * the resume effect and wiping in-memory edits.
   */
  const persistProjectIdInUrl = (projectId: string) => {
    if (draftProjectId) return;
    setDraftProjectId(projectId);
    hasResumedRef.current = true;
    const currentPath = window.location.pathname;
    router.replace(`${currentPath}?projectId=${projectId}`, { scroll: false });
  };

  /**
   * Manual "Save as Draft" / "Update Draft" button handler. Fails loud on
   * upload errors and on oversize payloads so users always know why a save
   * didn't persist.
   */
  const handleSaveDraft = async () => {
    const draftStartTime = Date.now();
    const sceneCountForEvent = imageGenerationStatus.filter(img => img.sceneNumber > 0).length;
    const hasCoverForEvent = imageGenerationStatus.some(img => img.sceneNumber === 0 && img.status === 'completed');
    saveClicked({
      type: 'draft',
      sceneCount: sceneCountForEvent,
      hasCover: hasCoverForEvent,
      hasCharacters: characters.length > 0,
    });

    setSavingDraft(true);
    setDraftSaveMessage(null);
    autosave.markManualSaveStart();

    try {
      await uploadPendingBase64Images();
      const characterIds = await resolveCharacterIdsForManualSave();
      const { draftBody, scenesPayload } = buildDraftBody(characterIds);

      if (draftBody.length > MAX_DRAFT_PAYLOAD_BYTES) {
        saveRequestFailed({
          type: 'draft',
          status: 0,
          errorMessage: 'payload_too_large_client',
          durationMs: Date.now() - draftStartTime,
        });
        throw new Error(
          'Story is too large to save — try removing or regenerating some of the larger images.'
        );
      }

      saveRequestSent({
        type: 'draft',
        payloadBytes: draftBody.length,
        sceneCount: scenesPayload?.length || 0,
        hasBase64Urls: (scenesPayload || []).some((s: any) => s.imageUrl?.startsWith?.('data:')),
      });

      const response = await fetch('/api/projects/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: draftBody,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save draft';
        try {
          const errData = await response.json();
          errorMessage = errData.error || errData.message || errorMessage;
        } catch {
          errorMessage = response.status === 413
            ? 'Draft data is too large to save. Try regenerating some of the images.'
            : `Draft save failed (${response.status}). Please try again.`;
        }
        saveRequestFailed({
          type: 'draft',
          status: response.status,
          errorMessage,
          durationMs: Date.now() - draftStartTime,
        });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      saveRequestSucceeded({
        type: 'draft',
        projectId: data.projectId,
        durationMs: Date.now() - draftStartTime,
      });

      persistProjectIdInUrl(data.projectId);
      autosave.markManualSaveSuccess();
      setDraftSaveMessage('Draft saved!');
      setTimeout(() => setDraftSaveMessage(null), 3000);
    } catch (error) {
      console.error('Draft save error:', error);
      autosave.markManualSaveFailed();
      setDraftSaveMessage(error instanceof Error ? error.message : 'Failed to save draft');
      setTimeout(() => setDraftSaveMessage(null), 5000);
    } finally {
      setSavingDraft(false);
    }
  };

  /**
   * Called by the 3-minute autosave timer. Silent: no toasts, no uploads,
   * no side-effects. Bails early if there's anything pending that would
   * require explicit action (base64 images waiting for upload, or temp
   * character IDs that would silently create library rows).
   */
  const runAutosaveCycle = async (): Promise<RunAutosaveResult> => {
    const startTime = Date.now();
    const sceneCount = imageGenerationStatus.filter(img => img.sceneNumber > 0).length;

    const hasPendingBase64 =
      imageGenerationStatus.some(img => img.imageUrl?.startsWith('data:')) ||
      !!coverImageUrl?.startsWith('data:') ||
      characters.some(
        c => c.referenceImage?.url?.startsWith('data:') || c.animatedPreviewUrl?.startsWith('data:')
      );
    const hasTempCharacterIds = characters.some(c => c.id.startsWith('char-'));
    if (hasPendingBase64 || hasTempCharacterIds) {
      return { ok: false, skippedReason: 'base64_pending', sceneCount };
    }

    const characterIds = characters.length > 0 ? characters.map(c => c.id) : undefined;
    const { draftBody, scenesPayload } = buildDraftBody(characterIds);
    if (draftBody.length > MAX_DRAFT_PAYLOAD_BYTES) {
      return { ok: false, skippedReason: 'payload_too_large', sceneCount: scenesPayload?.length || 0 };
    }

    saveRequestSent({
      type: 'draft',
      payloadBytes: draftBody.length,
      sceneCount: scenesPayload?.length || 0,
      hasBase64Urls: false,
    });

    try {
      const response = await fetch('/api/projects/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: draftBody,
      });
      if (!response.ok) {
        let errorMessage = `http ${response.status}`;
        try {
          const errData = await response.json();
          errorMessage = errData.error || errData.message || errorMessage;
        } catch {
          /* keep default */
        }
        saveRequestFailed({
          type: 'draft',
          status: response.status,
          errorMessage,
          durationMs: Date.now() - startTime,
        });
        return { ok: false, errorMessage, sceneCount: scenesPayload?.length || 0 };
      }
      const data = await response.json();
      saveRequestSucceeded({
        type: 'draft',
        projectId: data.projectId,
        durationMs: Date.now() - startTime,
      });
      persistProjectIdInUrl(data.projectId);
      return { ok: true, sceneCount: scenesPayload?.length || 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'network error';
      saveRequestFailed({
        type: 'draft',
        status: 0,
        errorMessage,
        durationMs: Date.now() - startTime,
      });
      return { ok: false, errorMessage, sceneCount: scenesPayload?.length || 0 };
    }
  };

  // Wire the 3-minute autosave. Disabled until the user has written
  // something and is signed in.
  const autosaveEnabled =
    !!user && (characters.length > 0 || parsedScenes.length > 0 || enhancedScenes.length > 0);

  const formatSavedAt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const renderAutosavePill = () => {
    // Manual save message takes priority — it's the richer, explicit signal.
    if (draftSaveMessage) return null;
    switch (autosave.uiState) {
      case 'saving':
        return <span className="text-xs text-gray-500">Saving…</span>;
      case 'saved':
        return autosave.lastSavedAt ? (
          <span className="text-xs text-gray-500">Saved at {formatSavedAt(autosave.lastSavedAt)}</span>
        ) : null;
      case 'unsaved_images':
        return (
          <span className="text-xs text-amber-600">
            Unsaved image changes — click Save as Draft
          </span>
        );
      case 'paused':
        return (
          <span className="text-xs text-red-600">Autosave paused — click Save as Draft</span>
        );
      case 'idle':
      default:
        return null;
    }
  };

  const autosave = useAutosaveDraft({
    enabled: autosaveEnabled,
    debounceMs: AUTOSAVE_DEBOUNCE_MS,
    runAutosave: runAutosaveCycle,
    fingerprint: [
      characters,
      scriptInput,
      parsedScenes,
      enhancedScenes,
      storyTitle,
      storyDescription,
      imageGenerationStatus,
      readingLevel,
      storyTone,
      contentLanguage,
      secondaryLanguage,
      artStyle,
      clothingConsistency,
      expansionLevel,
      coverImageUrl,
      customCoverPrompt,
      imageProvider,
      authorName,
      authorAge,
      selectedTemplate,
      coverApproved,
      quizData,
    ],
  });

  const handleSaveStory = async () => {
    if (!saveTitle.trim()) {
      setSaveError('Please enter a title for your story');
      return;
    }

    const saveStartTime = Date.now();
    const sceneCountForEvent = imageGenerationStatus.filter(img => img.sceneNumber > 0).length;
    const hasCoverForEvent = imageGenerationStatus.some(img => img.sceneNumber === 0 && img.status === 'completed');
    saveClicked({
      type: 'completed',
      sceneCount: sceneCountForEvent,
      hasCover: hasCoverForEvent,
      hasCharacters: characters.length > 0,
    });

    setIsSaving(true);
    setSaveError('');

    try {
      // Upload any base64 images to storage before building the payload
      await uploadPendingBase64Images();

      // NEW: Extract cover image (Scene 0) and regular scenes (Scene 1+)
      const coverImage = imageGenerationStatus.find(img => img.sceneNumber === 0 && img.status === 'completed');
      const coverImageUrlToSave = coverImage?.imageUrl || coverImageUrl || undefined;

      if (coverImageUrlToSave) {
        console.log('✅ Using cover from Scene 0:', coverImageUrlToSave);
      } else {
        console.log('⚠️ No cover image generated, saving without cover');
      }

      // Prepare scenes data (exclude cover/Scene 0, keep all scenes including failed ones)
      const scenesData = imageGenerationStatus
        .filter(img => img.sceneNumber > 0)  // Exclude Scene 0 (cover handled separately)
        .map(img => {
          const enhancedScene = enhancedScenes.find(es => es.sceneNumber === img.sceneNumber);
          return {
            sceneNumber: img.sceneNumber,
            description: img.sceneDescription,
            raw_description: enhancedScene?.raw_description || img.sceneDescription,
            enhanced_prompt: enhancedScene?.enhanced_prompt || img.sceneDescription,
            caption: enhancedScene?.caption || img.sceneDescription,
            caption_chinese: enhancedScene?.caption_chinese,  // Bilingual Support (backward compat)
            caption_secondary: enhancedScene?.caption_secondary,  // NEW: Generic secondary language
            imageUrl: img.imageUrl || null,  // null for failed scenes
            prompt: img.prompt,
            generationTime: img.generationTime,
          };
        });

      if (scenesData.length === 0) {
        setSaveError('No scenes to save');
        setIsSaving(false);
        return;
      }

      // Check if characters have temporary IDs (from guest mode)
      const hasTemporaryIds = characters.some(c => c.id.startsWith('char-'));
      let characterIds = characters.map(c => c.id);

      if (hasTemporaryIds) {
        console.log('Detected temporary character IDs, creating characters in library first...');

        // Create characters in the library first
        const characterIdMap: Record<string, string> = {};

        for (const character of characters) {
          if (character.id.startsWith('char-')) {
            try {
              // Build character payload with only non-empty fields
              const characterPayload: Record<string, any> = {
                name: character.name,
              };

              // Include reference image if available
              if (character.referenceImage?.url) {
                characterPayload.reference_image_url = character.referenceImage.url;
                characterPayload.reference_image_filename = character.referenceImage.fileName;
              }

              // Include animated preview URL if available (from Gemini generation)
              if (character.animatedPreviewUrl) {
                characterPayload.animated_preview_url = character.animatedPreviewUrl;
              }

              // Only include description fields if they have values
              if (character.description?.hairColor) {
                characterPayload.hair_color = character.description.hairColor;
              }
              if (character.description?.skinTone) {
                characterPayload.skin_tone = character.description.skinTone;
              }
              if (character.description?.clothing) {
                characterPayload.clothing = character.description.clothing;
              }
              if (character.description?.age) {
                characterPayload.age = character.description.age;
              }
              if (character.description?.otherFeatures) {
                characterPayload.other_features = character.description.otherFeatures;
              }

              const charResponse = await fetch('/api/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(characterPayload),
              });

              if (!charResponse.ok) {
                const errorData = await charResponse.json();
                throw new Error(`Failed to create character ${character.name}: ${errorData.error}`);
              }

              const charData = await charResponse.json();
              characterIdMap[character.id] = charData.character.id;
              console.log(`✓ Created character: ${character.name} (${character.id} → ${charData.character.id})`);
            } catch (error) {
              console.error(`Failed to create character ${character.name}:`, error);
              throw error;
            }
          } else {
            // Already a real UUID, keep it
            characterIdMap[character.id] = character.id;
          }
        }

        // Use the real character IDs
        characterIds = characters.map(c => characterIdMap[c.id]);
        console.log('✓ All characters created, using real UUIDs:', characterIds);
      }

      // Call save API (supports both new creation and draft→completed transition)
      const saveBody = JSON.stringify({
        projectId: draftProjectId || undefined, // Pass draft ID for draft→completed
        title: saveTitle.trim(),
        description: saveDescription.trim() || undefined,
        authorName: authorName.trim() || undefined,
        authorAge: authorAge ? parseInt(authorAge) : undefined,
        coverImageUrl: coverImageUrlToSave,
        originalScript: scriptInput,
        readingLevel: readingLevel,
        storyTone: storyTone,
        contentLanguage: contentLanguage,
        characterIds: characterIds,
        secondaryLanguage,
        scenes: scenesData,
        quizData: quizData || undefined,
        storyBible,  // Persist locations + resolved scene entities
      });

      saveRequestSent({
        type: 'completed',
        payloadBytes: new Blob([saveBody]).size,
        sceneCount: scenesData.length,
        hasBase64Urls: scenesData.some(s => s.imageUrl?.startsWith('data:')),
      });

      const response = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: saveBody,
      });

      if (!response.ok) {
        // Handle non-JSON responses (e.g., 413 Request Entity Too Large)
        let errorMessage = 'Failed to save story';
        try {
          const data = await response.json();
          // Prefer the human-friendly `message` (e.g. "You've reached your monthly
          // limit of 5 stories. Upgrade…") over the terse `error` code so the
          // story-limit 403 reads clearly instead of just "Story limit reached".
          errorMessage = data.message || data.error || errorMessage;
        } catch {
          errorMessage = response.status === 413
            ? 'Story data is too large to save. Please try regenerating the images.'
            : `Save failed (${response.status}). Please try again.`;
        }
        saveRequestFailed({
          type: 'completed',
          status: response.status,
          errorMessage,
          durationMs: Date.now() - saveStartTime,
        });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      saveRequestSucceeded({
        type: 'completed',
        projectId: data.project?.id,
        durationMs: Date.now() - saveStartTime,
      });

      // Clear guest story from sessionStorage after successful save
      clearGuestStory();
      console.log('✓ Cleared guest story from sessionStorage');

      // Auto-trigger audio generation (fire-and-forget)
      const savedId = data.project.id;
      fetch(`/api/projects/${savedId}/auto-generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(err => console.error('Auto-audio trigger failed (non-blocking):', err));
      console.log(`🎵 Auto-audio generation triggered for project ${savedId}`);

      // Close save modal
      setShowSaveModal(false);

      // Reset saving state (IMPORTANT: must be done before redirect/modal)
      setIsSaving(false);

      // Check if we should show feedback modal (first story)
      if (data.showFeedbackModal) {
        setSavedProjectId(data.project.id);
        setShowFeedbackModal(true);
      } else {
        // No feedback needed, redirect immediately
        router.push('/projects');
      }

    } catch (error) {
      console.error('Save error:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save story');
      setIsSaving(false);
    }
  };

  const handleFeedbackSubmit = async (feedbackData: {
    rating: number;
    feedbackText: string;
    isPublic: boolean;
    displayName: string;
  }) => {
    setFeedbackLoading(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...feedbackData,
          projectId: savedProjectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      // Success! Show thank you message and redirect
      alert(`Thank you for your feedback! You've earned +${data.bonusAwarded} bonus images! 🎁`);
      setShowFeedbackModal(false);
      router.push('/projects');

    } catch (error) {
      console.error('Feedback submission error:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleFeedbackSkip = () => {
    setShowFeedbackModal(false);
    router.push('/projects');
  };

  const handleDownloadPDF = async () => {
    const completedScenes = imageGenerationStatus.filter(img => img.status === 'completed');

    if (completedScenes.length === 0) {
      alert('No completed scenes to generate PDF');
      return;
    }

    setGeneratingPDF(true);

    try {
      // Generate default title if not set
      const title = saveTitle || scriptInput.trim().split(' ').slice(0, 5).join(' ') || 'My Story';

      const scenesData = completedScenes.map(img => {
        const enhancedScene = enhancedScenes.find(es => es.sceneNumber === img.sceneNumber);
        return {
          sceneNumber: img.sceneNumber,
          caption: enhancedScene?.caption || img.sceneDescription, // Use caption for PDF
          caption_chinese: enhancedScene?.caption_chinese,
          caption_secondary: enhancedScene?.caption_secondary || enhancedScene?.caption_chinese,
          imageUrl: img.imageUrl,
        };
      });

      // Format author string (leave empty if not set — kids sign the printed book)
      let authorString = authorName.trim();
      if (authorString && authorAge) {
        authorString += `, age ${authorAge}`;
      }

      // Map character data for PDF designer page
      const charactersData = characters.map(c => ({
        name: c.name,
        originalCreationUrl: c.referenceImage?.url || undefined,
        storyVersionUrl: c.animatedPreviewUrl || undefined,
      }));

      await generateAndDownloadStoryPDF({
        title,
        description: saveDescription,
        scenes: scenesData,
        characters: charactersData,
        author: authorString,
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  // UPDATED: Use enhanced prompts for image generation
  const handleGenerateImages = async () => {
    if (enhancedScenes.length === 0) {
      alert('Please enhance scenes first');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    // Initialize image generation status for all scenes
    const initialStatus = enhancedScenes.map((scene, index) => ({
      id: `temp-${index}`,
      sceneId: `scene-${scene.sceneNumber}`,
      sceneNumber: scene.sceneNumber,
      sceneDescription: scene.caption, // Use caption for display
      imageUrl: '',
      prompt: '', // Will be filled by the API
      generationTime: 0,
      status: 'pending' as const,
    }));
    setImageGenerationStatus(initialStatus);

    try {
      // Phase 4: if the user edited characters/location on any scene, refresh those
      // scenes' enhanced_prompt + caption once (batched) before running image generation.
      // We keep a local `scenesForGen` snapshot so downstream calls see the refreshed
      // prompts even though setEnhancedScenes is asynchronous.
      let scenesForGen = enhancedScenes;
      if (storyBible && stalePromptSceneNumbers.size > 0 && contentLanguage === 'en') {
        const staleList = Array.from(stalePromptSceneNumbers);
        const scenesToRefresh = staleList
          .map(n => {
            const bibleScene = storyBible.scenes.find(s => s.sceneNumber === n);
            const enhancedScene = enhancedScenes.find(s => s.sceneNumber === n);
            if (!bibleScene || !enhancedScene) return null;
            return {
              sceneNumber: n,
              raw_description: enhancedScene.raw_description || enhancedScene.caption || '',
              resolved_character_names: bibleScene.resolved_character_names || [],
              location_temp_id: bibleScene.location_temp_id ?? null,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        if (scenesToRefresh.length > 0) {
          try {
            const refreshResp = await fetch('/api/refresh-prompts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scenesToRefresh,
                allScenesForContext: enhancedScenes
                  .filter(s => !s.isCover)
                  .map(s => ({ sceneNumber: s.sceneNumber, caption: s.caption })),
                locations: storyBible.locations,
                characters: characters.map(c => ({
                  name: c.name,
                  description: [
                    c.description.age ? `${c.description.age} years old` : '',
                    c.description.hairColor ? `${c.description.hairColor} hair` : '',
                    c.description.skinTone ? `${c.description.skinTone} skin` : '',
                    c.description.otherFeatures || ''
                  ].filter(Boolean).join(', '),
                  subjectType: c.description.subjectType,
                })),
                readingLevel,
                storyTone,
                language: 'en',
              }),
            });
            if (refreshResp.ok) {
              const refreshData = await refreshResp.json();
              // Captions are owned by the user — refresh-prompts ONLY returns enhanced_prompt
              // and we ONLY apply that. Caption text stays exactly as the user has it.
              const updates = new Map<number, string>();
              (refreshData.scenes || []).forEach((s: any) => {
                if (typeof s?.sceneNumber === 'number' && typeof s?.enhanced_prompt === 'string') {
                  updates.set(s.sceneNumber, s.enhanced_prompt);
                }
              });
              // Apply updates to the local snapshot used for image gen this cycle
              scenesForGen = enhancedScenes.map(scene => {
                const newPrompt = updates.get(scene.sceneNumber);
                return newPrompt ? { ...scene, enhanced_prompt: newPrompt } : scene;
              });
              // Also push into React state so future renders / saves see the refreshed values
              setEnhancedScenes(scenesForGen);
              setStalePromptSceneNumbers(new Set());
              console.log(`✓ Refreshed image prompts for ${updates.size} stale scenes (captions preserved)`);
            } else {
              console.warn('[refresh-prompts] Non-ok response, continuing with stale prompts');
            }
          } catch (err) {
            console.error('[refresh-prompts] Failed, continuing with stale prompts:', err);
          }
        }
      }

      // NEW: Extract cover metadata (Scene 0)
      const coverScene = scenesForGen.find(s => s.isCover);
      const coverMetadata = coverScene ? {
        title: coverScene.storyTitle || storyTitle,
        description: coverScene.storyDescription || storyDescription,
        coverPrompt: coverScene.enhanced_prompt
      } : null;

      // Build script from enhanced prompts (excluding cover/Scene 0)
      const enhancedScript = scenesForGen
        .filter(s => !s.isCover)  // Exclude cover from script
        .map(s => s.enhanced_prompt)
        .join('\n');

      // Extract character types from enhanced scenes (AI-detected animal vs human)
      // Merge all characterTypes from all scenes, using the most recent detection for each character
      const characterTypeMap = new Map<string, boolean>();
      for (const scene of scenesForGen) {
        if (scene.characterTypes) {
          for (const ct of scene.characterTypes) {
            characterTypeMap.set(ct.name, ct.isAnimal);
          }
        }
      }

      // Update characters with AI-detected isAnimal flag
      const charactersWithTypes = characters.map(c => ({
        ...c,
        description: {
          ...c.description,
          isAnimal: characterTypeMap.get(c.name) ?? c.description.isAnimal ?? false,
        }
      }));

      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characters: charactersWithTypes,
          script: enhancedScript, // Use enhanced prompts (excludes cover)
          artStyle: ART_STYLE,
          imageProvider: imageProvider, // Use selected image provider (gemini or flux)
          illustrationStyle: artStyle, // 'pixar' (3D) or 'classic' (2D storybook)
          clothingConsistency, // 'consistent' (default) or 'scene-based'
          coverMetadata,  // NEW: Cover metadata for Scene 0 generation
          storyBible,  // Pronoun-resolved scenes + locked locations (null when bible disabled)
        }),
      });

      if (!response.ok) {
        // Prefer the human-friendly `message` (e.g. the trial/daily limit reason)
        // over the terse `error` code, and flag 429s so the UI shows an upgrade CTA.
        const errorData = await response.json().catch(() => ({} as { error?: string; message?: string }));
        const friendly = errorData.message || errorData.error || 'Image generation failed. Please try again.';
        const err = new Error(friendly) as Error & { isLimit?: boolean };
        err.isLimit = response.status === 429;
        throw err;
      }

      const data = await response.json();

      // Surface a non-fatal provider fallback notice (e.g., OpenAI gpt-image-2 isn't yet
      // supported for scene generation; the server fell back to Gemini and tells us why).
      // Single alert so the user understands their selection didn't fully take effect.
      if (data.providerFallback) {
        console.warn('[generate-images] Provider fallback:', data.providerFallback);
        alert(data.providerFallback);
      }

      // Update the image generation status with the actual results
      // Use positional matching: API renumbers scenes sequentially, so match by array position
      if (data.generatedImages) {
        const contentScenes = enhancedScenes.filter(s => !s.isCover);
        const updatedImages = data.generatedImages.map((img: any) => {
          let enhancedScene;
          if (img.sceneNumber === 0) {
            enhancedScene = enhancedScenes.find(es => es.isCover);
          } else {
            // Positional match: API scene 1 = first content scene, scene 2 = second, etc.
            enhancedScene = contentScenes[img.sceneNumber - 1];
          }
          return {
            ...img,
            sceneNumber: enhancedScene?.sceneNumber ?? img.sceneNumber,
            sceneDescription: img.sceneNumber === 0
              ? (enhancedScene?.storyDescription || storyDescription || 'Story cover')
              : (enhancedScene?.caption || img.sceneDescription),
          };
        });
        setImageGenerationStatus(updatedImages);

        // A 200 response can still mean every scene failed: the route returns
        // success:false with all images status:'failed'. The results panel only
        // renders when ≥1 image completed, so without this the page goes blank
        // (the same silent failure we're fixing for the 429 path).
        const completedCount = updatedImages.filter((img: { status?: string }) => img.status === 'completed').length;
        if (completedCount === 0) {
          setGenerationError({
            message: 'We couldn’t generate any images this time. Please try again.',
            isLimit: false,
          });
        }
      } else {
        // No images returned at all — surface it instead of failing silently.
        setGenerationError({
          message: 'We couldn’t generate any images this time. Please try again.',
          isLimit: false,
        });
      }

      // Extract image URLs for the gallery
      const imageUrls = data.generatedImages?.map((img: any) => img.imageUrl).filter(Boolean) || [];
      setGeneratedImages(imageUrls);
    } catch (error) {
      console.error('Generation error:', error);
      const message = error instanceof Error ? error.message : 'Image generation failed. Please try again.';
      const isLimit = !!(error as { isLimit?: boolean })?.isLimit;
      // Surface the failure to the user — previously this was console-only, so a
      // full failure (e.g. 429 image-limit) left the page blank with no feedback.
      setGenerationError({ message, isLimit });
      // Mark all as failed
      setImageGenerationStatus(initialStatus.map(img => ({
        ...img,
        status: 'failed' as const,
        error: message,
      })));
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading || restoringDraft) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{restoringDraft ? 'Restoring your draft...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onSubmit={handleFeedbackSubmit}
        onSkip={handleFeedbackSkip}
        loading={feedbackLoading}
      />

      {/* OLD MODAL — commented out, replaced by inline side panel + mobile modal below
      <WritingCoachModal
        isOpen={isCoachModalOpen}
        onClose={() => setIsCoachModalOpen(false)}
        script={scriptInput}
        templateId={selectedTemplate}
        characters={characters}
        readingLevel={readingLevel}
        onAcceptPolish={(newScript) => {
          setScriptInput(newScript);
          setIsCoachModalOpen(false);
        }}
      />
      */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {draftProjectId && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-amber-500 rounded-full"></span>
            <span className="text-sm text-amber-800 font-medium">Editing Draft</span>
            <span className="text-sm text-amber-600">— Changes are saved when you click &quot;Save as Draft&quot;</span>
          </div>
        )}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Story</h1>
          <p className="text-gray-600">
            Add your characters, write your story scenes, and generate beautiful illustrations!
          </p>
        </div>

      {/* Step 1: Character Management */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
            1
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Define Characters</h2>
        </div>
        <p className="text-gray-600 mb-4 ml-11">
          Add characters to your story. You can import from your character library or create new ones.
        </p>
        <div className="mb-4">
          <div className="flex justify-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Open the modal instantly; the useEffect above will fetch
                  // the Mine tab in the background and render skeletons until
                  // the first page lands.
                  setImportTab('mine');
                  setShowImportModal(true);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium text-sm shadow transition-all flex items-center gap-2"
              >
                <span>📚</span> Import from Library
              </button>
              {characters.length < 5 && (
                <button
                  onClick={() => setShowAddCharacterModal(true)}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-semibold text-sm shadow-md transition-all"
                >
                  + Add Character
                </button>
              )}
            </div>
          </div>
          <CharacterManager
            characters={characters}
            onCharactersChange={handleCharactersChange}
            showAddButton={false}
            onSaveToLibrary={handleSaveToLibrary}
          />
        </div>

        {/* Import Character Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[80vh] overflow-y-auto p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {addCharToSceneNumber !== null ? `Add a character to Scene ${addCharToSceneNumber}` : 'Import from Character Library'}
                </h2>
                <button
                  onClick={() => { setShowImportModal(false); setAddCharToSceneNumber(null); setImportSearch(''); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  value={importSearch}
                  onChange={(e) => setImportSearch(e.target.value)}
                  placeholder="Search by name…"
                  aria-label="Search characters"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setImportTab('mine')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    importTab === 'mine'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  My Characters
                </button>
                <button
                  onClick={() => setImportTab('community')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    importTab === 'community'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Community
                </button>
              </div>

              {(() => {
                const isMine = importTab === 'mine';
                const q = importSearch.trim();
                const isSearchingMode = q.length > 0;
                // Server-side search results when there's a query; paginated
                // browse cache otherwise. No client-side filter — the server
                // already scoped by name.
                const sourceList = isSearchingMode
                  ? (importSearchResults ?? [])
                  : (isMine ? libraryCharacters : communityCharacters);
                const loading = isSearchingMode
                  ? importSearching
                  : (isMine ? libraryLoading : communityLoading);
                const loaded = isSearchingMode
                  ? importSearchResults !== null
                  : (isMine ? libraryLoaded : communityLoaded);
                // Hide "Load more" while searching — search results are
                // server-capped at 100 and pagination doesn't apply.
                const hasMore = !isSearchingMode && (isMine ? libraryHasMore : communityHasMore);
                const displayChars = sourceList;

                // First-page skeleton: tab opened but no data yet.
                if (!loaded && loading && sourceList.length === 0) {
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden"
                        >
                          <div className="h-40 bg-gray-200 animate-pulse" />
                          <div className="p-2">
                            <div className="h-4 bg-gray-200 animate-pulse rounded mb-2" />
                            <div className="h-7 bg-gray-200 animate-pulse rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (displayChars.length === 0) {
                  // When searching, empty means server-side search returned
                  // nothing — so "no matches" is the right copy. When not
                  // searching, empty means library/community has zero rows.
                  const isFilteredEmpty = isSearchingMode;
                  return (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">{isFilteredEmpty ? '🔍' : (isMine ? '👦👧' : '🌍')}</div>
                      <p className="text-gray-600 mb-4">
                        {isFilteredEmpty
                          ? `No characters match "${importSearch}".`
                          : isMine
                            ? 'No characters in your library yet!'
                            : 'No community characters available yet.'}
                      </p>
                      {!isFilteredEmpty && isMine && (
                        <Link
                          href="/characters"
                          className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
                        >
                          Go to Character Library
                        </Link>
                      )}
                    </div>
                  );
                }

                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {displayChars.map((character) => {
                        const rawImg = character.animatedPreviewUrl || character.referenceImage.url;
                        const thumb = thumbnailUrl(rawImg, 320) || rawImg;
                        return (
                        <div
                          key={character.id}
                          className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all"
                        >
                          {rawImg ? (
                            <div className="h-40 bg-gradient-to-br from-blue-100 to-purple-100 relative">
                              <img
                                src={thumb}
                                alt={character.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                              {!isMine && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                                  Community
                                </div>
                              )}
                              {isMine && character.animatedPreviewUrl && (
                                <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                                  Preview
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-40 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center relative">
                              <div className="text-4xl">👤</div>
                              {!isMine && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                                  Community
                                </div>
                              )}
                            </div>
                          )}
                          <div className="p-2">
                            <h3 className="font-bold text-gray-900 text-sm mb-2 truncate">{character.name}</h3>
                            {(() => {
                              const alreadyInStory = characters.some(c => c.id === character.id);
                              // When opened from a scene-chip "+Add", already-in-story characters remain
                              // clickable (the handler routes them into the target scene). Otherwise keep
                              // the original disabled-"Added" behavior.
                              const disabled = alreadyInStory && addCharToSceneNumber === null;
                              const label = addCharToSceneNumber !== null
                                ? (alreadyInStory ? 'Add to scene' : 'Import & add to scene')
                                : (alreadyInStory ? 'Added' : 'Import');
                              return (
                                <button
                                  onClick={() => handleImportCharacter(character)}
                                  disabled={disabled}
                                  className="w-full bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium text-xs disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                                >
                                  {label}
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    {hasMore && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => {
                            if (loading) return;
                            if (isMine) {
                              if (user?.id) loadLibraryCharacters(user.id, libraryCharacters.length);
                            } else {
                              loadCommunityCharacters(communityCharacters.length);
                            }
                          }}
                          disabled={loading}
                          className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg transition-all"
                        >
                          {loading ? 'Loading…' : 'Load more'}
                        </button>
                      </div>
                    )}
                    {/* Search status: keeps the kid oriented while a query
                        is in-flight and warns when results hit the 100-row
                        server cap. */}
                    {isSearchingMode && (
                      <p className="text-center text-xs text-gray-500 mt-4">
                        {importSearching
                          ? 'Searching…'
                          : `Showing ${displayChars.length} match${displayChars.length === 1 ? '' : 'es'}${
                              displayChars.length === 100 ? ' (capped — try a more specific search)' : ''
                            }`}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Add Character Modal (Step 1) */}
        <CharacterFormModal
          isOpen={showAddCharacterModal}
          onClose={() => setShowAddCharacterModal(false)}
          imageProvider={imageProvider}
          onSave={(character) => {
            const newCharacter = {
              ...character,
              isPrimary: characters.length === 0,
              order: characters.length + 1,
              isFromLibrary: true, // Show compact view after save
            };
            setCharacters([...characters, newCharacter]);
            setShowAddCharacterModal(false);
          }}
        />

        {/* Define New Character Modal (Scene Preview — for AI-introduced characters) */}
        {/* key forces remount so useState initializer picks up editingCharacter */}
        {definingNewCharacterName && (
          <CharacterFormModal
            key={definingNewCharacterName}
            isOpen={true}
            onClose={() => setDefiningNewCharacterName(null)}
            imageProvider={imageProvider}
            editingCharacter={{
              id: `char-new-${definingNewCharacterName}`,
              name: definingNewCharacterName,
              referenceImage: { url: '', fileName: '' },
              description: { otherFeatures: '' },
              isPrimary: false,
              order: characters.length + 1,
            }}
            onSave={(character) => {
              // Check if character with this name already exists (avoid duplicates)
              const exists = characters.some(c =>
                c.name.toLowerCase() === character.name.toLowerCase()
              );
              if (exists) {
                // Update existing character instead of adding duplicate
                setCharacters(prev => prev.map(c =>
                  c.name.toLowerCase() === character.name.toLowerCase()
                    ? { ...character, isPrimary: c.isPrimary, order: c.order }
                    : c
                ));
              } else {
                setCharacters(prev => [...prev, {
                  ...character,
                  isPrimary: false,
                  order: prev.length + 1,
                  isFromLibrary: true,
                }]);
              }
              setDefiningNewCharacterName(null);
            }}
          />
        )}

        {/* Step 1.5: Language Selection - COMMENTED OUT (English is now default)
        {characters.length > 0 && enhancedScenes.length === 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl shadow-md p-6 border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm">
                  🌍
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Choose Story Language</h3>
              </div>
              <p className="text-gray-600 mb-4 ml-11 text-sm">
                Select the language for your story. This determines the language you'll write your scenes in and the language of the final storybook.
              </p>

              <div className="ml-11 flex gap-4">
                <label
                  className={`flex-1 cursor-pointer transition-all ${
                    contentLanguage === 'en'
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'bg-white hover:bg-gray-50'
                  } border-2 border-gray-200 rounded-xl p-4`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="contentLanguage"
                      value="en"
                      checked={contentLanguage === 'en'}
                      onChange={(e) => setContentLanguage(e.target.value as 'en' | 'zh')}
                      className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">🇺🇸</span>
                        <span className="font-semibold text-gray-900">English Story</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Write your scenes in English. Your child will read an English storybook.
                      </p>
                    </div>
                  </div>
                </label>

                <label
                  className={`flex-1 cursor-pointer transition-all ${
                    contentLanguage === 'zh'
                      ? 'ring-2 ring-purple-500 bg-purple-50'
                      : 'bg-white hover:bg-gray-50'
                  } border-2 border-gray-200 rounded-xl p-4`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="contentLanguage"
                      value="zh"
                      checked={contentLanguage === 'zh'}
                      onChange={(e) => setContentLanguage(e.target.value as 'en' | 'zh')}
                      className="w-5 h-5 text-purple-600 focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">🇨🇳</span>
                        <span className="font-semibold text-gray-900">Chinese Story / 中文故事</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        用中文编写场景。您的孩子将阅读中文故事书。
                      </p>
                    </div>
                  </div>
                </label>
              </div>

              <div className="ml-11 mt-4 p-3 bg-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">💡 Tip:</span>{' '}
                  {contentLanguage === 'en' ? (
                    <>Write your scene descriptions in <strong>English</strong>. For example: "A rabbit hopping through the forest."</>
                  ) : (
                    <>请用<strong>中文</strong>描述您的场景。例如："一只兔子在森林里蹦蹦跳跳。"</>
                  )}
                </p>
              </div>

            </div>
          </div>
        )}
        */}

        {/* Step 2: Script Input */}
        {characters.length > 0 && enhancedScenes.length === 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                2
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Write Story Scenes {contentLanguage === 'zh' ? '/ 编写故事场景' : ''}
              </h2>
            </div>
            <p className="text-gray-600 mb-4 ml-11">
              {contentLanguage === 'en' ? (
                'Describe each scene of your story. Write simple descriptions for each part of your story.'
              ) : (
                '描述您故事的每个场景。为故事的每个部分写简单的描述。'
              )}
            </p>
            <div className="flex gap-4 items-end">
              {/* Script — shrinks to 60% on desktop when coach open */}
              <div className={`transition-all duration-300 w-full ${
                isCoachModalOpen ? 'md:w-3/5' : ''
              }`}>
                <ScriptInput
                  value={scriptInput}
                  onChange={setScriptInput}
                  characters={characters}
                  selectedTemplate={selectedTemplate}
                  onTemplateChange={setSelectedTemplate}
                  onCoachClick={() => setIsCoachModalOpen(true)}
                  onScanInsert={(text) => {
                    // Append scanned text to existing script, or replace if empty
                    setScriptInput(prev => prev.trim() ? prev.trim() + '\n' + text : text);
                  }}
                />
              </div>

              {/* Desktop side panel — 40%, sticky */}
              {isCoachModalOpen && (
                <div className="hidden md:block w-2/5 min-w-0 sticky top-4">
                  <WritingCoachContent
                    onClose={() => setIsCoachModalOpen(false)}
                    script={scriptInput}
                    templateId={selectedTemplate}
                    characters={characters}
                    readingLevel={readingLevel}
                    onAcceptPolish={(newScript) => {
                      setScriptInput(newScript);
                    }}
                    className="max-h-[80vh]"
                  />
                </div>
              )}
            </div>

            {/* Mobile modal overlay — only on small screens */}
            {isCoachModalOpen && (
              <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setIsCoachModalOpen(false)}
                />
                <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                  <WritingCoachContent
                    onClose={() => setIsCoachModalOpen(false)}
                    script={scriptInput}
                    templateId={selectedTemplate}
                    characters={characters}
                    readingLevel={readingLevel}
                    onAcceptPolish={(newScript) => {
                      setScriptInput(newScript);
                      setIsCoachModalOpen(false);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Story Settings */}
        {characters.length > 0 && scriptInput.trim() && enhancedScenes.length === 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                3
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Configure Story Settings</h2>
            </div>
            <p className="text-gray-600 mb-4 ml-11">
              Customize the reading level, tone, and how much detail you want in your story.
            </p>
            <StorySettingsPanel
              readingLevel={readingLevel}
              onReadingLevelChange={setReadingLevel}
              storyTone={storyTone}
              onStoryToneChange={setStoryTone}
              clothingConsistency={clothingConsistency}
              onClothingConsistencyChange={setClothingConsistency}
              expansionLevel={expansionLevel}
              onExpansionLevelChange={setExpansionLevel}
              contentLanguage={contentLanguage}
              secondaryLanguage={secondaryLanguage}
              onSecondaryLanguageChange={setSecondaryLanguage}
              disabled={isEnhancing}
            />

            {/* Enhance Button */}
            <div className="mt-6 bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Ready to Enhance Your Story?
              </h3>
              <p className="text-gray-600 mb-6">
                AI will create detailed image prompts and age-appropriate captions for your {scriptInput.split('\n').filter(l => l.trim()).length} scenes.
              </p>
              <div className="flex gap-4 items-center flex-wrap">
                <button
                  onClick={handleEnhanceScenes}
                  disabled={isEnhancing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEnhancing ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      Enhancing Scenes...
                    </>
                  ) : (
                    'Enhance Scenes & Captions'
                  )}
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft || isEnhancing}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-4 rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  aria-label="Save story as draft to continue later"
                >
                  {savingDraft ? 'Saving...' : (draftProjectId ? 'Update Draft' : 'Save as Draft')}
                </button>
                {draftSaveMessage && (
                  <span className={`text-sm font-medium ${draftSaveMessage === 'Draft saved!' ? 'text-green-600' : 'text-red-600'}`}>
                    {draftSaveMessage}
                  </span>
                )}
                {renderAutosavePill()}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Scene Preview & Approval */}
        {enhancedScenes.length > 0 && generatedImages.length === 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                4
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Review & Approve Scenes</h2>
            </div>
            <p className="text-gray-600 mb-4 ml-11">
              Review the enhanced scene descriptions and captions. You can edit them before generating images.
            </p>
            <ScenePreviewApproval
              enhancedScenes={enhancedScenes}
              originalSceneCount={parsedScenes.length}
              userCharacters={characters.map(c => c.name)}
              onApprove={handleGenerateImages}
              onBack={handleRegenerateAll}
              onCaptionEdit={handleCaptionEdit}
              onCaptionSecondaryEdit={handleCaptionSecondaryEdit}
              onImagePromptEdit={handleImagePromptEdit}
              onScenesUpdate={handleScenesUpdate}
              onTitleEdit={handleTitleEdit}  // NEW: Title editing
              onDescriptionEdit={handleDescriptionEdit}  // NEW: Description editing
              isGenerating={isGenerating}
              readingLevel={readingLevel}
              storyTone={storyTone}
              expansionLevel={expansionLevel}
              contentLanguage={contentLanguage}
              secondaryLanguage={secondaryLanguage}
              artStyle={artStyle}
              onArtStyleChange={setArtStyle}
              imageProvider={imageProvider}
              onImageProviderChange={setImageProvider}
              onSaveDraft={handleSaveDraft}
              savingDraft={savingDraft}
              draftSaveLabel={draftProjectId ? 'Update Draft' : 'Save as Draft'}
              draftSaveMessage={draftSaveMessage || undefined}
              onDefineNewCharacter={(name) => setDefiningNewCharacterName(name)}
              storyBible={storyBible}
              savedLocationTempIds={savedLocationTempIds}
              stalePromptSceneNumbers={stalePromptSceneNumbers}
              onSceneCharactersChange={(sceneNumber, names) => {
                setStoryBible(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    scenes: prev.scenes.map(s =>
                      s.sceneNumber === sceneNumber ? { ...s, resolved_character_names: names } : s
                    ),
                  };
                });
                setStalePromptSceneNumbers(prev => new Set(prev).add(sceneNumber));
              }}
              onSceneLocationChange={(sceneNumber, locationTempId) => {
                setStoryBible(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    scenes: prev.scenes.map(s =>
                      s.sceneNumber === sceneNumber ? { ...s, location_temp_id: locationTempId } : s
                    ),
                  };
                });
                setStalePromptSceneNumbers(prev => new Set(prev).add(sceneNumber));
              }}
              onRequestAddCharacter={(sceneNumber) => {
                setAddCharToSceneNumber(sceneNumber);
                setShowImportModal(true);
              }}
              onSaveLocationToLibrary={async (location) => {
                try {
                  const response = await fetch('/api/characters/save-scene', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: location.name,
                      description: location.description,
                      // Pre-save there is no story_locations row yet; pass null.
                      // Post-save (re-enhance on an existing project) could supply it in a later iteration.
                      sourceStoryLocationId: null,
                    }),
                  });
                  if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || 'Failed to save scene to library');
                  }
                  // Optimistic: mark this temp_id as saved so the bookmark flips to "already saved"
                  setSavedLocationTempIds(prev => {
                    const next = new Set(prev);
                    next.add(location.temp_id);
                    return next;
                  });
                } catch (error) {
                  console.error('[save-scene] Failed:', error);
                  alert(error instanceof Error ? error.message : 'Failed to save scene to library');
                }
              }}
            />
          </div>
        )}

        {/* Generation Progress */}
        {isGenerating && (
          <div className="mb-8">
            <GenerationProgress
              images={imageGenerationStatus}
              totalScenes={parsedScenes.length}
            />
          </div>
        )}

        {/* Generation failure — image/daily limit (429) or a server error.
            Renders the case where generation finished with zero completed images,
            which previously showed nothing at all. */}
        {generationError && !isGenerating && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4" role="alert" aria-live="assertive">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">
                  {generationError.isLimit ? 'Image limit reached' : 'Image generation failed'}
                </p>
                <p className="text-sm text-red-700 mt-0.5">{generationError.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {generationError.isLimit ? (
                    <a
                      href="/upgrade"
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                    >
                      Upgrade for more images
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGenerateImages}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                    >
                      Try again
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Generated Images */}
        {imageGenerationStatus.length > 0 && imageGenerationStatus.some(img => img.status === 'completed') && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white font-bold text-sm">
                ✓
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Your Story is Complete!</h2>
            </div>
            <p className="text-gray-600 mb-4 ml-11">
              Review your generated images. You can regenerate individual scenes if needed.
            </p>
            <ImageGallery
              generatedImages={imageGenerationStatus}
              characters={characters}
              artStyle={ART_STYLE}
              imageProvider={imageProvider}
              illustrationStyle={artStyle}
              clothingConsistency={clothingConsistency}
              enhancedScenes={enhancedScenes}
              onCaptionEdit={handleCaptionEdit}
              onCaptionSecondaryEdit={handleCaptionSecondaryEdit}
              onTitleEdit={handleTitleEdit}
              onDescriptionEdit={handleDescriptionEdit}
              secondaryLanguage={secondaryLanguage}
              storyBible={storyBible}
              onSceneCharactersChange={(sceneNumber, names) => {
                setStoryBible(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    scenes: prev.scenes.map(s =>
                      s.sceneNumber === sceneNumber ? { ...s, resolved_character_names: names } : s
                    ),
                  };
                });
                setStalePromptSceneNumbers(prev => new Set(prev).add(sceneNumber));
              }}
              onSceneLocationChange={(sceneNumber, locationTempId) => {
                setStoryBible(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    scenes: prev.scenes.map(s =>
                      s.sceneNumber === sceneNumber ? { ...s, location_temp_id: locationTempId } : s
                    ),
                  };
                });
                setStalePromptSceneNumbers(prev => new Set(prev).add(sceneNumber));
              }}
              onRequestAddCharacter={(sceneNumber) => {
                setAddCharToSceneNumber(sceneNumber);
                setShowImportModal(true);
              }}
              onRegenerateScene={(imageId, newImageData) => {
                // Replace the image in the status array
                setImageGenerationStatus(prev =>
                  prev.map(img =>
                    img.id === imageId
                      ? { ...img, ...newImageData }
                      : img
                  )
                );
              }}
            />

            {/* Save & Export Options */}
            <div className="bg-white rounded-2xl shadow-xl p-8 mt-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Your Story is Ready! 🎉
              </h3>
              <p className="text-gray-600 mb-6">
                Save your story to your library or export it as a PDF.
              </p>
              <div className="flex gap-4 flex-wrap">
                <button
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    // Pre-populate with generated title/description from enhancement
                    setSaveTitle(storyTitle || saveTitle);
                    setSaveDescription(storyDescription || saveDescription);
                    setShowSaveModal(true);
                  }}
                  disabled={isSaving}
                >
                  💾 Save to Library
                </button>
                <button
                  className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    // Require story to be saved first for PDF generation
                    if (!saveTitle || !storyTitle) {
                      alert('📖 Please save your story to the library first before downloading PDF.\n\nClick "Save to Library" button to save your story.');
                      return;
                    }
                    handleDownloadPDF();
                  }}
                  disabled={generatingPDF || !saveTitle}
                  title={!saveTitle ? 'Save story first to download PDF' : 'Download PDF'}
                >
                  {generatingPDF ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating PDF...
                    </span>
                  ) : (
                    '📄 Download PDF'
                  )}
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  aria-label="Save story as draft to continue later"
                >
                  {savingDraft ? 'Saving...' : (draftProjectId ? 'Update Draft' : 'Save as Draft')}
                </button>
                <Link
                  href="/dashboard"
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all flex items-center"
                >
                  ← Back to Dashboard
                </Link>
              </div>
              {draftSaveMessage && (
                <p className={`mt-3 text-sm font-medium ${draftSaveMessage === 'Draft saved!' ? 'text-green-600' : 'text-red-600'}`}>
                  {draftSaveMessage}
                </p>
              )}
              <div className="mt-2">{renderAutosavePill()}</div>
            </div>
          </div>
        )}

        {/* Quiz Preview Modal */}
        {showQuizModal && quizData && (
          <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Quiz Preview</h2>
                <button
                  onClick={() => setShowQuizModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6 mb-6">
                {quizData.map((question: any, index: number) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-3">
                      {index + 1}. {question.question}
                    </p>
                    <div className="space-y-2 ml-4">
                      {['A', 'B', 'C', 'D'].map((letter, optIndex) => {
                        const option = question[`option_${letter.toLowerCase()}`];
                        return (
                          <div
                            key={letter}
                            className="flex items-start gap-2 p-2 rounded bg-white"
                          >
                            <span className="font-medium text-gray-700">{letter}.</span>
                            <span className="text-gray-700">
                              {option}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setQuizData(null);
                    setShowQuizModal(false);
                  }}
                  className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-xl hover:bg-gray-600 font-semibold transition-all"
                >
                  ↻ Regenerate
                </button>
                <button
                  onClick={approveQuiz}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-semibold transition-all"
                >
                  ✓ Use This Quiz
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Story Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Save Your Story</h2>
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setSaveError('');
                  }}
                  disabled={isSaving}
                  className="text-gray-400 hover:text-gray-600 text-2xl disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Title - Read-only (generated during enhancement) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ✅ Story Title
                  </label>
                  <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-semibold">
                    {saveTitle || 'Untitled Story'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Edit in the scene review screen if needed
                  </p>
                </div>

                {/* Description - Read-only (generated during enhancement) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ✅ Description
                  </label>
                  <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 min-h-[60px]">
                    {saveDescription || 'No description'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Edit in the scene review screen if needed
                  </p>
                </div>

                {/* Cover Preview */}
                {imageGenerationStatus.find(img => img.sceneNumber === 0)?.imageUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ✅ Cover Image
                    </label>
                    <img
                      src={imageGenerationStatus.find(img => img.sceneNumber === 0)?.imageUrl}
                      alt="Cover"
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Author Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      disabled={isSaving}
                      placeholder="e.g., Connor"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Age (Optional)
                    </label>
                    <input
                      type="number"
                      value={authorAge}
                      onChange={(e) => setAuthorAge(e.target.value)}
                      disabled={isSaving}
                      placeholder="e.g., 5"
                      min="1"
                      max="12"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {saveError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{saveError}</p>
                  </div>
                )}

                {/* REMOVED: Old "Generate Cover Preview" button - cover is now generated with scenes */}

                {coverImageUrl && !coverApproved && (
                  <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                    <p className="text-sm font-medium text-gray-700 mb-2">Cover Preview:</p>
                    <img
                      src={coverImageUrl}
                      alt="Generated cover"
                      className="w-full rounded-lg shadow-lg mb-3"
                    />

                    {/* Edit Image Control - Uses Qwen Image Edit */}
                    <div className="mb-3">
                      <EditImageControl
                        currentImageUrl={coverImageUrl}
                        imageType="cover"
                        imageId="cover"
                        onEditComplete={(newUrl) => setCoverImageUrl(newUrl)}
                        imageProvider={imageProvider}
                        characters={characters}
                      />
                    </div>

                    {/* Approve Button */}
                    <button
                      onClick={approveCover}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all"
                    >
                      ✓ Use This Cover
                    </button>
                  </div>
                )}

                {/* ============================================================
                // DEPRECATED: Old cover editing UI - kept for reference
                // Replaced by EditImageControl + Qwen Image Edit API
                {coverImageUrl && !coverApproved && (
                  <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                    <p className="text-sm font-medium text-gray-700 mb-2">Cover Preview:</p>
                    <img
                      src={coverImageUrl}
                      alt="Generated cover"
                      className="w-full rounded-lg shadow-lg mb-3"
                    />

                    <div className="mb-3">
                      <button
                        onClick={() => setShowPromptEditor(!showPromptEditor)}
                        className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        <span className={`transform transition-transform ${showPromptEditor ? 'rotate-90' : ''}`}>▶</span>
                        {showPromptEditor ? 'Hide' : 'Show'} AI Prompt
                      </button>

                      {showPromptEditor && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={customCoverPrompt}
                            onChange={(e) => setCustomCoverPrompt(e.target.value)}
                            placeholder="Edit the AI prompt to customize your cover..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                            rows={4}
                          />
                          <p className="text-xs text-gray-500">
                            Tip: Describe what you want on the cover - characters, scene, mood, colors.
                          </p>
                          <button
                            onClick={() => generateCoverPreview(true)}
                            disabled={generatingCover || !customCoverPrompt.trim()}
                            className="w-full bg-purple-600 text-white px-3 py-2 text-sm rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {generatingCover ? 'Regenerating...' : '✨ Regenerate with Custom Prompt'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => generateCoverPreview(false)}
                        disabled={generatingCover}
                        className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50"
                      >
                        ↻ Try Again
                      </button>
                      <button
                        onClick={approveCover}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all"
                      >
                        ✓ Use This Cover
                      </button>
                    </div>
                  </div>
                )}
                ============================================================ */}

                {/* REMOVED: Old "Cover Approved" message - cover is now part of scene generation */}

                {/* Quiz Generation Section - Show if no quiz generated yet */}
                {!quizData && (
                  <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                    <p className="text-sm font-medium text-gray-700 mb-3">Generate Quiz (Optional)</p>
                    <p className="text-xs text-gray-600 mb-3">
                      AI will create comprehension questions to include with your story.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Difficulty
                        </label>
                        <select
                          value={quizDifficulty}
                          onChange={(e) => setQuizDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                          disabled={generatingQuiz}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Questions
                        </label>
                        <select
                          value={quizQuestionCount}
                          onChange={(e) => setQuizQuestionCount(parseInt(e.target.value))}
                          disabled={generatingQuiz}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                        >
                          <option value="3">3 Questions</option>
                          <option value="5">5 Questions</option>
                          <option value="10">10 Questions</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateQuiz}
                      disabled={generatingQuiz}
                      className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {generatingQuiz ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Generating Quiz...
                        </span>
                      ) : (
                        '🧠 Generate Quiz'
                      )}
                    </button>
                  </div>
                )}

                {quizData && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-2xl">🧠</span>
                    <div className="flex-1">
                      <span className="text-green-700 font-medium">✓ Quiz Generated!</span>
                      <p className="text-xs text-green-600">{quizData.length} questions ready</p>
                    </div>
                    <button
                      onClick={() => setShowQuizModal(true)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Preview
                    </button>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    This will save your story with {imageGenerationStatus.filter(img => img.sceneNumber > 0).length} scenes ({imageGenerationStatus.filter(img => img.status === 'completed' && img.sceneNumber > 0).length} with images){quizData ? ` and ${quizData.length} quiz questions` : ''} to your library.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveStory}
                  disabled={isSaving || !saveTitle.trim()}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </span>
                  ) : (
                    '💾 Save Story'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setSaveError('');
                    setCoverImageUrl(null);
                    setCoverImagePrompt('');
                    setCoverApproved(false);
                    setGeneratingCover(false);
                  }}
                  disabled={isSaving}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}

// Wrap with Suspense for useSearchParams
export default function CreateStoryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CreateStoryPageInner />
    </Suspense>
  );
}
