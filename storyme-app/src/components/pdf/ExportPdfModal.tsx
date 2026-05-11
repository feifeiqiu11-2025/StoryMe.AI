'use client';

import { useState } from 'react';
import type { PDFFormat, PDFLayout } from '@/lib/services/pdf.service';

interface ExportPdfModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: PDFFormat, layout: PDFLayout) => void;
  exporting: boolean;
  /**
   * 'picture_book' (default) shows the layout picker (1/2/4 scenes per
   * page). 'chapter_book' hides it because flowing-text books only have
   * one logical layout — the format selector still applies.
   */
  projectType?: 'picture_book' | 'chapter_book';
}

const layouts: { value: PDFLayout; label: string; description: string }[] = [
  { value: 'classic', label: 'Classic', description: '1 scene per page' },
  { value: 'comic', label: 'Comic Book', description: '2 scenes per page' },
  { value: 'grid', label: 'Grid', description: '4 scenes per page' },
];

// Picture books and chapter books offer different size options.
// Picture-book templates are tuned for a5/a4/large only — adding Letter
// here would require new templates. Chapter books render through the
// headless-Chromium pipeline, where any @page size works, so we lead
// with Letter (US default) for them.
const PICTURE_BOOK_FORMATS: { value: PDFFormat; label: string; description: string }[] = [
  { value: 'a5', label: 'A5', description: 'Compact' },
  { value: 'a4', label: 'A4', description: 'Standard' },
  { value: 'large', label: 'Legal', description: 'Large' },
];
const CHAPTER_BOOK_FORMATS: { value: PDFFormat; label: string; description: string }[] = [
  { value: 'letter', label: 'Letter', description: '8.5" × 11"' },
  { value: 'a4', label: 'A4', description: 'Standard' },
  { value: 'a5', label: 'A5', description: 'Compact' },
  { value: 'large', label: 'Legal', description: '7" × 8.5"' },
];

function LayoutIcon({ layout }: { layout: PDFLayout }) {
  const base = 'w-full h-full rounded border border-gray-300 bg-gray-50 p-1.5 flex';

  if (layout === 'classic') {
    return (
      <div className={`${base} flex-col gap-1`}>
        <div className="flex-1 bg-indigo-200 rounded-sm" />
        <div className="h-2.5 bg-gray-300 rounded-sm" />
      </div>
    );
  }

  if (layout === 'comic') {
    return (
      <div className={`${base} flex-col gap-0.5`}>
        {/* Top: image left, caption right */}
        <div className="flex-1 flex gap-0.5">
          <div className="flex-[65] bg-indigo-200 rounded-sm" />
          <div className="flex-[35] bg-gray-300 rounded-sm" />
        </div>
        {/* Bottom: caption left, image right (zigzag) */}
        <div className="flex-1 flex gap-0.5">
          <div className="flex-[35] bg-gray-300 rounded-sm" />
          <div className="flex-[65] bg-indigo-200 rounded-sm" />
        </div>
      </div>
    );
  }

  // grid
  return (
    <div className={`${base} flex-col gap-0.5`}>
      <div className="flex-1 flex gap-0.5">
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex-1 bg-indigo-200 rounded-sm" />
          <div className="h-1 bg-gray-300 rounded-sm" />
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex-1 bg-indigo-200 rounded-sm" />
          <div className="h-1 bg-gray-300 rounded-sm" />
        </div>
      </div>
      <div className="flex-1 flex gap-0.5">
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex-1 bg-indigo-200 rounded-sm" />
          <div className="h-1 bg-gray-300 rounded-sm" />
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex-1 bg-indigo-200 rounded-sm" />
          <div className="h-1 bg-gray-300 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

export default function ExportPdfModal({
  open, onClose, onExport, exporting, projectType = 'picture_book',
}: ExportPdfModalProps) {
  const isChapterBook = projectType === 'chapter_book';
  // Chapter books always pass 'classic' through to the picture-book layout
  // type — the chapter-book renderer ignores it. We just need a valid
  // value to satisfy the onExport signature.
  const [layout, setLayout] = useState<PDFLayout>(isChapterBook ? 'classic' : 'comic');
  // Letter is the kid-friendly US default for chapter books; picture
  // books continue to default to A4 since their templates were tuned
  // for that size.
  const [format, setFormat] = useState<PDFFormat>(isChapterBook ? 'letter' : 'a4');
  const formats = isChapterBook ? CHAPTER_BOOK_FORMATS : PICTURE_BOOK_FORMATS;

  // Legal is not supported for Comic layout
  const isFormatDisabled = (f: PDFFormat) => f === 'large' && layout === 'comic';

  const handleLayoutChange = (newLayout: PDFLayout) => {
    setLayout(newLayout);
    if (newLayout === 'comic' && format === 'large') {
      setFormat('a4');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-[340px] sm:w-[420px] p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Customize & Export</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Layout Selection — picture books only. Chapter books have
            flowing text + kid-defined page breaks, so the per-page scene
            layout picker doesn't translate. */}
        {!isChapterBook && (
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Layout</label>
            <div className="grid grid-cols-3 gap-3">
              {layouts.map((l) => (
                <button
                  key={l.value}
                  onClick={() => handleLayoutChange(l.value)}
                  className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                    layout === l.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="w-14 h-18 sm:w-16 sm:h-20 mb-1.5">
                    <LayoutIcon layout={l.value} />
                  </div>
                  <span className={`text-xs font-medium ${layout === l.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {l.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{l.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Page Size Selection */}
        <div className="mb-6">
          <label className="text-sm font-semibold text-gray-700 mb-2 block">Page Size</label>
          <div className="flex gap-2">
            {formats.map((f) => {
              const disabled = isFormatDisabled(f.value);
              return (
                <button
                  key={f.value}
                  onClick={() => !disabled && setFormat(f.value)}
                  disabled={disabled}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-center transition-all ${
                    disabled
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : format === f.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-[10px] text-gray-400">{f.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onExport(format, layout)}
          disabled={exporting}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {exporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Exporting...</span>
            </>
          ) : (
            <span>Export PDF</span>
          )}
        </button>
      </div>
    </div>
  );
}
