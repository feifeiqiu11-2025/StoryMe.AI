/**
 * PDF Generation Service
 * Client-side PDF generation using @react-pdf/renderer
 */

import { pdf } from '@react-pdf/renderer';
import { StorybookTemplate } from '@/components/pdf/StorybookTemplate';

export interface StoryData {
  title: string;
  description?: string;
  scenes: Array<{
    sceneNumber: number;
    description: string;
    imageUrl: string;
  }>;
  createdDate?: string;
  author?: string;
}

/**
 * Generate PDF from story data
 * Returns a Blob that can be downloaded
 */
export async function generateStoryPDF(storyData: StoryData): Promise<Blob> {
  try {
    // Create PDF document
    const doc = StorybookTemplate({
      title: storyData.title,
      description: storyData.description,
      author: storyData.author,
      scenes: storyData.scenes,
      createdDate: storyData.createdDate,
    });

    // Generate blob
    const blob = await pdf(doc).toBlob();

    return blob;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Download PDF to client browser
 */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download PDF in one step
 */
export async function generateAndDownloadStoryPDF(
  storyData: StoryData,
  filename?: string
): Promise<void> {
  const blob = await generateStoryPDF(storyData);
  const finalFilename = filename || `${storyData.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  downloadPDF(blob, finalFilename);
}
