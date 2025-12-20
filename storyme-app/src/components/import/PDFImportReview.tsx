/**
 * PDF Import Review Component
 *
 * Allows users to review and edit extracted PDF content before creating the project.
 * Simplified, compact design.
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';

// Types for extracted PDF content (must match import page)
interface ExtractedPage {
  pageNumber: number;
  imageBase64: string; // Base64 image data (without data URL prefix)
  captionEnglish: string;
  captionChinese?: string;
  isScenePage: boolean;
  pageType: 'cover' | 'scene' | 'credits' | 'other';
}

interface PDFExtractionResult {
  title: string;
  totalPages: number;
  pages: ExtractedPage[];
  extractionTime: number;
}

interface PDFImportReviewProps {
  extractionResult: PDFExtractionResult;
  onPagesUpdate: (pages: ExtractedPage[]) => void;
  onTitleUpdate: (title: string) => void;
  onTranslate: () => void;
  onFinalize: () => void;
  onBack: () => void;
  error?: string | null;
}

export default function PDFImportReview({
  extractionResult,
  onPagesUpdate,
  onTitleUpdate,
  onTranslate,
  onFinalize,
  onBack,
  error,
}: PDFImportReviewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(extractionResult.title);

  const scenePages = extractionResult.pages.filter(p => p.isScenePage);
  const hasChineseTranslations = scenePages.some(p => p.captionChinese);

  // Toggle page inclusion
  const togglePageInclusion = (pageNumber: number) => {
    const updatedPages = extractionResult.pages.map(page =>
      page.pageNumber === pageNumber
        ? { ...page, isScenePage: !page.isScenePage }
        : page
    );
    onPagesUpdate(updatedPages);
  };

  // Update caption
  const updateCaption = (pageNumber: number, field: 'captionEnglish' | 'captionChinese', value: string) => {
    const updatedPages = extractionResult.pages.map(page =>
      page.pageNumber === pageNumber
        ? { ...page, [field]: value }
        : page
    );
    onPagesUpdate(updatedPages);
  };

  // Save title
  const saveTitle = () => {
    if (titleInput.trim()) {
      onTitleUpdate(titleInput.trim());
    }
    setEditingTitle(false);
  };

  return (
    <div className="space-y-4">
      {/* Header - Compact */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-teal-100 rounded-lg flex items-center justify-center">
            <span className="text-xl">✅</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Review Extracted Content</h2>
            <p className="text-gray-500 text-xs">
              {extractionResult.totalPages} pages • {scenePages.length} scenes • {extractionResult.extractionTime.toFixed(1)}s
            </p>
          </div>
        </div>
      </div>

      {/* Title - Compact inline */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2">
        <span className="text-sm font-medium text-gray-500">Title:</span>
        {editingTitle ? (
          <div className="flex gap-2 flex-1">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            />
            <button onClick={saveTitle} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
              Save
            </button>
            <button onClick={() => setEditingTitle(false)} className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <span className="font-semibold text-gray-900 flex-1">{extractionResult.title}</span>
            <button
              onClick={() => setEditingTitle(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Edit
            </button>
          </>
        )}
      </div>

      {/* Page List */}
      <div className="space-y-3">
        {extractionResult.pages.map((page) => (
          <div
            key={page.pageNumber}
            className={`bg-white border rounded-xl overflow-hidden transition-all ${
              page.isScenePage
                ? 'border-green-300 shadow-sm'
                : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="flex">
              {/* Page Image */}
              <div className="w-40 h-28 relative flex-shrink-0 bg-gray-100">
                <Image
                  src={`data:image/png;base64,${page.imageBase64}`}
                  alt={`Page ${page.pageNumber}`}
                  fill
                  className="object-contain"
                />
                <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  {page.pageNumber}
                </div>
                <span className={`absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded font-medium ${
                  page.pageType === 'cover' ? 'bg-blue-500 text-white' :
                  page.pageType === 'scene' ? 'bg-green-500 text-white' :
                  page.pageType === 'credits' ? 'bg-gray-500 text-white' :
                  'bg-yellow-500 text-white'
                }`}>
                  {page.pageType}
                </span>
              </div>

              {/* Page Content */}
              <div className="flex-1 p-3">
                {/* Include Toggle */}
                <div className="flex items-center justify-end mb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <span className="text-gray-500">Include</span>
                    <button
                      onClick={() => togglePageInclusion(page.pageNumber)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        page.isScenePage ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          page.isScenePage ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>

                {/* Caption - English */}
                <textarea
                  value={page.captionEnglish}
                  onChange={(e) => updateCaption(page.pageNumber, 'captionEnglish', e.target.value)}
                  disabled={!page.isScenePage}
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="No caption..."
                />

                {/* Caption - Chinese (if available) */}
                {(page.captionChinese || hasChineseTranslations) && (
                  <textarea
                    value={page.captionChinese || ''}
                    onChange={(e) => updateCaption(page.pageNumber, 'captionChinese', e.target.value)}
                    disabled={!page.isScenePage}
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm border border-purple-200 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none disabled:bg-gray-50 disabled:text-gray-400 mt-2"
                    placeholder="中文翻译..."
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          ← Start Over
        </button>

        <div className="flex items-center gap-3">
          {/* Generate Chinese Caption - simple button */}
          {!hasChineseTranslations && scenePages.length > 0 && (
            <button
              onClick={onTranslate}
              className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 font-medium text-sm"
            >
              Generate Chinese Captions
            </button>
          )}

          {scenePages.length === 0 ? (
            <p className="text-amber-600 text-sm font-medium">
              Please include at least one scene
            </p>
          ) : (
            <button
              onClick={onFinalize}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 font-semibold shadow transition-all flex items-center gap-2"
            >
              Create Storybook ({scenePages.length})
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
