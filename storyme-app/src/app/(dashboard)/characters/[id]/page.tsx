/**
 * Character detail page
 * View all information about a specific character
 */

import { createClient } from '@/lib/supabase/server';
import { getCharacterById } from '@/lib/db/characters';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import DeleteCharacterButton from '@/components/characters/DeleteCharacterButton';
import FavoriteButton from '@/components/characters/FavoriteButton';

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch character
  const { data: character, error } = await getCharacterById(supabase, id);

  if (error || !character) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{character.name}</h1>
            <FavoriteButton
              characterId={character.id}
              initialIsFavorite={character.is_favorite}
            />
          </div>
          <p className="text-gray-600">
            Created {new Date(character.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/characters/${character.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Edit Character
          </Link>
          <DeleteCharacterButton characterId={character.id} characterName={character.name} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Images */}
        <div className="lg:col-span-1 space-y-4">
          {/* 3D Preview (shown first if available) */}
          {character.animated_preview_url && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-gray-900">3D Preview</h2>
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                  Pixar Style
                </span>
              </div>
              <div className="relative">
                <img
                  src={character.animated_preview_url}
                  alt={`${character.name} 3D Preview`}
                  className="w-full aspect-square object-contain rounded-lg bg-gray-50"
                />
                <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                  3D
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                AI-generated character for stories
              </p>
            </div>
          )}

          {/* Reference Photo */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Reference Photo</h2>
            {character.reference_image_url ? (
              <img
                src={character.reference_image_url}
                alt={character.name}
                className="w-full aspect-square object-cover rounded-lg"
              />
            ) : (
              <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <svg
                    className="w-16 h-16 text-gray-400 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <p className="text-sm text-gray-500">No photo uploaded</p>
                </div>
              </div>
            )}
          </div>

          {/* Usage Stats */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Usage</h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Stories</span>
                <span className="text-lg font-semibold text-gray-900">
                  {character.usage_count}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span
                  className={`text-sm font-medium ${
                    character.is_favorite ? 'text-yellow-600' : 'text-gray-600'
                  }`}
                >
                  {character.is_favorite ? 'Favorite' : 'Regular'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Physical Description */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Physical Description</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Hair Color
                </label>
                <p className="text-gray-900">
                  {character.hair_color || (
                    <span className="text-gray-400 italic">Not specified</span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Skin Tone
                </label>
                <p className="text-gray-900">
                  {character.skin_tone || (
                    <span className="text-gray-400 italic">Not specified</span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Age</label>
                <p className="text-gray-900">
                  {character.age || <span className="text-gray-400 italic">Not specified</span>}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Typical Clothing
                </label>
                <p className="text-gray-900">
                  {character.clothing || (
                    <span className="text-gray-400 italic">Not specified</span>
                  )}
                </p>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Other Features
                </label>
                <p className="text-gray-900">
                  {character.other_features || (
                    <span className="text-gray-400 italic">Not specified</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* AI Generated Data */}
          {character.ai_description && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                AI Generated Description
              </h2>
              <p className="text-gray-700">{character.ai_description}</p>
            </div>
          )}

          {/* Art Style Preference */}
          {character.art_style_preference && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Art Style
                </label>
                <p className="text-gray-900 capitalize">{character.art_style_preference}</p>
              </div>
            </div>
          )}

          {/* Projects Using This Character */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Stories Using This Character</h2>
            <p className="text-gray-500 text-sm italic">
              No projects yet. Create a project to start using this character.
            </p>
            {/* TODO: Add actual projects list when project system is built */}
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-8">
        <Link
          href="/characters"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Character Library
        </Link>
      </div>
    </div>
  );
}
