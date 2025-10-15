/**
 * Sample storybooks to showcase on the landing page
 * These can be from internal tests or customer submissions (with permission)
 */

export interface SampleStorybook {
  id: string;
  title: string;
  description: string;
  coverImage: string; // URL to cover image
  scenes: {
    description: string;
    imageUrl: string;
  }[];
  characters: string[]; // Character names
  ageGroup: string; // e.g., "3-5 years"
  isCustomerSubmission: boolean;
  customerName?: string; // If customer agreed to share
}

export const sampleStorybooks: SampleStorybook[] = [
  // TODO: Replace with actual generated storybook images
  // For now, the array is empty until real sample images are available
  // To add samples:
  // 1. Generate a complete story in the app
  // 2. Save the generated image URLs (from Fal.ai)
  // 3. Add them here with actual image URLs that won't expire
];
