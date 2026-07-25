// Export utilities for converting projects to different formats
// Supports: Markdown, Google Docs, PDF

import { Project as FlexibleProject, ProjectPage, PageSection, SectionContent } from './project-data-model';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ============================================================================
// MARKDOWN EXPORT
// ============================================================================

export interface MarkdownExportOptions {
  includeTableOfContents?: boolean;
  includeMetadata?: boolean;
  includePageNumbers?: boolean;
  sectionNumbering?: boolean;
}

/**
 * Convert a project to Markdown format
 * Returns a complete markdown document with all pages and sections
 */
export async function exportToMarkdown(
  project: FlexibleProject,
  pages: ProjectPage[],
  options: MarkdownExportOptions = {}
): Promise<string> {
  const {
    includeTableOfContents = true,
    includeMetadata = true,
    sectionNumbering = true
  } = options;

  let markdown = '';

  // Document header
  markdown += `# ${project.title}\n\n`;

  if (includeMetadata) {
    markdown += `> **Project Type:** ${getTemplateDisplayName(project.templateType)}\n`;
    markdown += `> **Status:** ${project.metadata.status}\n`;
    markdown += `> **Last Updated:** ${new Date(project.updatedAt).toLocaleDateString()}\n`;
    markdown += `\n---\n\n`;
  }

  // Description
  if (project.description) {
    markdown += `${project.description}\n\n`;
    markdown += `---\n\n`;
  }

  // Table of Contents
  if (includeTableOfContents) {
    markdown += generateTableOfContents(pages);
    markdown += `---\n\n`;
  }

  // Sort pages by order
  const sortedPages = [...pages].sort((a, b) => a.order - b.order);

  // Convert each page
  sortedPages.forEach((page, pageIndex) => {
    const pageNumber = sectionNumbering ? `${pageIndex + 1}. ` : '';
    markdown += `## ${pageNumber}${page.title}\n\n`;

    if (page.description) {
      markdown += `*${page.description}*\n\n`;
    }

    // Convert sections
    const sortedSections = Object.values(page.sections || {}).sort((a, b) => a.order - b.order);

    sortedSections.forEach((section, sectionIndex) => {
      const sectionNumber = sectionNumbering ? `${pageIndex + 1}.${sectionIndex + 1}` : '';
      markdown += convertSectionToMarkdown(section, sectionNumber);
      markdown += '\n';
    });

    // Page separator
    markdown += `\n---\n\n`;
  });

  // Footer
  markdown += `\n*Generated from SystemDesigner.net on ${new Date().toLocaleDateString()}*\n`;

  return markdown;
}

/**
 * Generate table of contents from pages
 */
function generateTableOfContents(pages: ProjectPage[]): string {
  let toc = '## Table of Contents\n\n';

  const sortedPages = [...pages].sort((a, b) => a.order - b.order);

  sortedPages.forEach((page, index) => {
    toc += `${index + 1}. [${page.title}](#${slugify(page.title)})\n`;

    const sortedSections = Object.values(page.sections || {}).sort((a, b) => a.order - b.order);
    sortedSections.forEach((section, sectionIndex) => {
      toc += `   ${index + 1}.${sectionIndex + 1}. [${section.title}](#${slugify(section.title)})\n`;
    });
  });

  toc += '\n';
  return toc;
}

/**
 * Convert a single section to markdown based on its type
 */
function convertSectionToMarkdown(section: PageSection, sectionNumber: string): string {
  let markdown = `### ${sectionNumber ? sectionNumber + ' ' : ''}${section.title}\n\n`;

  const content = section.content;

  switch (content.type) {
    case 'text-editor':
      markdown += convertTextEditorToMarkdown(content);
      break;

    case 'code-editor':
      markdown += convertCodeEditorToMarkdown(content);
      break;

    case 'qa-pairs':
      markdown += convertQAPairsToMarkdown(content);
      break;

    case 'requirements':
      markdown += convertRequirementsToMarkdown(content);
      break;

    case 'calculations':
      markdown += convertCalculationsToMarkdown(content);
      break;

    case 'checklist':
      markdown += convertChecklistToMarkdown(content);
      break;

    case 'table':
      markdown += convertTableToMarkdown(content);
      break;

    case 'bullet-list':
      markdown += convertBulletListToMarkdown(content);
      break;

    case 'architecture':
      markdown += convertArchitectureToMarkdown(content);
      break;

    case 'whiteboard':
      markdown += `*[Whiteboard diagram - see original project for visual]*\n\n`;
      break;

    case 'rich-document':
      markdown += `*[Rich document content - see original project for full formatting]*\n\n`;
      break;

    default:
      markdown += `*[${content.type} content - not yet supported in export]*\n\n`;
  }

  return markdown;
}

