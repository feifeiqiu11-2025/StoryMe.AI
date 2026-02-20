/**
 * StyleSelector Component
 *
 * Allows users to choose between art styles before generating images:
 * - 3D Pixar: Disney/Pixar CGI style
 * - Classic Storybook: 2D hand-drawn/watercolor illustration
 * - Coloring Book: Black & white line art for coloring
 *
 * Default: Classic Storybook (2D)
 */

'use client';

import { useState } from 'react';

export type ArtStyleType = 'pixar' | 'classic' | 'coloring';

interface StyleSelectorProps {
  selectedStyle: ArtStyleType;
  onStyleChange: (style: ArtStyleType) => void;
  disabled?: boolean;
}

// Example preview images (using placeholder data URLs - these would be actual sample images in production)
const STYLE_PREVIEWS = {
  pixar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMTIwIDEyMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzY2NjZmZiIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzk5MzNmZiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSJ1cmwoI2JnKSIgcng9IjgiLz48Y2lyY2xlIGN4PSI2MCIgY3k9IjQ1IiByPSIyMCIgZmlsbD0iI2ZmZTRjNCIvPjxlbGxpcHNlIGN4PSI2MCIgY3k9Ijg1IiByeD0iMjUiIHJ5PSIyMCIgZmlsbD0iIzMzOTlmZiIvPjxjaXJjbGUgY3g9IjUyIiBjeT0iNDIiIHI9IjQiIGZpbGw9IiMzMzMiLz48Y2lyY2xlIGN4PSI2OCIgY3k9IjQyIiByPSI0IiBmaWxsPSIjMzMzIi8+PHBhdGggZD0iTTU0IDUyIFE2MCA1NiA2NiA1MiIgc3Ryb2tlPSIjZmY2Njk5IiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48dGV4dCB4PSI2MCIgeT0iMTEwIiBmb250LXNpemU9IjEwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPjNEIFBpeGFyPC90ZXh0Pjwvc3ZnPg==',
  classic: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMTIwIDEyMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI2ZmZTRiNSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2ZmY2M4MCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSJ1cmwoI2JnKSIgcng9IjgiLz48Y2lyY2xlIGN4PSI2MCIgY3k9IjQ1IiByPSIyMiIgZmlsbD0iI2ZmZDRhNCIgc3Ryb2tlPSIjY2M5OTY2IiBzdHJva2Utd2lkdGg9IjEuNSIvPjxlbGxpcHNlIGN4PSI2MCIgY3k9Ijg1IiByeD0iMjgiIHJ5PSIxOCIgZmlsbD0iIzk5Y2NmZiIgc3Ryb2tlPSIjNjY5OWNjIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNDIiIHI9IjUiIGZpbGw9IiM0NDQiLz48Y2lyY2xlIGN4PSI3MCIgY3k9IjQyIiByPSI1IiBmaWxsPSIjNDQ0Ii8+PGNpcmNsZSBjeD0iNTIiIGN5PSI0MCIgcj0iMS41IiBmaWxsPSJ3aGl0ZSIvPjxjaXJjbGUgY3g9IjcyIiBjeT0iNDAiIHI9IjEuNSIgZmlsbD0id2hpdGUiLz48cGF0aCBkPSJNNTIgNTUgUTYwIDYyIDY4IDU1IiBzdHJva2U9IiNmZjg4YWEiIHN0cm9rZS13aWR0aD0iMi41IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48dGV4dCB4PSI2MCIgeT0iMTEwIiBmb250LXNpemU9IjkiIGZpbGw9IiM4ODY2NDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiI+Q2xhc3NpYyAyRDwvdGV4dD48L3N2Zz4=',
  coloring: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMTIwIDEyMCI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiNmZmZmZmYiIHJ4PSI4IiBzdHJva2U9IiNlMGUwZTAiIHN0cm9rZS13aWR0aD0iMSIvPjxjaXJjbGUgY3g9IjYwIiBjeT0iNDUiIHI9IjIwIiBmaWxsPSJub25lIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIvPjxlbGxpcHNlIGN4PSI2MCIgY3k9Ijg1IiByeD0iMjUiIHJ5PSIxOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI1MiIgY3k9IjQyIiByPSI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMS41Ii8+PGNpcmNsZSBjeD0iNjgiIGN5PSI0MiIgcj0iNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxwYXRoIGQ9Ik01NCA1MiBRNjAgNTYgNjYgNTIiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxLjUiIGZpbGw9Im5vbmUiLz48dGV4dCB4PSI2MCIgeT0iMTEwIiBmb250LXNpemU9IjkiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5Db2xvcmluZzwvdGV4dD48L3N2Zz4=',
};

export default function StyleSelector({ selectedStyle, onStyleChange, disabled }: StyleSelectorProps) {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-amber-50 rounded-xl p-4 border border-purple-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎨</span>
        <h4 className="text-sm font-semibold text-gray-900">Art Style</h4>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* 3D Pixar Option */}
        <button
          type="button"
          onClick={() => onStyleChange('pixar')}
          disabled={disabled}
          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
            selectedStyle === 'pixar'
              ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 bg-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex flex-col items-center gap-2 p-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-400 to-blue-500 flex-shrink-0">
              <img
                src={STYLE_PREVIEWS.pixar}
                alt="3D Pixar style preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center">
              <span className="font-medium text-xs text-gray-900">3D Pixar</span>
              {selectedStyle === 'pixar' && (
                <span className="text-purple-600 text-xs ml-1">✓</span>
              )}
            </div>
          </div>
        </button>

        {/* Classic Storybook Option */}
        <button
          type="button"
          onClick={() => onStyleChange('classic')}
          disabled={disabled}
          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
            selectedStyle === 'classic'
              ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50'
              : 'border-gray-200 hover:border-amber-300 bg-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex flex-col items-center gap-2 p-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-amber-200 to-orange-300 flex-shrink-0">
              <img
                src={STYLE_PREVIEWS.classic}
                alt="Classic storybook style preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center">
              <span className="font-medium text-xs text-gray-900">Classic 2D</span>
              {selectedStyle === 'classic' && (
                <span className="text-amber-600 text-xs ml-1">✓</span>
              )}
            </div>
          </div>
        </button>

        {/* Coloring Book Option */}
        <button
          type="button"
          onClick={() => onStyleChange('coloring')}
          disabled={disabled}
          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
            selectedStyle === 'coloring'
              ? 'border-gray-500 ring-2 ring-gray-200 bg-gray-50'
              : 'border-gray-200 hover:border-gray-400 bg-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex flex-col items-center gap-2 p-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-gray-200 flex-shrink-0">
              <img
                src={STYLE_PREVIEWS.coloring}
                alt="Coloring book style preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center">
              <span className="font-medium text-xs text-gray-900">Coloring</span>
              {selectedStyle === 'coloring' && (
                <span className="text-gray-600 text-xs ml-1">✓</span>
              )}
            </div>
          </div>
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-2 text-center">
        {selectedStyle === 'pixar'
          ? 'Vibrant 3D animated characters like Disney/Pixar movies'
          : selectedStyle === 'classic'
          ? 'Soft, hand-drawn illustrations with a cozy storybook feel'
          : 'Black & white line art for kids to color (cover stays colorful)'}
      </p>
    </div>
  );
}
