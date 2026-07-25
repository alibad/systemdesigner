import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface GeneratePageRequestBody {
  projectTitle: string;
  projectDescription: string;
  pageTitle: string;
  pageDescription?: string;
  existingSections?: Array<{
    title: string;
    type: string;
  }>;
  otherPagesContent?: Array<{
    title: string;
    description?: string;
    sections: Array<{
      title: string;
      type: string;
      content: any;
      hasRealContent: boolean;
    }>;
  }>;
  customInstructions?: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured. Set OPENAI_API_KEY to use page generation.',
        },
        { status: 503 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body: GeneratePageRequestBody = await req.json();
    const {
      projectTitle,
      projectDescription,
      pageTitle,
      pageDescription,
      existingSections,
      otherPagesContent,
      customInstructions
    } = body;

    const systemPrompt = `You are an expert system design assistant. Your task is to suggest a comprehensive set of sections for a page in a system design document. Consider what sections would be most valuable for this specific page based on the project context and what content already exists in other pages.

Return a JSON array of section suggestions with this format:
[
  {
    "title": "Section Title",
    "type": "section-type",
    "description": "Brief description of what this section should contain",
    "priority": "high" | "medium" | "low"
  }
]

Available section types: text-editor, rich-document, qa-pairs, checklist, bullet-list, requirements, calculations, code-editor, architecture, table, timeline, metrics, files, links, whiteboard`;

    let userPrompt = `Project: ${projectTitle}\n`;
    if (projectDescription) {
      userPrompt += `Project Description: ${projectDescription}\n\n`;
    }

    // Add context from other pages
    if (otherPagesContent && otherPagesContent.length > 0) {
      const pagesWithContent = otherPagesContent.filter(page =>
        page.sections.some(s => s.hasRealContent)
      );

      if (pagesWithContent.length > 0) {
        userPrompt += `\n=== EXISTING PAGES WITH CONTENT ===\n`;
        pagesWithContent.forEach(page => {
          userPrompt += `\nPage: ${page.title}\n`;
          if (page.description) {
            userPrompt += `Description: ${page.description}\n`;
          }
          const sectionTitles = page.sections
            .filter(s => s.hasRealContent)
            .map(s => `${s.title} (${s.type})`)
            .join(', ');
          userPrompt += `Sections: ${sectionTitles}\n`;
        });
        userPrompt += `\n`;
      }
    }

    userPrompt += `\nPage to Generate Sections For: ${pageTitle}\n`;
    if (pageDescription) {
      userPrompt += `Page Description: ${pageDescription}\n`;
    }

    if (existingSections && existingSections.length > 0) {
      userPrompt += `\nExisting Sections in This Page:\n`;
      existingSections.forEach(section => {
        userPrompt += `  - ${section.title} (${section.type})\n`;
      });
    }

    if (customInstructions) {
      userPrompt += `\nAdditional Instructions: ${customInstructions}\n`;
    }

    userPrompt += `\nBased on the project context and existing content, suggest 5-8 additional sections that would make this page comprehensive and valuable. Focus on sections that:
1. Complement what already exists in other pages (don't duplicate)
2. Are relevant to this specific page's purpose
3. Follow a logical flow for system design documentation
4. Include a mix of different section types appropriate to the content

Return ONLY the JSON array, no additional text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const generatedContent = response.choices[0].message.content;

    if (!generatedContent) {
      throw new Error('No content generated');
    }

    // Parse the JSON response
    const jsonMatch = generatedContent.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) || generatedContent.match(/(\[[\s\S]*\])/);
    const jsonContent = jsonMatch ? jsonMatch[1] : generatedContent;

    try {
      const suggestions = JSON.parse(jsonContent);

      return NextResponse.json({
        success: true,
        suggestions: Array.isArray(suggestions) ? suggestions : [],
        rawContent: generatedContent
      });
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response',
        rawContent: generatedContent
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Page generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate page suggestions'
      },
      { status: 500 }
    );
  }
}
