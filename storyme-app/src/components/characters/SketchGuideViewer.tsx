'use client';

/**
 * Sketch Guide Viewer Component
 *
 * Displays AI-generated step-by-step drawing guide for kids.
 *
 * Features:
 * - Kid-friendly UI with large step numbers
 * - Print-optimized layout (browser native print)
 * - Shows preview + 3-6 steps
 * - Sketch-style black & white images
 *
 * Follows Principle 8: Responsive & Accessible UI
 */

import React from 'react';
import { Printer, ArrowLeft } from 'lucide-react';

export interface SketchStep {
  step_number: number;
  title: string;
  description: string;
}

export interface SketchGuideViewerProps {
  guide_image_url: string;
  steps: SketchStep[];
  character_description: string;
  onBack: () => void;
  onCreateCharacter?: () => void;
}

export function SketchGuideViewer({
  guide_image_url,
  steps,
  character_description,
  onBack,
  onCreateCharacter,
}: SketchGuideViewerProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="sketch-guide-container">
      {/* Header (hidden on print) */}
      <div className="print:hidden mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          aria-label="Go back"
        >
          <ArrowLeft className="mr-2 h-4 w-4 inline" />
          Back
        </button>

        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            aria-label="Print drawing guide"
          >
            <Printer className="mr-2 h-4 w-4 inline" />
            Print Guide
          </button>

          {onCreateCharacter && (
            <button
              onClick={onCreateCharacter}
              className="min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Character
            </button>
          )}
        </div>
      </div>

      {/* Print-friendly content */}
      <div className="sketch-guide-content">
        {/* Title */}
        <h1 className="text-2xl font-bold mb-6 text-center print:text-3xl">
          How to Draw {character_description}
        </h1>

        {/* Main Drawing Guide Image */}
        <div className="max-w-4xl mx-auto">
          <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
            <img
              src={guide_image_url}
              alt={`Step-by-step guide for drawing ${character_description}`}
              className="w-full h-auto"
            />
          </div>

          {/* Optional: Show step descriptions below image */}
          {steps && steps.length > 0 && (
            <div className="mt-6 space-y-2 text-sm text-gray-700">
              <h2 className="font-semibold text-base mb-3">Steps:</h2>
              {steps.map((step) => (
                <div key={step.step_number} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {step.step_number}
                  </span>
                  <div>
                    <span className="font-semibold">{step.title}:</span>{' '}
                    <span>{step.description}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer (print only) */}
        <div className="hidden print:block mt-12 text-center text-gray-600">
          <p className="text-lg">
            Created with ❤️ by KindleWood Studio
          </p>
          <p className="text-sm mt-2">
            www.kindlewoodstudio.ai
          </p>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except sketch guide */
          body > *:not(.sketch-guide-container) {
            display: none !important;
          }

          /* Reset page margins */
          @page {
            margin: 1.5cm;
            size: letter portrait;
          }

          /* Ensure content fits on page */
          .sketch-guide-content {
            max-width: 100%;
            font-size: 12pt;
          }

          /* High contrast for printing */
          .sketch-guide-content {
            color: #000 !important;
            background: #fff !important;
          }

          /* Prevent page breaks inside steps */
          .step-item {
            page-break-inside: avoid;
          }

          /* Add page break before preview if needed */
          .sketch-guide-content > div:first-child {
            page-break-after: avoid;
          }

          /* Hide interactive elements */
          button,
          .print\\:hidden {
            display: none !important;
          }

          /* Ensure images print properly */
          img {
            max-width: 100%;
            height: auto;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Loading state component for sketch generation
 */
export function SketchGuideLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600" />
      <h3 className="text-xl font-semibold">Generating Your Drawing Guide...</h3>
      <p className="text-gray-600 text-center max-w-md">
        Our AI is creating a step-by-step guide just for you. This takes about 30-60 seconds.
      </p>
    </div>
  );
}

/**
 * Error state component
 */
export interface SketchGuideErrorProps {
  error: string;
  onRetry: () => void;
  onBack: () => void;
}

export function SketchGuideError({ error, onRetry, onBack }: SketchGuideErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="text-red-500 text-6xl">⚠️</div>
      <h3 className="text-xl font-semibold text-red-600">
        Oops! Something Went Wrong
      </h3>
      <p className="text-gray-600 text-center max-w-md">
        {error}
      </p>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4 inline" />
          Go Back
        </button>
        <button
          onClick={onRetry}
          className="min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
