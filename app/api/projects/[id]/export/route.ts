import { NextRequest, NextResponse } from 'next/server';
import { exportToMarkdown, exportToPDF } from '@/lib/export-utils';
import { Project as FlexibleProject, ProjectPage } from '@/lib/project-data-model';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { format, project, pages } = await request.json();

    if (!project || !pages) {
      return NextResponse.json(
        { error: 'Project data and pages are required' },
        { status: 400 }
      );
    }

    // Generate export based on format
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'markdown':
        content = await exportToMarkdown(project, pages, {
          includeTableOfContents: true,
          includeMetadata: true,
          sectionNumbering: true
        });
        filename = `${slugify(project.title)}.md`;
        mimeType = 'text/markdown';
        break;

      case 'pdf':
        const pdfBytes = await exportToPDF(project, pages, {
          includeTableOfContents: true,
          includeMetadata: true,
          includePageNumbers: true
        });

        // Return PDF as binary
        return new NextResponse(Buffer.from(pdfBytes), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${slugify(project.title)}.pdf"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });


      default:
        return NextResponse.json(
          { error: 'Invalid format. Supported: markdown, pdf' },
          { status: 400 }
        );
    }

    // Return the file
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export project', details: error.message },
      { status: 500 }
    );
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