// Section-specific converters

function convertTextEditorToMarkdown(content: any): string {
  // Check if it's using interview QA mode
  if (content.interfaceMode === 'interview-qa') {
    let md = '';

    if (content.qaPairs && content.qaPairs.length > 0) {
      md += '**Questions & Answers:**\n\n';
      content.qaPairs.forEach((qa: any, index: number) => {
        md += `**Q${index + 1}:** ${qa.question}\n\n`;
        md += `**A${index + 1}:** ${qa.answer}\n\n`;
      });
    }

    if (content.requirements && content.requirements.length > 0) {
      md += '**Requirements:**\n\n';

      const functional = content.requirements.filter((r: any) => r.type === 'functional');
      const nonFunctional = content.requirements.filter((r: any) => r.type === 'non-functional');

      if (functional.length > 0) {
        md += '**Functional Requirements:**\n\n';
        functional.forEach((req: any, index: number) => {
          md += `${index + 1}. **${req.title}**\n`;
          if (req.description) {
            md += `   ${req.description}\n`;
          }
        });
        md += '\n';
      }

      if (nonFunctional.length > 0) {
        md += '**Non-Functional Requirements:**\n\n';
        nonFunctional.forEach((req: any, index: number) => {
          md += `${index + 1}. **${req.title}**\n`;
          if (req.description) {
            md += `   ${req.description}\n`;
          }
        });
        md += '\n';
      }
    }

    return md;
  }

  // Regular markdown content
  return content.markdown + '\n\n';
}

function convertCodeEditorToMarkdown(content: any): string {
  let md = '';

  if (content.examples && content.examples.length > 0) {
    content.examples.forEach((example: any) => {
      if (example.title) {
        md += `**${example.title}**\n\n`;
      }
      if (example.description) {
        md += `${example.description}\n\n`;
      }
      md += `\`\`\`${example.language || content.language || ''}\n`;
      md += example.code;
      md += `\n\`\`\`\n\n`;
    });
  } else if (content.code) {
    md += `\`\`\`${content.language || ''}\n`;
    md += content.code;
    md += `\n\`\`\`\n\n`;
  }

  return md;
}

function convertQAPairsToMarkdown(content: any): string {
  let md = '';

  if (content.pairs && content.pairs.length > 0) {
    content.pairs.forEach((pair: any, index: number) => {
      md += `**Q${index + 1}:** ${pair.question}\n\n`;
      md += `**A${index + 1}:** ${pair.answer}\n\n`;
    });
  }

  return md;
}

function convertRequirementsToMarkdown(content: any): string {
  let md = '';

  if (content.functional && content.functional.length > 0) {
    md += '**Functional Requirements:**\n\n';
    content.functional.forEach((req: any, index: number) => {
      md += `${index + 1}. **${req.title}**`;
      if (req.priority) {
        md += ` *(${req.priority} priority)*`;
      }
      md += '\n';
      if (req.description) {
        md += `   ${req.description}\n`;
      }
      if (req.acceptanceCriteria && req.acceptanceCriteria.length > 0) {
        md += '   **Acceptance Criteria:**\n';
        req.acceptanceCriteria.forEach((criteria: string) => {
          md += `   - ${criteria}\n`;
        });
      }
      md += '\n';
    });
  }

  if (content.nonFunctional && content.nonFunctional.length > 0) {
    md += '**Non-Functional Requirements:**\n\n';
    content.nonFunctional.forEach((req: any, index: number) => {
      md += `${index + 1}. **${req.title}**`;
      if (req.priority) {
        md += ` *(${req.priority} priority)*`;
      }
      md += '\n';
      if (req.description) {
        md += `   ${req.description}\n`;
      }
      md += '\n';
    });
  }

  if (content.assumptions && content.assumptions.length > 0) {
    md += '**Assumptions:**\n\n';
    content.assumptions.forEach((assumption: string) => {
      md += `- ${assumption}\n`;
    });
    md += '\n';
  }

  if (content.constraints && content.constraints.length > 0) {
    md += '**Constraints:**\n\n';
    content.constraints.forEach((constraint: string) => {
      md += `- ${constraint}\n`;
    });
    md += '\n';
  }

  return md;
}

