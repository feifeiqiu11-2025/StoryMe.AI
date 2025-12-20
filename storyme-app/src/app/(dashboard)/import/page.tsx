/**
 * PDF Import Page
 * Allows users to upload PDF storybooks and convert them into interactive stories with audio
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PDFImportReview from '@/components/import/PDFImportReview';

// Types for extracted PDF content
export interface ExtractedPage {
  pageNumber: number;
  imageBase64: string; // Base64 image data (without data URL prefix)
  captionEnglish: string;
  captionChinese?: string;
  isScenePage: boolean; // true for story scenes, false for cover/credits
  pageType: 'cover' | 'scene' | 'credits' | 'other';
}

export interface PDFExtractionResult {
  title: string;
  totalPages: number;
  pages: ExtractedPage[];
  extractionTime: number;
}

type ImportStep = 'upload' | 'extracting' | 'review' | 'translating' | 'finalizing';

export default function ImportPage() {
  const router = useRouter();

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [extractionResult, setExtractionResult] = useState<PDFExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  // File validation
  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Please upload a PDF file';
    }
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return 'File size must be less than 50MB';
    }
    return null;
  };

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(droppedFile);
      setError(null);
    }
  }, []);

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  // Load PDF.js from CDN (avoids Next.js bundling issues)
  const loadPdfJs = async (): Promise<typeof import('pdfjs-dist')> => {
    // Check if already loaded
    if ((window as any).pdfjsLib) {
      return (window as any).pdfjsLib;
    }

    // Load PDF.js from CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
      script.type = 'module';

      // For module scripts, we need to use a different approach
      // Load the legacy build instead which works better with dynamic loading
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.type = 'text/javascript';

      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        if (pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(pdfjsLib);
        } else {
          reject(new Error('PDF.js failed to load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));

      document.head.appendChild(script);
    });
  };

  // Render PDF pages to images using PDF.js (client-side)
  const renderPDFPages = async (pdfFile: File): Promise<{ pageNumber: number; imageBase64: string }[]> => {
    // Load PDF.js from CDN
    const pdfjsLib = await loadPdfJs();

    // Read file as ArrayBuffer
    const arrayBuffer = await pdfFile.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const totalPages = Math.min(pdf.numPages, 30); // Max 30 pages
    const pages: { pageNumber: number; imageBase64: string }[] = [];

    // Render each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      setProgressMessage(`Rendering page ${pageNum} of ${totalPages}...`);
      setProgress(Math.round((pageNum / totalPages) * 30)); // 0-30% for rendering

      const page = await pdf.getPage(pageNum);
      const scale = 2; // Good quality for AI vision
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Failed to get canvas context');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Convert to base64 (without data URL prefix)
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];

      pages.push({
        pageNumber: pageNum,
        imageBase64: base64,
      });

      // Cleanup
      canvas.remove();
    }

    return pages;
  };

  // Start extraction process
  const handleExtract = async () => {
    if (!file) return;

    setStep('extracting');
    setError(null);
    setProgress(0);
    setProgressMessage('Preparing PDF...');

    try {
      // Step 1: Render PDF pages to images (client-side)
      const pageImages = await renderPDFPages(file);

      setProgress(35);
      setProgressMessage(`Analyzing ${pageImages.length} pages with AI...`);

      // Step 2: Send page images to extraction API
      const response = await fetch('/api/import-pdf/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageImages,
          fileName: file.name,
        }),
      });

      setProgress(85);
      setProgressMessage('Processing extracted content...');

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract PDF content');
      }

      // Transform result to match component interface
      // The API returns imageBase64, but the component expects imageBase64 (same field)
      const transformedResult: PDFExtractionResult = {
        ...data.result,
        pages: data.result.pages.map((page: ExtractedPage & { imageBase64?: string }) => ({
          ...page,
          // Keep imageBase64 for storage, but no imageUrl needed for review component
        })),
      };

      setProgress(100);
      setExtractionResult(transformedResult);
      setStep('review');

    } catch (err) {
      console.error('PDF extraction error:', err);
      setError(err instanceof Error ? err.message : 'Failed to extract PDF. Please try again.');
      setStep('upload');
    }
  };

  // Handle page updates from review component
  const handlePagesUpdate = (updatedPages: ExtractedPage[]) => {
    if (extractionResult) {
      setExtractionResult({
        ...extractionResult,
        pages: updatedPages,
      });
    }
  };

  // Handle title update
  const handleTitleUpdate = (newTitle: string) => {
    if (extractionResult) {
      setExtractionResult({
        ...extractionResult,
        title: newTitle,
      });
    }
  };

  // Handle translation
  const handleTranslate = async () => {
    if (!extractionResult) return;

    setStep('translating');
    setProgress(0);
    setProgressMessage('Translating captions to Chinese...');

    try {
      const pagesToTranslate = extractionResult.pages
        .filter(p => p.isScenePage && p.captionEnglish && !p.captionChinese);

      if (pagesToTranslate.length === 0) {
        // All pages already have translations
        setStep('review');
        return;
      }

      const response = await fetch('/api/import-pdf/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pagesToTranslate.map(p => ({
            pageNumber: p.pageNumber,
            captionEnglish: p.captionEnglish,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to translate captions');
      }

      // Update pages with translations
      const translationMap = new Map<number, string>(
        data.translations.map((t: { pageNumber: number; captionChinese: string }) =>
          [t.pageNumber, t.captionChinese] as [number, string]
        )
      );

      const updatedPages: ExtractedPage[] = extractionResult.pages.map(page => ({
        ...page,
        captionChinese: translationMap.get(page.pageNumber) || page.captionChinese,
      }));

      setExtractionResult({
        ...extractionResult,
        pages: updatedPages,
      });

      setStep('review');

    } catch (err) {
      console.error('Translation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to translate. Please try again.');
      setStep('review');
    }
  };

  // Handle finalization - create the project
  const handleFinalize = async () => {
    if (!extractionResult) return;

    setStep('finalizing');
    setProgress(0);
    setProgressMessage('Creating your storybook...');

    try {
      const response = await fetch('/api/import-pdf/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: extractionResult.title,
          pages: extractionResult.pages.filter(p => p.isScenePage),
          originalFilename: file?.name,
        }),
      });

      setProgress(50);
      setProgressMessage('Saving scenes and images...');

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create storybook');
      }

      setProgress(100);
      setProgressMessage('Success! Redirecting...');

      // Redirect to the project page
      router.push(`/projects/${data.projectId}`);

    } catch (err) {
      console.error('Finalization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create storybook. Please try again.');
      setStep('review');
    }
  };

  // Render upload step
  const renderUploadStep = () => (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl mb-4">
          <span className="text-4xl">📄</span>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Convert PDF to Storybook
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Upload a PDF storybook from NotebookLM, Gemini, Canva, or any other tool and convert it into an interactive story with bilingual audio.
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {file ? (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-700">
                Drop your PDF here or click to browse
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Maximum file size: 50MB • Maximum pages: 30
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Action Button */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={handleExtract}
          disabled={!file}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
        >
          <span>Extract & Analyze</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
        <p className="text-sm text-yellow-800">
          <span className="font-semibold">⚠️ Copyright Notice:</span> Please only upload PDFs that you have the right to use.
          By uploading, you confirm that you own the content or have permission to convert it.
        </p>
      </div>

      {/* Supported Sources */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">Supported Sources</h3>
        <div className="flex justify-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <span className="text-lg">📓</span> NotebookLM
          </span>
          <span className="flex items-center gap-1">
            <span className="text-lg">✨</span> Gemini
          </span>
          <span className="flex items-center gap-1">
            <span className="text-lg">🎨</span> Canva
          </span>
          <span className="flex items-center gap-1">
            <span className="text-lg">📑</span> Any PDF
          </span>
        </div>
      </div>
    </div>
  );

  // Render extraction progress
  const renderExtractingStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl mb-6">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Extracting Content</h2>
      <p className="text-gray-600 mb-6">{progressMessage}</p>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-2">{progress}%</p>

      <p className="text-sm text-gray-500 mt-6">
        This may take 15-30 seconds depending on the PDF size.
      </p>
    </div>
  );

  // Render translation progress
  const renderTranslatingStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl mb-6">
        <span className="text-4xl">🌐</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Translating to Chinese</h2>
      <p className="text-gray-600 mb-6">{progressMessage}</p>

      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-purple-600 to-pink-600 animate-pulse w-full" />
      </div>
    </div>
  );

  // Render finalization progress
  const renderFinalizingStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-teal-100 rounded-2xl mb-6">
        <span className="text-4xl">📚</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Creating Your Storybook</h2>
      <p className="text-gray-600 mb-6">{progressMessage}</p>

      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-600 to-teal-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-2">{progress}%</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 'upload' && renderUploadStep()}
          {step === 'extracting' && renderExtractingStep()}
          {step === 'translating' && renderTranslatingStep()}
          {step === 'finalizing' && renderFinalizingStep()}
          {step === 'review' && extractionResult && (
            <PDFImportReview
              extractionResult={extractionResult}
              onPagesUpdate={handlePagesUpdate}
              onTitleUpdate={handleTitleUpdate}
              onTranslate={handleTranslate}
              onFinalize={handleFinalize}
              onBack={() => {
                setStep('upload');
                setExtractionResult(null);
                setFile(null);
              }}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
