/**
 * Authenticated Story Creation Page
 * For logged-in users to create stories with character library
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import CharacterManager from '@/components/story/CharacterManager';
import ScriptInput from '@/components/story/ScriptInput';
import StorySettingsPanel from '@/components/story/StorySettingsPanel';
import ScenePreviewApproval from '@/components/story/ScenePreviewApproval';
import GenerationProgress from '@/components/story/GenerationProgress';
import ImageGallery from '@/components/story/ImageGallery';
import FeedbackModal from '@/components/feedback/FeedbackModal';
import { Character, Scene, StorySession, GeneratedImage, StoryTone, EnhancedScene, ExpansionLevel } from '@/lib/types/story';
import { parseScriptIntoScenes } from '@/lib/scene-parser';
import Link from 'next/link';
import { generateAndDownloadStoryPDF } from '@/lib/services/pdf.service';
import { getGuestStory, clearGuestStory } from '@/lib/utils/guest-story-storage';
import UpgradeModal from '@/components/ui/UpgradeModal';

const CHARACTERS_STORAGE_KEY = 'storyme_character_library';
const ART_STYLE = "children's book illustration, colorful, whimsical";

export default function CreateStoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Story creation state
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scriptInput, setScriptInput] = useState('');
  const [parsedScenes, setParsedScenes] = useState<Scene[]>([]);

  // Story settings (NEW)
  const [readingLevel, setReadingLevel] = useState<number>(5);
  const [storyTone, setStoryTone] = useState<StoryTone>('playful');
  const [expansionLevel, setExpansionLevel] = useState<ExpansionLevel>('minimal');

  // Language selection (NEW - Bilingual Support)
  const [contentLanguage, setContentLanguage] = useState<'en' | 'zh'>('en');

  // Enhancement state (NEW)
  const [enhancedScenes, setEnhancedScenes] = useState<EnhancedScene[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Image generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imageGenerationStatus, setImageGenerationStatus] = useState<GeneratedImage[]>([]);

  // UI state
  const [session, setSession] = useState<StorySession | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [libraryCharacters, setLibraryCharacters] = useState<Character[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorAge, setAuthorAge] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  // Cover preview state
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImagePrompt, setCoverImagePrompt] = useState<string>('');
  const [generatingCover, setGeneratingCover] = useState(false);
  const [coverApproved, setCoverApproved] = useState(false);

  // Quiz generation state
  const [quizData, setQuizData] = useState<any>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(3);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'trial_expired' | 'story_limit_reached'>('story_limit_reached');
  const [storiesUsed, setStoriesUsed] = useState(0);
  const [storiesLimit, setStoriesLimit] = useState(5);

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
          // Determine the reason
          if (data.reason?.includes('trial has expired')) {
            setUpgradeReason('trial_expired');
          } else {
            setUpgradeReason('story_limit_reached');
          }
          setStoriesUsed(data.storiesUsed || 0);
          setStoriesLimit(data.storiesLimit || 5);
          setShowUpgradeModal(true);
        }
      } catch (error) {
        console.error('Error checking limits:', error);
      }
    };

    checkLimits();
  }, [user]);

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

  const handleCharactersChange = (newCharacters: Character[]) => {
    setCharacters(newCharacters);
  };

  const loadLibraryCharacters = async (userId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('character_library')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform database records to Character type
      const transformedCharacters: Character[] = (data || []).map((char: any) => ({
        id: char.id,
        name: char.name,
        referenceImage: {
          url: char.reference_image_url || '',
          fileName: char.reference_image_filename || '',
        },
        description: {
          hairColor: char.hair_color,
          skinTone: char.skin_tone,
          clothing: char.clothing,
          age: char.age,
          otherFeatures: char.other_features,
        },
        isPrimary: false,
        order: 0,
      }));

      setLibraryCharacters(transformedCharacters);
    } catch (error) {
      console.error('Error loading library characters:', error);
      setLibraryCharacters([]);
    }
  };

  const handleImportCharacter = (character: Character) => {
    // Check if character already exists
    const exists = characters.find(c => c.id === character.id);
    if (exists) {
      alert('This character is already added to your story');
      return;
    }

    // Add character to story
    // Set first character as primary automatically
    const importedCharacter = {
      ...character,
      isPrimary: characters.length === 0, // First character is primary
      order: characters.length + 1,
      isFromLibrary: true, // Mark as imported from library
    };
    setCharacters([...characters, importedCharacter]);
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

      // Reload library characters if modal is open
      if (showImportModal) {
        await loadLibraryCharacters(user.id);
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

      // Call AI enhancement API
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
          expansionLevel, // NEW: Pass expansion level to API
          language: contentLanguage, // NEW: Pass content language (en or zh)
          characters: characters.map(c => ({
            name: c.name,
            description: Object.values(c.description).filter(Boolean).join(', ')
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

      // Store enhanced scenes
      setEnhancedScenes(data.enhancedScenes);

      console.log(`✓ Enhanced ${data.enhancedScenes.length} scenes successfully`);

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

  const generateCoverPreview = async () => {
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

  const handleSaveStory = async () => {
    if (!saveTitle.trim()) {
      setSaveError('Please enter a title for your story');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      // Prepare scenes data with enhancement info
      const scenesData = imageGenerationStatus
        .filter(img => img.status === 'completed')
        .map(img => {
          const enhancedScene = enhancedScenes.find(es => es.sceneNumber === img.sceneNumber);
          return {
            sceneNumber: img.sceneNumber,
            description: img.sceneDescription,
            raw_description: enhancedScene?.raw_description || img.sceneDescription,
            enhanced_prompt: enhancedScene?.enhanced_prompt || img.sceneDescription,
            caption: enhancedScene?.caption || img.sceneDescription,
            imageUrl: img.imageUrl,
            prompt: img.prompt,
            generationTime: img.generationTime,
          };
        });

      if (scenesData.length === 0) {
        setSaveError('No completed scenes to save');
        setIsSaving(false);
        return;
      }

      // Use the pre-approved cover image URL
      const coverImageUrlToSave = coverImageUrl || undefined;

      if (coverImageUrlToSave) {
        console.log('✅ Using pre-approved cover:', coverImageUrlToSave);
      } else {
        console.log('⚠️ No cover image approved, saving without cover');
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
                reference_image_url: character.referenceImage.url,
                reference_image_filename: character.referenceImage.fileName,
              };

              // Only include description fields if they have values
              if (character.description.hairColor) {
                characterPayload.hair_color = character.description.hairColor;
              }
              if (character.description.skinTone) {
                characterPayload.skin_tone = character.description.skinTone;
              }
              if (character.description.clothing) {
                characterPayload.clothing = character.description.clothing;
              }
              if (character.description.age) {
                characterPayload.age = character.description.age;
              }
              if (character.description.otherFeatures) {
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

      // Call save API
      const response = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveTitle.trim(),
          description: saveDescription.trim() || undefined,
          authorName: authorName.trim() || undefined,
          authorAge: authorAge ? parseInt(authorAge) : undefined,
          coverImageUrl: coverImageUrlToSave,
          originalScript: scriptInput,
          readingLevel: readingLevel, // NEW
          storyTone: storyTone,       // NEW
          contentLanguage: contentLanguage, // NEW: Store content language (en or zh)
          characterIds: characterIds,
          scenes: scenesData,
          quizData: quizData || undefined, // Include quiz if generated
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save story');
      }

      // Clear guest story from sessionStorage after successful save
      clearGuestStory();
      console.log('✓ Cleared guest story from sessionStorage');

      // Close save modal
      setShowSaveModal(false);

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
          imageUrl: img.imageUrl,
        };
      });

      // Format author string: "Name, age X" or just "Name" or fallback
      let authorString = authorName.trim();
      if (authorString && authorAge) {
        authorString += `, age ${authorAge}`;
      } else if (!authorString) {
        authorString = user?.name || 'My Family';
      }

      await generateAndDownloadStoryPDF({
        title,
        description: saveDescription,
        scenes: scenesData,
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
      // Build script from enhanced prompts for image generation
      const enhancedScript = enhancedScenes
        .map(s => s.enhanced_prompt)
        .join('\n');

      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characters: characters,
          script: enhancedScript, // Use enhanced prompts, not raw script
          artStyle: ART_STYLE,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      // Update the image generation status with the actual results
      // BUT preserve the captions from enhancedScenes
      if (data.generatedImages) {
        const updatedImages = data.generatedImages.map((img: any) => {
          const enhancedScene = enhancedScenes.find(es => es.sceneNumber === img.sceneNumber);
          return {
            ...img,
            sceneDescription: enhancedScene?.caption || img.sceneDescription, // Use caption
          };
        });
        setImageGenerationStatus(updatedImages);
      }

      // Extract image URLs for the gallery
      const imageUrls = data.generatedImages?.map((img: any) => img.imageUrl).filter(Boolean) || [];
      setGeneratedImages(imageUrls);
    } catch (error) {
      console.error('Generation error:', error);
      // Mark all as failed
      setImageGenerationStatus(initialStatus.map(img => ({
        ...img,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Generation failed',
      })));
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                onClick={async () => {
                  if (user?.id) {
                    await loadLibraryCharacters(user.id);
                    setShowImportModal(true);
                  }
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium text-sm shadow transition-all flex items-center gap-2"
              >
                <span>📚</span> Import from Library
              </button>
              {characters.length < 5 && (
                <button
                  onClick={() => {
                    const newCharacter = {
                      id: `char-${Date.now()}`,
                      name: '',
                      referenceImage: { url: '', fileName: '' },
                      description: {},
                      isPrimary: characters.length === 0,
                      order: characters.length + 1,
                    };
                    setCharacters([...characters, newCharacter]);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm shadow transition-all"
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
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Import from Character Library</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {libraryCharacters.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👦👧</div>
                  <p className="text-gray-600 mb-4">No characters in your library yet!</p>
                  <Link
                    href="/characters"
                    className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
                  >
                    Go to Character Library
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {libraryCharacters.map((character) => (
                    <div
                      key={character.id}
                      className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all"
                    >
                      {character.referenceImage.url ? (
                        <div className="h-32 bg-gradient-to-br from-blue-100 to-purple-100">
                          <img
                            src={character.referenceImage.url}
                            alt={character.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-32 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                          <div className="text-4xl">👤</div>
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 mb-2">{character.name}</h3>
                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          {character.description.hairColor && <p>Hair: {character.description.hairColor}</p>}
                          {character.description.age && <p>Age: {character.description.age}</p>}
                        </div>
                        <button
                          onClick={() => handleImportCharacter(character)}
                          disabled={characters.some(c => c.id === character.id)}
                          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                        >
                          {characters.some(c => c.id === character.id) ? 'Already Added' : 'Import Character'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1.5: Language Selection (NEW - Bilingual Support) */}
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
                {/* English Option */}
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

                {/* Chinese Option */}
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

              {/* Helpful hint based on selection */}
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
            <ScriptInput
              value={scriptInput}
              onChange={setScriptInput}
              characters={characters}
            />
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
              expansionLevel={expansionLevel}
              onExpansionLevelChange={setExpansionLevel}
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
              <button
                onClick={handleEnhanceScenes}
                disabled={isEnhancing}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:from-purple-700 hover:to-pink-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEnhancing ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Enhancing Scenes...
                  </>
                ) : (
                  '✨ Enhance Scenes & Captions'
                )}
              </button>
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
              isGenerating={isGenerating}
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
                  onClick={async () => {
                    // Generate AI-powered title and description
                    if (!saveTitle || !saveDescription) {
                      await handleGenerateMetadata();
                    }
                    setShowSaveModal(true);
                  }}
                  disabled={isSaving}
                >
                  💾 Save to Library
                </button>
                <button
                  className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
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
                <Link
                  href="/dashboard"
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all flex items-center"
                >
                  ← Back to Dashboard
                </Link>
              </div>
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
                {/* AI Generation Info */}
                {isGeneratingMetadata && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-blue-700">AI is writing your title and description...</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Story Title <span className="text-red-500">*</span>
                    </label>
                    <button
                      onClick={handleGenerateMetadata}
                      disabled={isSaving || isGeneratingMetadata}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      ✨ Regenerate with AI
                    </button>
                  </div>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    disabled={isSaving || isGeneratingMetadata}
                    placeholder={isGeneratingMetadata ? "Generating..." : "Enter a title for your story"}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    disabled={isSaving || isGeneratingMetadata}
                    placeholder={isGeneratingMetadata ? "Generating..." : "Add a brief description of your story"}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

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

                {/* Cover Preview Section */}
                {!coverImageUrl && !coverApproved && (
                  <button
                    onClick={generateCoverPreview}
                    disabled={!saveTitle.trim() || generatingCover}
                    className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingCover ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Generating Cover Preview...
                      </span>
                    ) : (
                      '🎨 Generate Cover Preview'
                    )}
                  </button>
                )}

                {coverImageUrl && !coverApproved && (
                  <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                    <p className="text-sm font-medium text-gray-700 mb-2">Cover Preview:</p>
                    <img
                      src={coverImageUrl}
                      alt="Generated cover"
                      className="w-full rounded-lg shadow-lg mb-3"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={regenerateCover}
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

                {coverApproved && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <img
                      src={coverImageUrl || ''}
                      alt="Approved cover"
                      className="w-16 h-16 rounded object-cover"
                    />
                    <span className="text-green-700 font-medium">✓ Cover Approved!</span>
                  </div>
                )}

                {/* Quiz Generation Section */}
                {coverApproved && !quizData && (
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
                    This will save your story with {imageGenerationStatus.filter(img => img.status === 'completed').length} scenes{quizData ? ` and ${quizData.length} quiz questions` : ''} to your library.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveStory}
                  disabled={isSaving || !saveTitle.trim() || !coverApproved}
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

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
        storiesUsed={storiesUsed}
        storiesLimit={storiesLimit}
      />
    </>
  );
}