function convertCalculationsToMarkdown(content: any): string {
  let md = '';

  if (content.calculations && content.calculations.length > 0) {
    content.calculations.forEach((calc: any) => {
      md += `**${calc.title}**\n\n`;
      if (calc.formula) {
        md += `Formula: \`${calc.formula}\`\n\n`;
      }

      if (calc.variables && Object.keys(calc.variables).length > 0) {
        md += 'Variables:\n';
        Object.entries(calc.variables).forEach(([key, value]) => {
          md += `- ${key} = ${value}\n`;
        });
        md += '\n';
      }

      if (calc.result !== undefined && calc.result !== null) {
        md += `**Result:** ${calc.result}${calc.unit ? ' ' + calc.unit : ''}\n\n`;
      }

      if (calc.breakdown) {
        md += `Breakdown:\n${calc.breakdown}\n\n`;
      }

      if (calc.notes) {
        md += `*${calc.notes}*\n\n`;
      }
    });
  }

  if (content.assumptions && content.assumptions.length > 0) {
    md += '**Assumptions:**\n\n';
    content.assumptions.forEach((assumption: string) => {
      md += `- ${assumption}\n`;
    });
    md += '\n';
  }

  return md;
}

function convertChecklistToMarkdown(content: any): string {
  let md = '';

  if (content.items && content.items.length > 0) {
    // Group by category if categories exist
    const categorySet = new Set(content.items.map((item: any) => item.category).filter(Boolean));
    const categories = Array.from(categorySet);

    if (categories.length > 0) {
      categories.forEach(category => {
        md += `**${category}:**\n\n`;
        content.items
          .filter((item: any) => item.category === category)
          .forEach((item: any) => {
            md += `- [${item.completed ? 'x' : ' '}] ${item.title}`;
            if (item.assignee) {
              md += ` (@${item.assignee})`;
            }
            if (item.dueDate) {
              md += ` - Due: ${new Date(item.dueDate).toLocaleDateString()}`;
            }
            md += '\n';
            if (item.description) {
              md += `  ${item.description}\n`;
            }
          });
        md += '\n';
      });
    } else {
      // No categories, just list items
      content.items.forEach((item: any) => {
        md += `- [${item.completed ? 'x' : ' '}] ${item.title}`;
        if (item.assignee) {
          md += ` (@${item.assignee})`;
        }
        if (item.dueDate) {
          md += ` - Due: ${new Date(item.dueDate).toLocaleDateString()}`;
        }
        md += '\n';
        if (item.description) {
          md += `  ${item.description}\n`;
        }
      });
      md += '\n';
    }
  }

  return md;
}

function convertTableToMarkdown(content: any): string {
  let md = '';

  if (!content.headers || content.headers.length === 0) {
    return md;
  }

  // Headers
  md += '| ' + content.headers.join(' | ') + ' |\n';
  md += '| ' + content.headers.map(() => '---').join(' | ') + ' |\n';

  // Rows
  if (content.rows && content.rows.length > 0) {
    content.rows.forEach((row: any) => {
      const cells = content.headers.map((header: string) => {
        const value = row.cells[header];
        return value !== undefined && value !== null ? String(value) : '';
      });
      md += '| ' + cells.join(' | ') + ' |\n';
    });
  }

  md += '\n';
  return md;
}

