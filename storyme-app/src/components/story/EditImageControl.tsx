/**
 * Edit Image Control Component
 *
 * Reusable component for editing scene images and cover images.
 * Features:
 * - Auto-detects story characters mentioned in the edit instruction
 * - Supports manual reference image upload/paste
 * - Edit-as-proposal: shows comparison before committing changes
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ImageProvider, Character } from '@/lib/types/story';
import { detectCharactersInInstruction, DetectedCharacter } from '@/lib/utils/character-matcher';

interface EditImageControlProps {
  currentImageUrl: string;
  imageType: 'scene' | 'cover';
  imageId: string;
  onEditComplete: (newImageUrl: string) => void;
  buttonLabel?: string;
  /** Illustration style to maintain during edit (defaults to 'pixar') */
  illustrationStyle?: 'pixar' | 'classic' | 'coloring';
  /** Original scene description for context */
  sceneDescription?: string;
  /** Image provider for Gemini model selection */
  imageProvider?: ImageProvider;
  /** Story characters for auto-detection in edit instructions */
  characters?: Character[];
}

/** Resize an image file/blob to max dimension, returns base64 data URL */
function resizeImageToBase64(file: File | Blob, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement('img');
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function EditImageControl({
  currentImageUrl,
  imageType,
  imageId,
  onEditComplete,
  buttonLabel = 'Edit Image',
  illustrationStyle = 'pixar',
  sceneDescription,
  imageProvider,
  characters,
}: EditImageControlProps) {
  // Core state
  const [isExpanded, setIsExpanded] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Character detection state
  const [detectedCharacters, setDetectedCharacters] = useState<DetectedCharacter[]>([]);
  const [dismissedCharacterIds, setDismissedCharacterIds] = useState<Set<string>>(new Set());

  // Manual reference image state
  const [manualReferenceImage, setManualReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Proposal state
  const [proposedImageUrl, setProposedImageUrl] = useState<string | null>(null);
  const [lastInstruction, setLastInstruction] = useState('');

  // Auto-detect characters when instruction changes (debounced)
  useEffect(() => {
    if (!characters?.length || !instruction.trim()) {
      setDetectedCharacters([]);
      return;
    }

    const timer = setTimeout(() => {
      const detected = detectCharactersInInstruction(instruction, characters, dismissedCharacterIds);
      setDetectedCharacters(detected);
    }, 300);

    return () => clearTimeout(timer);
  }, [instruction, characters, dismissedCharacterIds]);

  const dismissCharacter = useCallback((characterId: string) => {
    setDismissedCharacterIds(prev => new Set(prev).add(characterId));
    setDetectedCharacters(prev => prev.filter(d => d.character.id !== characterId));
  }, []);

  // Handle file upload for manual reference
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    try {
      const base64 = await resizeImageToBase64(file);
      setManualReferenceImage(base64);
      setError(null);
    } catch {
      setError('Failed to process image');
    }
  }, []);

  // Handle paste event for manual reference
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await handleFileSelect(file);
        return;
      }
    }
  }, [handleFileSelect]);

  // Build character references for the API
  const buildCharacterReferences = useCallback(() => {
    if (detectedCharacters.length === 0) return undefined;
    return detectedCharacters.map(({ character }) => ({
      name: character.name,
      description: character.description?.fullDescription || undefined,
      referenceImageUrl: character.animatedPreviewUrl || character.referenceImage?.url || '',
    })).filter(ref => ref.referenceImageUrl);
  }, [detectedCharacters]);

  const handleEdit = async () => {
    if (!instruction.trim()) {
      setError('Please describe what you want to change');
      return;
    }

    if (instruction.trim().length < 5) {
      setError('Please provide more detail (at least 5 characters)');
      return;
    }

    setIsEditing(true);
    setError(null);

    try {
      const characterReferences = buildCharacterReferences();

      const response = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: currentImageUrl,
          instruction: instruction.trim(),
          imageType,
          imageId,
          illustrationStyle,
          sceneDescription,
          imageProvider,
          characterReferences,
          manualReferenceImageBase64: manualReferenceImage || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to edit image');
      }

      // Show as proposal instead of auto-replacing
      setProposedImageUrl(data.imageUrl);
      setLastInstruction(instruction);

      console.log(`Image edited successfully in ${data.generationTime}s (proposal mode)`);

    } catch (err) {
      console.error('Edit image error:', err);
      setError(err instanceof Error ? err.message : 'Failed to edit image. Please try again.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleAcceptProposal = () => {
    if (proposedImageUrl) {
      onEditComplete(proposedImageUrl);
    }
    resetAll();
  };

  const handleRejectProposal = () => {
    resetAll();
  };

  const handleEditAgain = () => {
    setProposedImageUrl(null);
    setInstruction(lastInstruction);
  };

  const resetAll = () => {
    setIsExpanded(false);
    setInstruction('');
    setError(null);
    setDetectedCharacters([]);
    setDismissedCharacterIds(new Set());
    setManualReferenceImage(null);
    setProposedImageUrl(null);
    setLastInstruction('');
  };

  const handleCancel = () => {
    resetAll();
  };

  // Collapsed state - just show button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors text-sm font-medium"
      >
        ✏️ {buttonLabel}
      </button>
    );
  }

  // Proposal state - show proposed image only (original is already visible in the gallery)
  if (proposedImageUrl) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 space-y-3 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-900">Proposed Edit</h4>

        <div className="relative w-80 h-80 rounded-lg overflow-hidden border-2 border-purple-300 bg-gray-100">
          <Image
            src={proposedImageUrl}
            alt="Proposed edit"
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={handleRejectProposal}
            className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium text-sm"
          >
            Keep Original
          </button>
          <button
            onClick={handleAcceptProposal}
            className="px-4 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-md hover:from-green-700 hover:to-emerald-700 transition-all font-medium text-sm"
          >
            Use This
          </button>
          <button
            onClick={handleEditAgain}
            className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium text-sm"
          >
            Edit Again
          </button>
        </div>
      </div>
    );
  }

  // Edit form state
  return (
    <div
      className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 space-y-2.5 shadow-sm"
      onPaste={handlePaste}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          What would you like to change?
        </h4>
        <button
          onClick={handleCancel}
          disabled={isEditing}
          className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Instruction Input */}
      <div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={isEditing}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
          placeholder="e.g., remove the cat in background, add a tree, change expression to happy..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Describe what to add, remove, or change in the image
        </p>
      </div>

      {/* Detected Characters */}
      {detectedCharacters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500">Detected:</span>
          {detectedCharacters.map(({ character }) => (
            <span
              key={character.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
            >
              {character.name}
              <button
                type="button"
                onClick={() => dismissCharacter(character.id)}
                className="text-purple-400 hover:text-purple-600 ml-0.5"
                aria-label={`Remove ${character.name}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Manual Reference Image */}
      <div className="flex items-center gap-2">
        {manualReferenceImage ? (
          <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 rounded border border-gray-300 overflow-hidden flex-shrink-0">
              <Image
                src={manualReferenceImage}
                alt="Reference"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <span className="text-xs text-gray-600">Reference added</span>
            <button
              type="button"
              onClick={() => setManualReferenceImage(null)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Remove reference image"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isEditing}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            + Add reference image
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = ''; // reset so same file can be re-selected
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2" role="alert">
          <p className="text-xs text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleEdit}
          disabled={isEditing || !instruction.trim()}
          className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
        >
          {isEditing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Applying...</span>
            </>
          ) : (
            <span>Apply Edit</span>
          )}
        </button>

        <button
          onClick={handleCancel}
          disabled={isEditing}
          className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Processing Status */}
      {isEditing && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
          <p className="text-xs text-blue-700">
            Editing image... This may take 5-15 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
