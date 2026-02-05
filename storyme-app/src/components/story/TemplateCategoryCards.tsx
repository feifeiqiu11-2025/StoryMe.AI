/**
 * Template Category Cards
 *
 * Displays story template categories as a selectable grid.
 * SEL is pre-selected by default. User can click a selected card again to deselect (freeform mode).
 * Tooltip shows a short description of each category on hover.
 */

'use client';

import { useState } from 'react';
import { StoryTemplateId } from '@/lib/types/story';
import { getTemplateList, type StoryTemplate } from '@/lib/ai/story-templates';

interface TemplateCategoryCardsProps {
  selectedTemplate: StoryTemplateId | null;
  onTemplateChange: (templateId: StoryTemplateId | null) => void;
  disabled?: boolean;
}

export default function TemplateCategoryCards({
  selectedTemplate,
  onTemplateChange,
  disabled = false,
}: TemplateCategoryCardsProps) {
  const templates = getTemplateList();
  const [hoveredId, setHoveredId] = useState<StoryTemplateId | null>(null);

  const handleClick = (templateId: StoryTemplateId) => {
    if (disabled) return;
    // Toggle: clicking the selected card deselects it (freeform mode)
    if (selectedTemplate === templateId) {
      onTemplateChange(null);
    } else {
      onTemplateChange(templateId);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Story Template
      </label>

      {/* Responsive grid: 2 cols on mobile, 4 cols on tablet+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {templates.map((template) => {
          const isSelected = selectedTemplate === template.id;
          return (
            <div key={template.id} className="relative">
              <button
                type="button"
                onClick={() => handleClick(template.id)}
                onMouseEnter={() => setHoveredId(template.id)}
                onMouseLeave={() => setHoveredId(null)}
                disabled={disabled}
                className={`
                  w-full px-3 py-2 text-left rounded-lg border-2 transition-all text-sm
                  ${isSelected
                    ? 'border-purple-500 bg-purple-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span className={`font-medium leading-tight block ${
                  isSelected ? 'text-purple-700' : 'text-gray-700'
                }`}>
                  {template.name}
                </span>
              </button>

              {/* Tooltip on hover */}
              {hoveredId === template.id && (
                <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                  {template.tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-800 rotate-45"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