function convertBulletListToMarkdown(content: any): string {
  let md = '';

  if (content.items && typeof content.items === 'object') {
    // Items organized by type
    Object.entries(content.items).forEach(([type, items]: [string, any]) => {
      if (Array.isArray(items) && items.length > 0) {
        if (content.settings?.typeOptions) {
          const typeOption = content.settings.typeOptions.find((opt: any) => opt.key === type);
          if (typeOption) {
            md += `**${typeOption.label}:**\n\n`;
          }
        }

        const sortedItems = [...items].sort((a, b) => a.order - b.order);
        sortedItems.forEach((item: any) => {
          md += `- ${item.title}`;
          if (item.description) {
            md += `\n  ${item.description}`;
          }
          md += '\n';
        });
        md += '\n';
      }
    });
  }

  return md;
}

function convertArchitectureToMarkdown(content: any): string {
  let md = '';

  if (content.components && content.components.length > 0) {
    md += '**Components:**\n\n';
    content.components.forEach((comp: any) => {
      md += `- **${comp.name}** (${comp.type})\n`;
      if (comp.description) {
        md += `  ${comp.description}\n`;
      }
      if (comp.technologies && comp.technologies.length > 0) {
        md += `  Technologies: ${comp.technologies.join(', ')}\n`;
      }
    });
    md += '\n';
  }

  if (content.connections && content.connections.length > 0) {
    md += '**Connections:**\n\n';
    content.connections.forEach((conn: any) => {
      md += `- ${conn.from} → ${conn.to}`;
      if (conn.type) {
        md += ` (${conn.type})`;
      }
      if (conn.description) {
        md += `\n  ${conn.description}`;
      }
      md += '\n';
    });
    md += '\n';
  }

  if (content.technologies) {
    md += '**Technology Stack:**\n\n';
    const tech = content.technologies;

    if (tech.frontend?.length) md += `- **Frontend:** ${tech.frontend.join(', ')}\n`;
    if (tech.backend?.length) md += `- **Backend:** ${tech.backend.join(', ')}\n`;
    if (tech.database?.length) md += `- **Database:** ${tech.database.join(', ')}\n`;
    if (tech.cache?.length) md += `- **Cache:** ${tech.cache.join(', ')}\n`;
    if (tech.messaging?.length) md += `- **Messaging:** ${tech.messaging.join(', ')}\n`;
    if (tech.infrastructure?.length) md += `- **Infrastructure:** ${tech.infrastructure.join(', ')}\n`;
    if (tech.external?.length) md += `- **External Services:** ${tech.external.join(', ')}\n`;

    md += '\n';
  }

  return md;
}

// Helper functions

