import { Scene, Character } from './types/story';

/**
 * Extract character names from a scene description
 * Looks for character names at the start of the description or in common patterns
 */
export function extractCharacterNames(description: string, availableCharacters: Character[]): string[] {
  const foundCharacters: string[] = [];
  const lowerDescription = description.toLowerCase();

  for (const character of availableCharacters) {
    const lowerName = character.name.toLowerCase();

    // Check if character name appears in the description
    if (lowerDescription.includes(lowerName)) {
      foundCharacters.push(character.name);
    }
  }

  return foundCharacters;
}

/**
 * Detect generic/unnamed characters in scene description
 * Common roles: policeman, teacher, doctor, firefighter, etc.
 */
export function extractGenericCharacters(description: string): string[] {
  const genericRoles = [
    'policeman', 'police officer', 'officer',
    'teacher', 'doctor', 'nurse',
    'firefighter', 'fireman',
    'mailman', 'postman',
    'chef', 'cook',
    'pilot', 'driver', 'captain',
    'worker', 'builder', 'construction worker',
    'farmer', 'gardener',
    'shopkeeper', 'cashier',
    'waiter', 'waitress',
    'mom', 'mother', 'dad', 'father',
    'grandma', 'grandmother', 'grandpa', 'grandfather',
    'friend', 'neighbor', 'stranger',
    'man', 'woman', 'person', 'people',
    'boy', 'girl', 'kid', 'child',
  ];

  const lowerDescription = description.toLowerCase();
  const found: string[] = [];

  for (const role of genericRoles) {
    // Use word boundary regex to match whole words only
    const regex = new RegExp(`\\b${role}s?\\b`, 'i');
    if (regex.test(lowerDescription)) {
      found.push(role);
    }
  }

  return found;
}

/**
 * Enhance prompt with generic character emphasis
 */
export function enhancePromptWithGenericCharacters(
  sceneDescription: string,
  definedCharacters: string[]
): string {
  const genericChars = extractGenericCharacters(sceneDescription);

  if (genericChars.length === 0) {
    return sceneDescription;
  }

  // Add emphasis to ensure generic characters appear
  const genericEmphasis = genericChars
    .map(char => `prominently showing a ${char}`)
    .join(', ');

  return `${sceneDescription}, ${genericEmphasis}`;
}

/**
 * Parse a script text into individual scenes
 * Each line becomes a scene (ignoring empty lines)
 */
export function parseScriptIntoScenes(script: string, availableCharacters: Character[] = []): Scene[] {
  if (!script.trim()) {
    return [];
  }

  // Split by newlines and filter out empty lines
  const lines = script
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Convert each line into a scene
  const scenes: Scene[] = lines.map((line, index) => {
    // Remove "Scene N:" prefix if present
    const description = line.replace(/^Scene\s+\d+:\s*/i, '').trim();

    // Extract character names if characters are provided
    const characterNames = availableCharacters.length > 0
      ? extractCharacterNames(description, availableCharacters)
      : undefined;

    return {
      id: `scene-${index + 1}-${Date.now()}`,
      sceneNumber: index + 1,
      description: description,
      characterNames: characterNames
    };
  });

  return scenes;
}

/**
 * Validate that a script has a reasonable number of scenes
 */
export function validateScript(script: string): { valid: boolean; error?: string } {
  const scenes = parseScriptIntoScenes(script);

  if (scenes.length === 0) {
    return { valid: false, error: 'Please enter at least one scene description' };
  }

  if (scenes.length > 15) {
    return { valid: false, error: 'Maximum 15 scenes allowed for the POC' };
  }

  // Check if any scene description is too short
  const tooShort = scenes.find(scene => scene.description.length < 10);
  if (tooShort) {
    return {
      valid: false,
      error: `Scene ${tooShort.sceneNumber} is too short. Please provide more detail.`
    };
  }

  // Check if any scene description is too long
  const tooLong = scenes.find(scene => scene.description.length > 500);
  if (tooLong) {
    return {
      valid: false,
      error: `Scene ${tooLong.sceneNumber} is too long. Keep descriptions under 500 characters.`
    };
  }

  return { valid: true };
}

