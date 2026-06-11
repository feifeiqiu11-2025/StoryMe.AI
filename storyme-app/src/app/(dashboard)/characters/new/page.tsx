/**
 * Character creation page with animated preview
 *
 * Supports TWO modes:
 * 1. Photo-based: Upload photo → GPT-4V analyzes → fills description → Gemini generates animated version
 * 2. Description-only: Enter character type (e.g., "baby eagle") → Gemini generates from description
 *
 * Both modes support 2D Classic and 3D Pixar styles.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SketchGuideViewer, SketchStep } from '@/components/characters/SketchGuideViewer';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import { compressImageForUpload } from '@/lib/utils/compress-image';
import {
  ImageProvider,
  ImageMedium,
  VISIBLE_IMAGE_PROVIDER_OPTIONS,
  DEFAULT_IMAGE_PROVIDER,
} from '@/lib/types/story';

type PreviewStatus = 'idle' | 'generating' | 'ready' | 'error';
type CharacterMode = 'photo' | 'description';
type SelectedStyle = 'pixar' | 'classic';
type ViewMode = 'create' | 'sketch-preview' | 'sketch-guide';

export default function NewCharacterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View mode: create form, sketch preview, or sketch guide
  const [viewMode, setViewMode] = useState<ViewMode>('create');

  // Character mode: photo-based or description-only
  const [characterMode, setCharacterMode] = useState<CharacterMode>('photo');

  // Sketch guide state
  const [sketchGuideData, setSketchGuideData] = useState<{
    sketch_preview_url: string;
    steps: SketchStep[];
    character_description: string;
  } | null>(null);
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);

  // Photo-based mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [characterType, setCharacterType] = useState(''); // For description-only mode
  const [hairColor, setHairColor] = useState('');
  const [skinTone, setSkinTone] = useState('');
  const [clothing, setClothing] = useState('');
  const [age, setAge] = useState('');
  const [otherFeatures, setOtherFeatures] = useState('');

  // Preview state - per-style independent generation (each click = 1 API call)
  const [pixarPreviewUrl, setPixarPreviewUrl] = useState<string | null>(null);
  const [classicPreviewUrl, setClassicPreviewUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<SelectedStyle>('pixar');
  const [isGeneratingPixar, setIsGeneratingPixar] = useState(false);
  const [isGeneratingClassic, setIsGeneratingClassic] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [descriptionChanged, setDescriptionChanged] = useState(false);

  // Detected medium from analyze step — drives prompt selection.
  // User can override via the "Wrong?" toggle in case of misclassification.
  const [detectedMedium, setDetectedMedium] = useState<ImageMedium>('real_photo');

  // Admin-only image provider toggle (gemini-3.1 default; openai-gpt-image-2 is the new option)
  const [isAdmin, setIsAdmin] = useState(false);
  const [imageProvider, setImageProvider] = useState<ImageProvider>(DEFAULT_IMAGE_PROVIDER);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject only formats the canvas can't reliably decode. HEIC/HEIF — the iPad
    // default — ARE allowed: compressImageForUpload converts them to JPEG below.
    // That conversion also resizes large iPhone/iPad photos, fixing the size
    // failures (raw HEIC/large JPEGs previously hit the upload limit).
    const name = file.name.toLowerCase();
    const unsupported = ['.avif', '.bmp', '.tiff', '.tif', '.svg'];
    if (unsupported.some((ext) => name.endsWith(ext))) {
      setError('Unsupported image format. Please use JPG, PNG, HEIC, GIF, or WebP.');
      return;
    }

    setError(null);
    setPixarPreviewUrl(null);
    setClassicPreviewUrl(null);
    setPreviewStatus('idle');
    setIsApproved(false);
    setIsAnalyzing(true); // covers HEIC decode + compression, then the upload/analyze below

    // Normalize client-side: HEIC→JPEG, downscale long-edge ≤4096, re-encode JPEG.
    let normalized: File;
    try {
      const compressed = await compressImageForUpload(file);
      console.log(
        `[characters/new] Normalized ${file.name}: ` +
        `${(compressed.originalBytes / 1024).toFixed(0)}KB → ${(compressed.compressedBytes / 1024).toFixed(0)}KB ` +
        `(${compressed.width}×${compressed.height})`
      );
      normalized = compressed.file;
    } catch (err) {
      console.error('[characters/new] Image normalization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to read this image. Please try a different photo.');
      setIsAnalyzing(false);
      return;
    }

    // Store the normalized JPEG so the preview, auto-analyze, AND the save-time
    // fallback upload (uses imageFile directly) all use a provider-safe format —
    // never a raw HEIC.
    setImageFile(normalized);

    // Preview from the normalized file
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(normalized);

    // Auto-analyze (manages isAnalyzing in its finally block)
    autoAnalyzeImage(normalized);
  };

  const autoAnalyzeImage = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Upload image first
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const uploadData = await uploadResponse.json();
      setUploadedImageUrl(uploadData.url);

      console.log('Analyzing character image:', uploadData.url);

      // Analyze the uploaded image using unified Gemini API
      const analysisResponse = await fetch('/api/analyze-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: uploadData.url }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        console.log('Character analysis successful:', analysisData);

        if (analysisData.success) {
          if (analysisData.subjectType === 'human' && analysisData.humanDetails) {
            // Human detected: use structured fields
            const details = analysisData.humanDetails;
            const otherFeatures = [details.gender, details.otherFeatures]
              .filter(Boolean)
              .join(', ');

            setHairColor(details.hairColor || '');
            setSkinTone(details.skinTone || '');
            setClothing(details.clothing || '');
            setAge(details.age || '');
            setOtherFeatures(otherFeatures || '');
          } else {
            // Non-human detected: clear human fields, use description
            setHairColor('');
            setSkinTone('');
            setClothing('');
            setAge('');
            setOtherFeatures(analysisData.briefDescription || '');
          }

          // Capture detected medium so the kid_creation faithfulness prompt is used
          // when the user clicks Generate. User can override via the "Wrong?" toggle.
          if (analysisData.medium) {
            setDetectedMedium(analysisData.medium as ImageMedium);
          }

          // Note: previously this auto-fired both styles. We now defer to the user
          // clicking the "2D" or "3D" Generate button so each generation is intentional
          // and only the chosen style is billed.
        }
      } else {
        const errorData = await analysisResponse.json();
        console.error('Image analysis failed:', errorData);
        // User can fill in manually
      }
    } catch (analysisError: unknown) {
      console.error('Auto-analysis error:', analysisError);
      // Fail silently - user can fill in manually
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load current user on mount + set admin flag (controls visibility of model toggle)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(isAdminEmail(user?.email));
    });
  }, []);

  // Generate animated preview for a single style (one API call per click)
  const generatePreview = useCallback(async (style: SelectedStyle) => {
    // Validate based on mode
    if (characterMode === 'photo') {
      if (!uploadedImageUrl || !name.trim()) {
        setPreviewError('Please provide a name and upload an image first');
        return;
      }
    } else {
      if (!name.trim() || !characterType.trim()) {
        setPreviewError('Please provide a name and character type');
        return;
      }
    }

    // Per-style generating state — only the clicked card spins
    if (style === 'pixar') {
      setIsGeneratingPixar(true);
      setPixarPreviewUrl(null);
    } else {
      setIsGeneratingClassic(true);
      setClassicPreviewUrl(null);
    }
    setPreviewStatus('generating');
    setPreviewError(null);
    setDescriptionChanged(false);

    try {
      const requestBody = characterMode === 'photo'
        ? {
            name: name.trim(),
            referenceImageUrl: uploadedImageUrl,
            imageProvider,
            medium: detectedMedium,
            style,
            description: {
              hairColor,
              skinTone,
              age,
              otherFeatures,
            },
          }
        : {
            name: name.trim(),
            characterType: characterType.trim(),
            imageProvider,
            // medium is irrelevant for description-only (no reference image)
            style,
            description: {
              hairColor,
              age,
              otherFeatures,
            },
          };

      const response = await fetch('/api/generate-character-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      const data = await response.json();
      console.log(`Preview generated (${style}, provider=${data.provider}, medium=${data.medium}):`, data);

      // Set the requested style's URL only; the other stays as-is
      if (style === 'pixar' && data.previews?.pixar) {
        setPixarPreviewUrl(data.previews.pixar.imageUrl);
        setSelectedStyle('pixar');
      }
      if (style === 'classic' && data.previews?.classic) {
        setClassicPreviewUrl(data.previews.classic.imageUrl);
        setSelectedStyle('classic');
      }

      setPreviewStatus('ready');
    } catch (err) {
      console.error('Preview generation error:', err);
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate preview');
      setPreviewStatus('error');
    } finally {
      if (style === 'pixar') setIsGeneratingPixar(false);
      else setIsGeneratingClassic(false);
    }
  }, [characterMode, uploadedImageUrl, name, characterType, hairColor, skinTone, age, otherFeatures, imageProvider, detectedMedium]);

  // Track description changes
  const handleDescriptionChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    if (previewStatus === 'ready') {
      setDescriptionChanged(true);
      setIsApproved(false);
    }
  };

  // Generate sketch guide for "From Description" mode
  const generateSketchGuide = async () => {
    if (!name.trim() || !characterType.trim()) {
      setSketchError('Please provide a name and character type first');
      return;
    }

    setIsGeneratingSketch(true);
    setSketchError(null);

    try {
      const response = await fetch('/api/characters/sketch-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character_name: name.trim(),
          character_type: characterType.trim(),
          additional_details: otherFeatures || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate drawing guide');
      }

      const data = await response.json();

      if (data.success) {
        setSketchGuideData(data.data);
        setViewMode('sketch-preview');
      } else {
        throw new Error(data.error?.message || 'Failed to generate drawing guide');
      }
    } catch (err) {
      console.error('Sketch guide generation error:', err);
      setSketchError(err instanceof Error ? err.message : 'Failed to generate drawing guide');
    } finally {
      setIsGeneratingSketch(false);
    }
  };

  // Get the currently selected preview URL
  const getSelectedPreviewUrl = () => {
    return selectedStyle === 'pixar' ? pixarPreviewUrl : classicPreviewUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation - need approved preview
    if (!isApproved) {
      setError('Please approve the animated preview before saving');
      return;
    }

    // Validation for description-only mode
    if (characterMode === 'description' && !characterType.trim()) {
      setError('Please provide a character type (e.g., baby eagle, friendly dragon)');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in to create a character');
        setLoading(false);
        return;
      }

      let imageUrl = uploadedImageUrl;
      let imageFilename = imageFile?.name || null;

      // If image wasn't auto-analyzed (edge case), upload it now
      if (characterMode === 'photo' && imageFile && !uploadedImageUrl) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('character-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          setError(`Failed to upload image: ${uploadError.message}`);
          setLoading(false);
          return;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('character-images')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
        imageFilename = imageFile.name;
      }

      // Get the selected preview URL
      const selectedPreviewUrl = getSelectedPreviewUrl();

      // Upload animated preview to storage (convert from data URL to blob)
      let animatedUrl = selectedPreviewUrl;
      if (selectedPreviewUrl && selectedPreviewUrl.startsWith('data:')) {
        try {
          const response = await fetch(selectedPreviewUrl);
          const blob = await response.blob();
          const previewFileName = `${user.id}/preview-${Date.now()}.png`;

          const { error: previewUploadError } = await supabase.storage
            .from('character-images')
            .upload(previewFileName, blob, {
              contentType: 'image/png',
            });

          if (!previewUploadError) {
            const { data: previewUrlData } = supabase.storage
              .from('character-images')
              .getPublicUrl(previewFileName);
            animatedUrl = previewUrlData.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Failed to upload animated preview, saving without it:', uploadErr);
        }
      }

      // Build description for description-only mode
      const fullDescription = characterMode === 'description'
        ? `${characterType}${otherFeatures ? ` - ${otherFeatures}` : ''}`
        : undefined;

      // Create character via API
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          hair_color: hairColor || undefined,
          skin_tone: skinTone || undefined,
          clothing: clothing || undefined,
          age: age || undefined,
          other_features: characterMode === 'description' ? fullDescription : (otherFeatures || undefined),
          reference_image_url: imageUrl || undefined,
          reference_image_filename: imageFilename || undefined,
          animated_preview_url: animatedUrl,
          illustration_style: selectedStyle, // Save the selected style preference
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create character');
        setLoading(false);
        return;
      }

      // Success - redirect to character library
      router.push('/characters');
      router.refresh();
    } catch (err) {
      console.error('Error creating character:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  // Reset form when switching modes
  const handleModeChange = (mode: CharacterMode) => {
    setCharacterMode(mode);
    setImageFile(null);
    setImagePreview(null);
    setUploadedImageUrl(null);
    setPixarPreviewUrl(null);
    setClassicPreviewUrl(null);
    setPreviewStatus('idle');
    setIsApproved(false);
    setHairColor('');
    setSkinTone('');
    setClothing('');
    setAge('');
    setOtherFeatures('');
    setCharacterType('');
    setError(null);
  };

  // Show sketch guide viewer
  if (viewMode === 'sketch-guide' && sketchGuideData) {
    return (
      <SketchGuideViewer
        sketch_preview_url={sketchGuideData.sketch_preview_url}
        steps={sketchGuideData.steps}
        character_description={sketchGuideData.character_description}
        onBack={() => {
          setViewMode('sketch-preview');
        }}
        onCreateCharacter={() => {
          // Go back to create form and trigger regular character generation
          // (defaults to 3D Pixar — user can also generate the 2D Classic from the preview cards)
          setViewMode('create');
          generatePreview('pixar');
        }}
      />
    );
  }

  // Show sketch preview (choice between guide or full character)
  if (viewMode === 'sketch-preview' && sketchGuideData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sketch Preview</h1>
          <p className="mt-2 text-gray-600">
            Here&apos;s what {name} looks like! Choose what to do next.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Sketch preview image */}
          <div className="mb-6">
            <div className="flex justify-center">
              <img
                src={sketchGuideData.sketch_preview_url}
                alt={`Sketch of ${name}`}
                className="max-w-md w-full h-auto rounded-lg border-4 border-gray-200"
              />
            </div>
            <p className="text-center text-gray-600 mt-4 text-lg">
              {sketchGuideData.character_description}
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setViewMode('sketch-guide')}
              className="min-h-[44px] p-6 border-4 border-purple-500 bg-purple-50 text-purple-900 rounded-lg hover:bg-purple-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">Show Drawing Guide</div>
                  <div className="text-sm text-purple-700">
                    Learn to draw this step-by-step
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setViewMode('create');
                generatePreview('pixar');
              }}
              className="min-h-[44px] p-6 border-4 border-blue-500 bg-blue-50 text-blue-900 rounded-lg hover:bg-blue-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">Create Character</div>
                  <div className="text-sm text-blue-700">
                    Generate full animated version
                  </div>
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={() => {
              setViewMode('create');
              setSketchGuideData(null);
            }}
            className="mt-6 w-full text-gray-600 hover:text-gray-900 underline"
          >
            Back to form
          </button>
        </div>
      </div>
    );
  }

  // Main character creation form
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Character</h1>
        <p className="mt-2 text-gray-600">
          Add a character to your library to use in multiple stories
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Character Mode Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Character Type</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleModeChange('photo')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                characterMode === 'photo'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  characterMode === 'photo' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">From Photo</div>
                  <div className="text-sm text-gray-500">Upload a photo to create animated version</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('description')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                characterMode === 'description'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  characterMode === 'description' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">From Description</div>
                  <div className="text-sm text-gray-500">Generate animals, creatures, or fantasy characters</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Character Name */}
        <div className="bg-white rounded-lg shadow p-6">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Character Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={characterMode === 'photo' ? 'e.g., Connor' : 'e.g., Eddie the Eagle'}
          />
        </div>

        {/* Character Type (Description mode only) */}
        {characterMode === 'description' && (
          <div className="bg-white rounded-lg shadow p-6">
            <label htmlFor="characterType" className="block text-sm font-medium text-gray-700 mb-1">
              Character Type <span className="text-red-500">*</span>
            </label>
            <input
              id="characterType"
              type="text"
              value={characterType}
              onChange={(e) => {
                setCharacterType(e.target.value);
                if (previewStatus === 'ready') {
                  setDescriptionChanged(true);
                  setIsApproved(false);
                }
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g., baby eagle, friendly dragon, talking cat, wise owl"
            />
            <p className="mt-2 text-sm text-gray-500">
              Describe what kind of character this is. Examples: &quot;baby eagle with fluffy feathers&quot;, &quot;friendly red dragon&quot;, &quot;curious bunny rabbit&quot;
            </p>
          </div>
        )}

        {/* Photo Upload Section (Photo mode only) */}
        {characterMode === 'photo' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Reference Photo
              {isAnalyzing && (
                <span className="ml-2 text-sm text-purple-600 font-normal">
                  AI analyzing...
                </span>
              )}
            </h2>

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Reference photo"
                  className="w-full max-w-md h-64 object-contain rounded-lg bg-gray-50 border border-gray-200 mx-auto"
                />
                {isAnalyzing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
                      <span className="text-sm text-purple-600 font-medium">AI analyzing photo...</span>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setUploadedImageUrl(null);
                    setPixarPreviewUrl(null);
                    setClassicPreviewUrl(null);
                    setPreviewStatus('idle');
                    setIsApproved(false);
                  }}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                  disabled={isAnalyzing}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center">
                  <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-600">Click to upload a photo</span>
                  <span className="text-xs text-gray-500 mt-1">JPG, PNG, HEIC, GIF, or WebP (max 10MB)</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Preview Section — independent 2D / 3D generation */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-2 gap-4 flex-wrap">
            <h2 className="text-lg font-medium text-gray-900">
              Animated Preview
            </h2>

            {/* Admin-only image model toggle. Hidden for non-admins. */}
            {isAdmin && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">🛠 Image model (admin):</span>
                <select
                  value={imageProvider}
                  onChange={(e) => setImageProvider(e.target.value as ImageProvider)}
                  className="border border-gray-300 rounded pl-2 pr-7 py-1 text-sm bg-white min-w-[160px]"
                >
                  {VISIBLE_IMAGE_PROVIDER_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.value === 'flux'}
                    >
                      {opt.label}{opt.isNew ? ' ✨' : ''}{opt.value === 'flux' ? ' (stories only)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Inline link to demoted Sketch / Drawing Guide (description-only mode) */}
          {characterMode === 'description' && (
            <div className="mb-4">
              <button
                type="button"
                onClick={generateSketchGuide}
                disabled={!name.trim() || !characterType.trim() || isGeneratingSketch}
                className="text-sm text-purple-600 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed disabled:no-underline"
              >
                📝 Want a step-by-step drawing guide instead? {isGeneratingSketch ? '(generating…)' : ''}
              </button>
              {sketchError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                  {sketchError}
                </div>
              )}
            </div>
          )}

          {/* Detected medium hint + override (photo mode only, when kid_creation detected) */}
          {characterMode === 'photo' && uploadedImageUrl && detectedMedium === 'kid_creation' && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 flex items-center gap-2 flex-wrap">
              <span>🎨 Detected as a kid&apos;s creation — using a faithfulness-first prompt to preserve your drawing.</span>
              <button
                type="button"
                onClick={() => setDetectedMedium('real_photo')}
                className="ml-auto underline hover:text-amber-900"
              >
                Wrong? It&apos;s a real photo
              </button>
            </div>
          )}
          {characterMode === 'photo' && uploadedImageUrl && detectedMedium === 'real_photo' && (
            <div className="mb-4 text-xs text-gray-500">
              <button
                type="button"
                onClick={() => setDetectedMedium('kid_creation')}
                className="underline hover:text-gray-700"
              >
                This is a kid&apos;s drawing/craft, not a photo
              </button>
            </div>
          )}

          {/* Empty hint when nothing yet (photo mode without upload) */}
          {characterMode === 'photo' && !uploadedImageUrl && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Upload a photo above, then choose 2D or 3D below</p>
            </div>
          )}

          {/* Two independent style cards — only the clicked one fires an API call */}
          {(characterMode === 'description' || uploadedImageUrl) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 2D Classic card */}
              {(() => {
                const canGenerate = characterMode === 'photo'
                  ? !!uploadedImageUrl && !!name.trim()
                  : !!name.trim() && !!characterType.trim();
                const isSelected = selectedStyle === 'classic' && !!classicPreviewUrl;
                return (
                  <div
                    onClick={() => classicPreviewUrl && setSelectedStyle('classic')}
                    className={`relative border-2 rounded-lg overflow-hidden transition-all ${
                      isSelected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-dashed border-gray-300'
                    } ${classicPreviewUrl ? 'cursor-pointer' : ''}`}
                  >
                    <div className="text-center text-sm font-medium text-amber-600 py-2 bg-amber-50">
                      2D Classic Style
                    </div>
                    <div className="aspect-square bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center relative">
                      {isGeneratingClassic ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                          <p className="text-sm text-amber-700">Generating 2D…</p>
                        </div>
                      ) : classicPreviewUrl ? (
                        <img src={classicPreviewUrl} alt="2D Classic preview" className="w-full h-full object-contain" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); generatePreview('classic'); }}
                          disabled={!canGenerate || isGeneratingPixar}
                          className="px-4 py-3 text-amber-700 font-medium hover:text-amber-900 disabled:opacity-40 disabled:cursor-not-allowed text-center"
                        >
                          ✨<br />Click to Generate
                        </button>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {classicPreviewUrl && !isGeneratingClassic && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); generatePreview('classic'); }}
                        className="w-full py-2 text-xs text-amber-600 hover:bg-amber-50 border-t border-amber-100"
                      >
                        🔄 Regenerate
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* 3D Pixar card */}
              {(() => {
                const canGenerate = characterMode === 'photo'
                  ? !!uploadedImageUrl && !!name.trim()
                  : !!name.trim() && !!characterType.trim();
                const isSelected = selectedStyle === 'pixar' && !!pixarPreviewUrl;
                return (
                  <div
                    onClick={() => pixarPreviewUrl && setSelectedStyle('pixar')}
                    className={`relative border-2 rounded-lg overflow-hidden transition-all ${
                      isSelected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-dashed border-gray-300'
                    } ${pixarPreviewUrl ? 'cursor-pointer' : ''}`}
                  >
                    <div className="text-center text-sm font-medium text-purple-600 py-2 bg-purple-50">
                      3D Pixar Style
                    </div>
                    <div className="aspect-square bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center relative">
                      {isGeneratingPixar ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                          <p className="text-sm text-purple-700">Generating 3D…</p>
                        </div>
                      ) : pixarPreviewUrl ? (
                        <img src={pixarPreviewUrl} alt="3D Pixar preview" className="w-full h-full object-contain" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); generatePreview('pixar'); }}
                          disabled={!canGenerate || isGeneratingClassic}
                          className="px-4 py-3 text-purple-700 font-medium hover:text-purple-900 disabled:opacity-40 disabled:cursor-not-allowed text-center"
                        >
                          ✨<br />Click to Generate
                        </button>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {pixarPreviewUrl && !isGeneratingPixar && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); generatePreview('pixar'); }}
                        className="w-full py-2 text-xs text-purple-600 hover:bg-purple-50 border-t border-purple-100"
                      >
                        🔄 Regenerate
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Approve / status bar (only when at least one style is ready) */}
          {(pixarPreviewUrl || classicPreviewUrl) && (
            <div className="mt-4 flex gap-3">
              {!isApproved ? (
                <button
                  type="button"
                  onClick={() => setIsApproved(true)}
                  disabled={!pixarPreviewUrl && !classicPreviewUrl}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve {selectedStyle === 'pixar' ? '3D Pixar' : '2D Classic'} Style
                </button>
              ) : descriptionChanged ? (
                <div className="w-full text-center py-3 bg-yellow-50 rounded-lg text-yellow-700 text-sm">
                  Description changed — regenerate the style above to refresh
                </div>
              ) : (
                <div className="w-full text-center py-3 bg-green-50 rounded-lg">
                  <p className="text-green-600 font-medium flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {selectedStyle === 'pixar' ? '3D Pixar' : '2D Classic'} style approved! Ready to save.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {previewStatus === 'error' && previewError && (
            <div className="mt-4 text-center py-4 px-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{previewError}</p>
            </div>
          )}
        </div>

        {/* Description Fields (Photo mode) */}
        {characterMode === 'photo' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Character Description
              <span className="text-sm font-normal text-gray-500 ml-2">
                (Auto-filled from photo analysis)
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="hairColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Hair Color
                </label>
                <input
                  id="hairColor"
                  type="text"
                  value={hairColor}
                  onChange={handleDescriptionChange(setHairColor)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Brown, Blonde"
                />
              </div>

              <div>
                <label htmlFor="skinTone" className="block text-sm font-medium text-gray-700 mb-1">
                  Skin Tone
                </label>
                <input
                  id="skinTone"
                  type="text"
                  value={skinTone}
                  onChange={handleDescriptionChange(setSkinTone)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Fair, Tan"
                />
              </div>

              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  id="age"
                  type="text"
                  value={age}
                  onChange={handleDescriptionChange(setAge)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 5 years old, Child"
                />
              </div>

              <div>
                <label htmlFor="clothing" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Clothing
                </label>
                <input
                  id="clothing"
                  type="text"
                  value={clothing}
                  onChange={handleDescriptionChange(setClothing)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Blue t-shirt and jeans"
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="otherFeatures" className="block text-sm font-medium text-gray-700 mb-1">
                Other Features
              </label>
              <textarea
                id="otherFeatures"
                value={otherFeatures}
                onChange={handleDescriptionChange(setOtherFeatures)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Big smile, freckles, glasses"
              />
            </div>
          </div>
        )}

        {/* Additional Description (Description mode) */}
        {characterMode === 'description' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Additional Details
              <span className="text-sm font-normal text-gray-500 ml-2">
                (Optional - helps refine the character)
              </span>
            </h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="otherFeatures" className="block text-sm font-medium text-gray-700 mb-1">
                  Character Details
                </label>
                <textarea
                  id="otherFeatures"
                  value={otherFeatures}
                  onChange={handleDescriptionChange(setOtherFeatures)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., fluffy golden feathers, big curious eyes, wearing a tiny red scarf"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Add any specific features, colors, or accessories for your character
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !isApproved}
            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Saving...' : isApproved ? 'Save Character' : 'Approve Preview First'}
          </button>
        </div>
      </form>
    </div>
  );
}
