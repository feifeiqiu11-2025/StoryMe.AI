/**
 * Delete Character Button Component
 * Client component for deleting a character with confirmation
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteCharacterButtonProps {
  characterId: string;
  characterName: string;
}

export default function DeleteCharacterButton({
  characterId,
  characterName,
}: DeleteCharacterButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/characters/${characterId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete character');
        setLoading(false);
        return;
      }

      // Success - redirect to character library
      router.push('/characters');
      router.refresh();
    } catch (err) {
      console.error('Error deleting character:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 font-medium"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Character?</h3>
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete <strong>{characterName}</strong>? This action cannot be
          undone.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