/**
 * Validate character references in script
 */
export function validateCharacterReferences(
  script: string,
  availableCharacters: Character[]
): { valid: boolean; error?: string; warnings?: string[] } {
  if (availableCharacters.length === 0) {
    return { valid: false, error: 'Please add at least one character before writing your script' };
  }

  const scenes = parseScriptIntoScenes(script, availableCharacters);
  const warnings: string[] = [];

  // Check if any scene has no characters
  const scenesWithoutCharacters = scenes.filter(
    scene => !scene.characterNames || scene.characterNames.length === 0
  );

  if (scenesWithoutCharacters.length > 0) {
    const sceneNumbers = scenesWithoutCharacters.map(s => s.sceneNumber).join(', ');
    warnings.push(
      `Scene(s) ${sceneNumbers} don't mention any characters. Add character names for better results.`
    );
  }

  // Check if characters have photos
  const charactersWithoutPhotos = availableCharacters.filter(
    c => !c.referenceImage.url
  );

  if (charactersWithoutPhotos.length > 0) {
    const names = charactersWithoutPhotos.map(c => c.name || 'Unnamed').join(', ');
    warnings.push(`Character(s) ${names} are missing reference photos.`);
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Extract scene location/setting from description
 */
export function extractSceneLocation(description: string): string | null {
  const locationKeywords = [
    'playground', 'park', 'beach', 'forest', 'woods',
    'home', 'house', 'bedroom', 'kitchen', 'living room',
    'school', 'classroom', 'library',
    'store', 'shop', 'market', 'mall',
    'street', 'sidewalk', 'road',
    'garden', 'backyard', 'yard',
    'restaurant', 'cafe',
  ];

  const lowerDescription = description.toLowerCase();

  for (const location of locationKeywords) {
    const regex = new RegExp(`\\b${location}\\b`, 'i');
    if (regex.test(lowerDescription)) {
      return location;
    }
  }

  return null;
}

/**
 * Build consistent scene setting description
 * Groups scenes by location for consistency
 */
export function buildConsistentSceneSettings(scenes: Scene[]): Map<string, string> {
  const locationDescriptions = new Map<string, string>();

  // Define detailed, consistent descriptions for common locations
  const detailedSettings: Record<string, string> = {
    'playground': 'sunny playground with red slide, blue swing set, yellow sandbox, green grass, oak tree in background, white picket fence',
    'park': 'beautiful park with green grass, tall oak trees, winding path, blue sky, white clouds, flower beds',
    'beach': 'sandy beach with blue ocean, white waves, clear sky, seashells, sandcastle area',
    'bedroom': 'cozy bedroom with blue walls, wooden bed with colorful blanket, toy box, window with curtains, soft carpet',
    'kitchen': 'bright kitchen with white cabinets, wooden table, fruit bowl, window with sunlight',
    'classroom': 'cheerful classroom with desks, chalkboard, colorful posters, bookshelf, big windows',
    'backyard': 'green backyard with grass, wooden fence, flower beds, patio, sunny day',
    'street': 'quiet residential street with houses, sidewalk, trees, blue sky',
  };

  for (const scene of scenes) {
    const location = extractSceneLocation(scene.description);
    if (location && detailedSettings[location] && !locationDescriptions.has(location)) {
      locationDescriptions.set(location, detailedSettings[location]);
    }
  }

  return locationDescriptions;
}

/**
 * Get a sample script for testing (multi-character)
 */
export function getSampleScript(): string {
  return `Connor playing with his friend at the park on a sunny day
A big friendly dragon accidentally swallows Connor's friend while yawning
Connor looks shocked and worried, the dragon looks surprised and apologetic
Brave 4-year-old Connor decides to gather a superhero squad to save his friend
Connor recruiting superhero friends with capes and masks at the playground
The superhero squad planning their rescue mission with a map and toys
Connor and the superhero squad approaching the gentle dragon
Connor and his superhero friends helping the dragon cough up their friend safely
Everyone celebrating together, the dragon apologizes and they all become friends`;
}
