'use client';

import { useState, useRef, useCallback, DragEvent } from 'react';

interface ScanScriptButtonProps {
  onInsert: (text: string) => void;
  disabled?: boolean;
}

type ScanStep = 'idle' | 'upload' | 'scanning' | 'preview' | 'error';

export default function ScanScriptButton({ onInsert, disabled }: ScanScriptButtonProps) {
  const [step, setStep] = useState<ScanStep>('idle');
  const [extractedText, setExtractedText] = useState('');
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('high');
  const [errorMessage, setErrorMessage] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setExtractedText('');
    setErrorMessage('');
    setPreviewImage(null);
    setConfidence('high');
    setIsDragOver(false);
  }, []);

  const handleFileSelected = useCallback(async (file: File) => {
    // Client-side validation
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage('Image too large. Maximum 10MB.');
      setStep('error');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Unsupported format. Use JPEG, PNG, or WebP.');
      setStep('error');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewImage(e.target?.result as string);
    reader.readAsDataURL(file);

    setStep('scanning');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('mode', 'freeform');

      const response = await fetch('/api/v1/stories/scan-script', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to scan image');
      }

      const { data } = result;
      if (!data.extractedText || data.scenes.length === 0) {
        setErrorMessage('Could not read any text from the image. Try a clearer photo.');
        setStep('error');
        return;
      }

      setExtractedText(data.extractedText);
      setConfidence(data.confidence);
      setStep('preview');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      setStep('error');
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [handleFileSelected]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }, [handleFileSelected]);

  const handleInsert = useCallback(() => {
    onInsert(extractedText);
    reset();
  }, [extractedText, onInsert, reset]);

  return (
    <>
      {/* Hidden file input — no `capture` so mobile shows "Photo Library / Take Photo / Browse" picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setStep('upload')}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
          border transition-all
          ${!disabled
            ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300 hover:shadow-sm'
            : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
          }
        `}
        title="Scan handwritten script from photo"
        aria-label="Scan handwritten script"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Scan Script
      </button>

      {/* Upload modal with drag-and-drop zone */}
      {step === 'upload' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Scan Handwritten Script</h2>
              <button
                onClick={reset}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drop zone */}
            <div className="p-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed
                  cursor-pointer transition-all
                  ${isDragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50'
                  }
                `}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Upload image of handwritten script"
              >
                {/* Camera icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                  isDragOver ? 'bg-blue-100' : 'bg-gray-200'
                }`}>
                  <svg className={`w-6 h-6 ${isDragOver ? 'text-blue-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  {isDragOver ? 'Drop image here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, WebP up to 10MB
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Paper, napkin, worksheet, or notebook
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanning overlay */}
      {step === 'scanning' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-900" aria-live="polite">
              Reading handwriting...
            </p>
            <p className="text-xs text-gray-500 mt-1">This usually takes a few seconds</p>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {step === 'preview' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">Scanned Text</h2>
                {confidence !== 'high' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    confidence === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {confidence} confidence
                  </span>
                )}
              </div>
              <button
                onClick={reset}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Original image thumbnail */}
              {previewImage && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Original Image</p>
                  <img
                    src={previewImage}
                    alt="Uploaded handwritten script"
                    className="max-h-40 rounded-lg border border-gray-200 object-contain"
                  />
                </div>
              )}

              {/* Extracted text */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Extracted Scenes ({extractedText.split('\n').filter(l => l.trim()).length} found)
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                    {extractedText}
                  </pre>
                </div>
              </div>

              {confidence === 'medium' && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  Some words were hard to read. Please review and correct any mistakes after inserting.
                </p>
              )}
              {confidence === 'low' && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  The handwriting was difficult to read. The text may contain errors — please review carefully.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleInsert}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all"
              >
                Insert Scenes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error modal */}
      {step === 'error' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Scan Failed</p>
                <p className="text-xs text-gray-500 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end mt-4" role="alert">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
              >
                Close
              </button>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
