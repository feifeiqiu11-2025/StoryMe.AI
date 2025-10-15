/**
 * Character edit page
 * Form for updating an existing character
 */

import { createClient } from '@/lib/supabase/server';
import { getCharacterById } from '@/lib/db/characters';
import { notFound, redirect } from 'next/navigation';
import CharacterEditForm from '@/components/characters/CharacterEditForm';

export default async function EditCharacterPage({
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Character</h1>
        <p className="mt-2 text-gray-600">Update {character.name}'s information</p>
      </div>

      <CharacterEditForm character={character} />
    </div>
  );
}
