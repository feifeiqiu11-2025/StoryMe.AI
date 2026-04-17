'use client';

import { useState } from 'react';
import type { PDFFormat, PDFLayout } from '@/lib/services/pdf.service';

interface ExportPdfModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: PDFFormat, layout: PDFLayout) => void;
  exporting: boolean;
}

const layouts: { value: PDFLayout; label: string; description: string }[] = [
  { value: 'classic', label: 'Classic', description: '1 scene per page' },
  { value: 'comic', label: 'Comic Book', description: '2 scenes per page' },
  { value: 'grid', label: 'Grid', description: '4 scenes per page' },
];

const formats: { value: PDFFormat; label: string; description: string }[] = [
  { value: 'a5', label: 'A5', description: 'Compact' },
  { value: 'a4', label: 'A4', description: 'Standard' },
  { value: 'large', label: 'Legal', description: 'Large' },
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
      <div className={`${base} flex-col gap-1`}>
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex-1 bg-indigo-200 rounded-sm" />
          <div className="h-1.5 bg-gray-300 rounded-sm" />
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex-1 bg-indigo-200 rounded-sm" />
          <div className="h-1.5 bg-gray-300 rounded-sm" />
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

export default function ExportPdfModal({ open, onClose, onExport, exporting }: ExportPdfModalProps) {
  const [layout, setLayout] = useState<PDFLayout>('comic');
  const [format, setFormat] = useState<PDFFormat>('a4');

  // Legal is not supported for Comic layout
  const isFormatDisabled = (f: PDFFormat) => f === 'large' && layout === 'comic';

  // If user switches to Comic while Legal is selected, reset to A5
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
      <div className="bg-white rounded-xl shadow-2xl w-[340px] sm:w-[400px] p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Export PDF</h3>
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

        {/* Layout Selection */}
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

        {/* Export Button */}
        <button
          onClick={() => onExport(format, layout)}
          disabled={exporting}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-medium shadow-md hover:from-orange-700 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {exporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>📄</span>
              <span>Export PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
