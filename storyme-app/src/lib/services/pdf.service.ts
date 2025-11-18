/**
 * PDF Generation Service
 * Client-side PDF generation using @react-pdf/renderer
 */

import { pdf } from '@react-pdf/renderer';
import { StorybookTemplate } from '@/components/pdf/StorybookTemplate';
import { StorybookTemplateLarge } from '@/components/pdf/StorybookTemplateLarge';

export type PDFFormat = 'a5' | 'large';

export interface StoryData {
  title: string;
  description?: string;
  coverImageUrl?: string;
  scenes: Array<{
    sceneNumber: number;
    caption?: string;          // Age-appropriate caption for PDF
    caption_chinese?: string;  // Chinese translation (NEW - Bilingual Support)
    description?: string;      // Fallback for backward compatibility
    imageUrl: string;
  }>;
  createdDate?: string;
  author?: string;
}

/**
 * Generate PDF from story data
 * Returns a Blob that can be downloaded
 * @param format - 'a5' for A5 booklet (420x595pt) or 'large' for Legal booklet (504x612pt)
 */
export async function generateStoryPDF(storyData: StoryData, format: PDFFormat = 'a5'): Promise<Blob> {
  try {
    // Select template based on format
    const Template = format === 'large' ? StorybookTemplateLarge : StorybookTemplate;

    // Create PDF document
    const doc = Template({
      title: storyData.title,
      description: storyData.description,
      author: storyData.author,
      coverImageUrl: storyData.coverImageUrl,
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
 * @param format - 'a5' for A5 booklet or 'large' for Legal booklet (7"x8.5")
 */
export async function generateAndDownloadStoryPDF(
  storyData: StoryData,
  filename?: string,
  format: PDFFormat = 'a5'
): Promise<void> {
  const blob = await generateStoryPDF(storyData, format);
  // Sanitize filename while preserving Chinese and other Unicode characters
  // Only remove characters that are invalid in filenames: \ / : * ? " < > |
  const sanitizedTitle = storyData.title.replace(/[\\/:*?"<>|]/g, '_');
  const finalFilename = filename || `${sanitizedTitle}.pdf`;
  downloadPDF(blob, finalFilename);
}
