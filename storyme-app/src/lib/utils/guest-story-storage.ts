/**
 * Guest Story Preservation Utility
 *
 * Stores guest user stories in sessionStorage before signup,
 * then retrieves and saves to account after authentication.
 */

import { Character, GeneratedImage } from '@/lib/types/story';

export interface GuestStoryData {
  characters: Character[];
  script: string;
  readingLevel: number;
  storyTone: string;
  enhancedScenes: any[];
  generatedImages: GeneratedImage[];
  title?: string;
  description?: string;
  authorName?: string;
  authorAge?: string;
  timestamp: number;
}

const STORAGE_KEY = 'storyme_guest_story';

/**
 * Save guest story to sessionStorage before signup
 */
export function saveGuestStory(data: Omit<GuestStoryData, 'timestamp'>): void {
  try {
    const storyData: GuestStoryData = {
      ...data,
      timestamp: Date.now(),
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storyData));
    console.log('✓ Guest story saved to sessionStorage');
  } catch (error) {
    console.error('Failed to save guest story:', error);
  }
}

/**
 * Retrieve saved guest story from sessionStorage
 */
export function getGuestStory(): GuestStoryData | null {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const parsed: GuestStoryData = JSON.parse(data);

    // Check if story is less than 1 hour old
    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > ONE_HOUR) {
      console.log('Guest story expired, clearing...');
      clearGuestStory();
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to retrieve guest story:', error);
    return null;
  }
}

/**
 * Check if there's a saved guest story
 */
export function hasGuestStory(): boolean {
  return getGuestStory() !== null;
}

/**
 * Clear guest story from sessionStorage
 */
export function clearGuestStory(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    console.log('✓ Guest story cleared from sessionStorage');
  } catch (error) {
    console.error('Failed to clear guest story:', error);
  }
}

/**
 * Save guest story to user's account after authentication
 */
export async function saveGuestStoryToAccount(userId: string): Promise<boolean> {
  const guestStory = getGuestStory();
  if (!guestStory) {
    console.log('No guest story to save');
    return false;
  }

  try {
    console.log('Saving guest story to user account...');

    // Step 1: Create characters in the character library first
    console.log('Creating characters in library...');
    const characterIdMap: Record<string, string> = {}; // Map from temp ID to real UUID

    for (const character of guestStory.characters) {
      try {
        const charResponse = await fetch('/api/characters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: character.name,
            reference_image_url: character.referenceImage.url,
            reference_image_filename: character.referenceImage.fileName,
            hair_color: character.description.hairColor || '',
            skin_tone: character.description.skinTone || '',
            clothing: character.description.clothing || '',
            age: character.description.age || '',
            other_features: character.description.otherFeatures || '',
          }),
        });

        if (!charResponse.ok) {
          const errorData = await charResponse.json();
          console.error('Character creation error:', errorData);

          // If unauthorized, user needs to sign in
          if (charResponse.status === 401) {
            throw new Error('UNAUTHORIZED');
          }

          const errorMsg = errorData.details
            ? `${errorData.error}: ${JSON.stringify(errorData.details)}`
            : errorData.error;
          throw new Error(`Failed to create character ${character.name}: ${errorMsg}`);
        }

        const charData = await charResponse.json();
        characterIdMap[character.id] = charData.character.id; // Map temp ID to real UUID
        console.log(`✓ Created character: ${character.name} (${character.id} → ${charData.character.id})`);
      } catch (error) {
        console.error(`Failed to create character ${character.name}:`, error);
        throw error;
      }
    }

    // Step 2: Save the story with real character UUIDs
    const realCharacterIds = guestStory.characters.map(c => characterIdMap[c.id]);

    const response = await fetch('/api/projects/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: guestStory.title || 'My Story',
        description: guestStory.description || '',
        authorName: guestStory.authorName || '',
        authorAge: guestStory.authorAge ? parseInt(guestStory.authorAge) : undefined,
        originalScript: guestStory.script,
        readingLevel: guestStory.readingLevel,
        storyTone: guestStory.storyTone,
        characterIds: realCharacterIds, // Use real UUIDs instead of temp IDs
        scenes: guestStory.generatedImages.map((img, index) => {
          const enhancedScene = guestStory.enhancedScenes.find(s => s.sceneNumber === img.sceneNumber);
          return {
            sceneNumber: img.sceneNumber,
            description: img.sceneDescription,
            raw_description: enhancedScene?.raw_description,
            enhanced_prompt: enhancedScene?.enhanced_prompt,
            caption: enhancedScene?.caption,
            imageUrl: img.imageUrl,
            prompt: img.prompt,
            generationTime: img.generationTime,
          };
        }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save story');
    }

    const result = await response.json();
    console.log('✓ Guest story saved to account:', result.project?.id);

    // Clear the guest story after successful save
    clearGuestStory();

    return true;
  } catch (error) {
    console.error('Failed to save guest story to account:', error);
    return false;
  }
}