function getTemplateDisplayName(templateType: string): string {
  switch (templateType) {
    case 'system_design': return 'System Design';
    case 'ml_design': return 'ML System Design';
    case 'genai_design': return 'GenAI System Design';
    case 'product_design': return 'Product Design';
    case 'research': return 'Research Project';
    case 'custom': return 'Custom Project';
    default: return templateType;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// PDF EXPORT
// ============================================================================

export interface PDFExportOptions {
  includeTableOfContents?: boolean;
  includeMetadata?: boolean;
  includePageNumbers?: boolean;
  fontSize?: number;
  pageMargin?: number;
}

/**
 * Convert a project to PDF format
 * Returns a PDF document as a Uint8Array
 */
export async function exportToPDF(
  project: FlexibleProject,
  pages: ProjectPage[],
  options: PDFExportOptions = {}
): Promise<Uint8Array> {
  const {
    includeTableOfContents = true,
    includeMetadata = true,
    includePageNumbers = true,
    fontSize = 11,
    pageMargin = 50
  } = options;

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

  let currentPage = pdfDoc.addPage();
  let { width, height } = currentPage.getSize();
  let yPosition = height - pageMargin;

  // Helper function to add a new page when needed
  const checkAddPage = (requiredSpace: number = 60) => {
    if (yPosition < pageMargin + requiredSpace) {
      currentPage = pdfDoc.addPage();
      ({ width, height } = currentPage.getSize());
      yPosition = height - pageMargin;
      return true;
    }
    return false;
  };

  // Helper function to draw text with word wrapping
  const drawText = (
    text: string,
    options: {
      x?: number;
      size?: number;
      font?: any;
      color?: any;
      maxWidth?: number;
      bold?: boolean;
    } = {}
  ) => {
    const {
      x = pageMargin,
      size = fontSize,
      font = options.bold ? helveticaBold : helveticaFont,
      color = rgb(0, 0, 0),
      maxWidth = width - 2 * pageMargin
    } = options;

    const lines = wrapText(text, font, size, maxWidth);

    for (const line of lines) {
      checkAddPage();
      currentPage.drawText(line, {
        x,
        y: yPosition,
        size,
        font,
        color
      });
      yPosition -= size * 1.5;
    }
  };

  // Helper function to sanitize text for PDF (remove all non-printable ASCII)
  const sanitizeForPDF = (text: string): string => {
    return text
      .replace(/[^\x20-\x7E]/g, ' ') // Keep only printable ASCII characters
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  };

  // Helper function to wrap text
  const wrapText = (text: string, font: any, size: number, maxWidth: number): string[] => {
    const sanitized = sanitizeForPDF(text);

    if (!sanitized) return [''];

    const words = sanitized.split(' ').filter(w => w.length > 0);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      try {
        const testWidth = font.widthOfTextAtSize(testLine, size);

        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      } catch (error) {
        // If we still can't measure, skip this word
        console.warn('Failed to measure text:', testLine);
        continue;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  };

  // Title page
  currentPage.drawText(sanitizeForPDF(project.title), {
    x: pageMargin,
    y: yPosition,
    size: 24,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  yPosition -= 40;

  // Metadata
  if (includeMetadata) {
    const metadata = [
      `Project Type: ${getTemplateDisplayName(project.templateType)}`,
      `Status: ${project.metadata.status}`,
      `Last Updated: ${new Date(project.updatedAt).toLocaleDateString()}`
    ];

    for (const line of metadata) {
      currentPage.drawText(sanitizeForPDF(line), {
        x: pageMargin,
        y: yPosition,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3)
      });
      yPosition -= fontSize * 1.5;
    }
    yPosition -= 20;
  }

  // Description
  if (project.description) {
    drawText(project.description, { size: fontSize });
    yPosition -= 30;
  }

  // Divider line
  currentPage.drawLine({
    start: { x: pageMargin, y: yPosition },
    end: { x: width - pageMargin, y: yPosition },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  yPosition -= 40;

  // Table of Contents
  if (includeTableOfContents) {
    checkAddPage(100);

    currentPage.drawText('Table of Contents', {
      x: pageMargin,
      y: yPosition,
      size: 18,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    yPosition -= 30;

    const sortedPages = [...pages].sort((a, b) => a.order - b.order);

    sortedPages.forEach((page, index) => {
      checkAddPage();
      currentPage.drawText(sanitizeForPDF(`${index + 1}. ${page.title}`), {
        x: pageMargin + 10,
        y: yPosition,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0.2, 0.4, 0.8)
      });
      yPosition -= fontSize * 1.8;
    });

    yPosition -= 40;
    checkAddPage(100);

    // Divider
    currentPage.drawLine({
      start: { x: pageMargin, y: yPosition },
      end: { x: width - pageMargin, y: yPosition },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    });
    yPosition -= 40;
  }

  // Convert each page
  const sortedPages = [...pages].sort((a, b) => a.order - b.order);

  sortedPages.forEach((page, pageIndex) => {
    checkAddPage(100);

    // Page title
    currentPage.drawText(sanitizeForPDF(`${pageIndex + 1}. ${page.title}`), {
      x: pageMargin,
      y: yPosition,
      size: 16,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    yPosition -= 30;

    // Page description
    if (page.description) {
      drawText(page.description, { size: fontSize - 1, color: rgb(0.4, 0.4, 0.4) });
      yPosition -= 20;
    }

    // Convert sections
    const sortedSections = Object.values(page.sections || {}).sort((a, b) => a.order - b.order);

    sortedSections.forEach((section, sectionIndex) => {
      checkAddPage(80);

      // Section title
      currentPage.drawText(sanitizeForPDF(`${pageIndex + 1}.${sectionIndex + 1} ${section.title}`), {
        x: pageMargin,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1)
      });
      yPosition -= 25;

      // Convert section content to PDF
      convertSectionToPDF(section, {
        drawText,
        checkAddPage,
        currentPage,
        pageMargin,
        width,
        fontSize,
        helveticaFont,
        helveticaBold,
        courierFont
      });

      yPosition -= 30;
    });

    // Page separator
    yPosition -= 20;
  });

  // Add page numbers
  if (includePageNumbers) {
    const totalPages = pdfDoc.getPageCount();
    const pdfPages = pdfDoc.getPages();

    pdfPages.forEach((page: any, index: number) => {
      page.drawText(`Page ${index + 1} of ${totalPages}`, {
        x: width / 2 - 30,
        y: 30,
        size: 9,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5)
      });
    });
  }

  // Footer on last page
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText(`Generated from SystemDesigner.net on ${new Date().toLocaleDateString()}`, {
    x: pageMargin,
    y: 20,
    size: 8,
    font: helveticaFont,
    color: rgb(0.6, 0.6, 0.6)
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Convert a single section to PDF based on its type
 */
function convertSectionToPDF(
  section: PageSection,
  context: {
    drawText: any;
    checkAddPage: any;
    currentPage: any;
    pageMargin: number;
    width: number;
    fontSize: number;
    helveticaFont: any;
    helveticaBold: any;
    courierFont: any;
  }
): void {
  const { drawText } = context;
  const content = section.content;

  switch (content.type) {
    case 'text-editor':
      convertTextEditorToPDF(content, context);
      break;

    case 'code-editor':
      convertCodeEditorToPDF(content, context);
      break;

    case 'qa-pairs':
      convertQAPairsToPDF(content, context);
      break;

    case 'requirements':
      convertRequirementsToPDF(content, context);
      break;

    case 'calculations':
      convertCalculationsToPDF(content, context);
      break;

    case 'checklist':
      convertChecklistToPDF(content, context);
      break;

    case 'table':
      convertTableToPDF(content, context);
      break;

    case 'bullet-list':
      convertBulletListToPDF(content, context);
      break;

    case 'architecture':
      convertArchitectureToPDF(content, context);
      break;

    case 'whiteboard':
      drawText('[Whiteboard diagram - see original project for visual]', {
        color: rgb(0.5, 0.5, 0.5)
      });
      break;

    case 'rich-document':
      drawText('[Rich document content - see original project for full formatting]', {
        color: rgb(0.5, 0.5, 0.5)
      });
      break;

    default:
      drawText(`[${content.type} content - not yet supported in PDF export]`, {
        color: rgb(0.5, 0.5, 0.5)
      });
  }
}

// Section-specific PDF converters

function convertTextEditorToPDF(content: any, context: any): void {
  const { drawText } = context;

  if (content.interfaceMode === 'interview-qa' && content.qaPairs) {
    content.qaPairs.forEach((qa: any, index: number) => {
      drawText(`Q${index + 1}: ${qa.question}`, { bold: true });
      drawText(`A${index + 1}: ${qa.answer}`);
    });
  } else if (content.markdown) {
    // Simple markdown rendering - split by paragraphs and render each
    const plainText = content.markdown
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '');

    // Split by double newlines for paragraphs
    const paragraphs = plainText.split(/\n\n+/).filter((p: string) => p.trim().length > 0);

    paragraphs.forEach((paragraph: string) => {
      // Replace single newlines with spaces within paragraphs
      const cleaned = paragraph.replace(/\n/g, ' ').trim();
      if (cleaned) {
        drawText(cleaned);
      }
    });
  }
}

function convertCodeEditorToPDF(content: any, context: any): void {
  const { drawText, courierFont, fontSize } = context;

  if (content.examples && content.examples.length > 0) {
    content.examples.forEach((example: any) => {
      if (example.title) {
        drawText(example.title, { bold: true });
      }
      if (example.description) {
        drawText(example.description);
      }

      // Draw code with monospace font
      const codeLines = example.code.split('\n');
      codeLines.forEach((line: string) => {
        drawText(line, { font: courierFont, size: fontSize - 1 });
      });
    });
  }
}

function convertQAPairsToPDF(content: any, context: any): void {
  const { drawText } = context;

  if (content.pairs && content.pairs.length > 0) {
    content.pairs.forEach((pair: any, index: number) => {
      drawText(`Q${index + 1}: ${pair.question}`, { bold: true });
      drawText(`A${index + 1}: ${pair.answer}`);
    });
  }
}

function convertRequirementsToPDF(content: any, context: any): void {
  const { drawText } = context;

  if (content.functional && content.functional.length > 0) {
    drawText('Functional Requirements:', { bold: true });
    content.functional.forEach((req: any, index: number) => {
      drawText(`${index + 1}. ${req.title}${req.priority ? ` (${req.priority})` : ''}`);
      if (req.description) {
        drawText(`   ${req.description}`);
      }
    });
  }

  if (content.nonFunctional && content.nonFunctional.length > 0) {
    drawText('Non-Functional Requirements:', { bold: true });
    content.nonFunctional.forEach((req: any, index: number) => {
      drawText(`${index + 1}. ${req.title}${req.priority ? ` (${req.priority})` : ''}`);
      if (req.description) {
        drawText(`   ${req.description}`);
      }
    });
  }
}

function convertCalculationsToPDF(content: any, context: any): void {
  const { drawText } = context;

  if (content.calculations && content.calculations.length > 0) {
    content.calculations.forEach((calc: any) => {
      drawText(calc.title, { bold: true });
      if (calc.formula) {
        drawText(`Formula: ${calc.formula}`);
      }
      if (calc.result !== undefined) {
        drawText(`Result: ${calc.result}${calc.unit ? ' ' + calc.unit : ''}`, { bold: true });
      }
      if (calc.notes) {
        drawText(calc.notes, { color: rgb(0.4, 0.4, 0.4) });
      }
    });
  }
}

function convertChecklistToPDF(content: any, context: any): void {
  const { drawText } = context;

  if (content.items && content.items.length > 0) {
    content.items.forEach((item: any) => {
      const checkbox = item.completed ? '[x]' : '[ ]';
      drawText(`${checkbox} ${item.title}`);
      if (item.description) {
        drawText(`    ${item.description}`, { size: context.fontSize - 1 });
      }
    });
  }
}

function convertTableToPDF(content: any, context: any): void {
  const { drawText } = context;

  if (!content.headers || content.headers.length === 0) return;

  // Draw header
  drawText(content.headers.join(' | '), { bold: true });
  drawText('-'.repeat(50));

  // Draw rows
  if (content.rows && content.rows.length > 0) {
    content.rows.forEach((row: any) => {
      const cells = content.headers.map((header: string) => {
        const value = row.cells[header];
        return value !== undefined && value !== null ? String(value) : '';
      });
      drawText(cells.join(' | '));
    });
  }
}

function convertBulletListToPDF(content: any, context: any): void {
  const { drawText } = context;

  if (content.items && typeof content.items === 'object') {
    Object.entries(content.items).forEach(([_type, items]: [string, any]) => {
      if (Array.isArray(items) && items.length > 0) {
        const sortedItems = [...items].sort((a, b) => a.order - b.order);
        sortedItems.forEach((item: any) => {
          drawText(`• ${item.title}`);
          if (item.description) {
            drawText(`  ${item.description}`, { size: context.fontSize - 1 });
          }
        });
      }
    });
  }
}

function convertArchitectureToPDF(content: any, context: any): void {
  const { drawText } = context;

  if (content.components && content.components.length > 0) {
    drawText('Components:', { bold: true });
    content.components.forEach((comp: any) => {
      drawText(`• ${comp.name} (${comp.type})`);
      if (comp.description) {
        drawText(`  ${comp.description}`, { size: context.fontSize - 1 });
      }
    });
  }

  if (content.technologies) {
    drawText('Technology Stack:', { bold: true });
    const tech = content.technologies;
    if (tech.frontend?.length) drawText(`Frontend: ${tech.frontend.join(', ')}`);
    if (tech.backend?.length) drawText(`Backend: ${tech.backend.join(', ')}`);
    if (tech.database?.length) drawText(`Database: ${tech.database.join(', ')}`);
  }
}
