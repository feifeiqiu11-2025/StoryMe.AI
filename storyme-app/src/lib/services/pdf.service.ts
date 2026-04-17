/**
 * PDF Generation Service
 * Client-side PDF generation using @react-pdf/renderer
 */

import { pdf } from '@react-pdf/renderer';
import { StorybookTemplate } from '@/components/pdf/StorybookTemplate';
import { StorybookTemplateA4 } from '@/components/pdf/StorybookTemplateA4';
import { StorybookTemplateLarge } from '@/components/pdf/StorybookTemplateLarge';
import { StorybookTemplateComic } from '@/components/pdf/StorybookTemplateComic';
import { StorybookTemplateGrid } from '@/components/pdf/StorybookTemplateGrid';

export type PDFFormat = 'a5' | 'a4' | 'large';
export type PDFLayout = 'classic' | 'comic' | 'grid';

export interface StoryCharacterData {
  name: string;
  designerName?: string;          // child artist's name from character_library.designer_name
  originalCreationUrl?: string;   // reference_image_url (child's original artwork/craft)
  storyVersionUrl?: string;       // animated_preview_url (how character looks in the story)
}

export interface StoryData {
  title: string;
  description?: string;
  coverImageUrl?: string;
  scenes: Array<{
    sceneNumber: number;
    caption?: string;          // Age-appropriate caption for PDF
    caption_chinese?: string;  // Chinese translation (backward compat)
    caption_secondary?: string; // Generic secondary language caption (Korean, Chinese, etc.)
    description?: string;      // Fallback for backward compatibility
    imageUrl: string;
  }>;
  characters?: StoryCharacterData[];  // Characters for "Meet the Character Designers" page
  createdDate?: string;
  author?: string;
}

/** Page dimensions per format */
const PAGE_SIZES: Record<PDFFormat, { width: number; height: number }> = {
  a5: { width: 420, height: 595 },
  a4: { width: 595, height: 842 },
  large: { width: 504, height: 612 },
};

/**
 * Generate PDF from story data
 * Returns a Blob that can be downloaded
 * @param format - Page size: 'a5', 'a4', or 'large'
 * @param layout - Scene layout: 'classic' (1/page), 'comic' (2/page), 'grid' (4/page)
 */
export async function generateStoryPDF(
  storyData: StoryData,
  format: PDFFormat = 'a5',
  layout: PDFLayout = 'classic'
): Promise<Blob> {
  try {
    const templateProps = {
      title: storyData.title,
      description: storyData.description,
      author: storyData.author,
      coverImageUrl: storyData.coverImageUrl,
      scenes: storyData.scenes,
      characters: storyData.characters,
      createdDate: storyData.createdDate,
      pageSize: PAGE_SIZES[format],
    };

    let doc;

    if (layout === 'comic') {
      doc = StorybookTemplateComic(templateProps);
    } else if (layout === 'grid') {
      doc = StorybookTemplateGrid(templateProps);
    } else {
      // Classic layout — use the format-specific templates (they have format-tuned ratios)
      const Template =
        format === 'a4' ? StorybookTemplateA4 :
        format === 'large' ? StorybookTemplateLarge :
        StorybookTemplate;
      doc = Template(templateProps);
    }

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
 * @param format - Page size: 'a5', 'a4', or 'large'
 * @param layout - Scene layout: 'classic' (1/page), 'comic' (2/page), 'grid' (4/page)
 */
export async function generateAndDownloadStoryPDF(
  storyData: StoryData,
  filename?: string,
  format: PDFFormat = 'a5',
  layout: PDFLayout = 'classic'
): Promise<void> {
  const blob = await generateStoryPDF(storyData, format, layout);
  // Sanitize filename while preserving Chinese and other Unicode characters
  // Only remove characters that are invalid in filenames: \ / : * ? " < > |
  const sanitizedTitle = storyData.title.replace(/[\\/:*?"<>|]/g, '_');
  const finalFilename = filename || `${sanitizedTitle}.pdf`;
  downloadPDF(blob, finalFilename);
}
