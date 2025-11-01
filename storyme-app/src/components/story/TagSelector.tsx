/**
 * Tag Selector Component
 * Reusable component for selecting story tags
 */

'use client';

import { useState, useEffect } from 'react';
import type { StoryTag } from '@/lib/types/story';

interface TagSelectorProps {
  projectId: string;
  initialTags?: StoryTag[];
  onTagsChange?: (tags: StoryTag[]) => void;
}

export default function TagSelector({ projectId, initialTags = [], onTagsChange }: TagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<StoryTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<StoryTag[]>(initialTags);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch available tags
  useEffect(() => {
    fetchTags();
  }, []);

  // Update selected tags when initialTags changes
  useEffect(() => {
    setSelectedTags(initialTags);
  }, [initialTags]);

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      setAvailableTags(data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: StoryTag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);

    let newTags: StoryTag[];
    if (isSelected) {
      newTags = selectedTags.filter(t => t.id !== tag.id);
    } else {
      newTags = [...selectedTags, tag];
    }

    setSelectedTags(newTags);
    setHasChanges(true);

    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagIds: selectedTags.map(t => t.id),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setHasChanges(false);
        alert('✅ Tags saved successfully!');
      } else {
        alert(`❌ Failed to save tags: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving tags:', error);
      alert('❌ Error saving tags. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading tags...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Tags & Categories
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Help others discover your story by adding relevant tags
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {availableTags.map(tag => {
          const isSelected = selectedTags.some(t => t.id === tag.id);

          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              {tag.icon && <span className="text-base leading-none">{tag.icon}</span>}
              <span>{tag.name}</span>
            </button>
          );
        })}
      </div>

      {hasChanges && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </span>
            ) : (
              'Save Tags'
            )}
          </button>
          <span className="text-xs text-gray-500">
            {selectedTags.length} {selectedTags.length === 1 ? 'tag' : 'tags'} selected
          </span>
        </div>
      )}

      {!hasChanges && selectedTags.length > 0 && (
        <p className="text-xs text-green-600 font-medium">
          ✓ Tags saved ({selectedTags.length} {selectedTags.length === 1 ? 'tag' : 'tags'})
        </p>
      )}
    </div>
  );
}
