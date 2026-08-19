import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SectionType } from '@/lib/project-data-model';

interface GenerateRequestBody {
  projectTitle: string;
  projectDescription: string;
  pageTitle: string;
  pageDescription?: string;
  sectionTitle: string;
  sectionType: SectionType;
  existingContent?: any;
  customInstructions?: string;
  // Contextual content from the project
  otherPagesContent?: Array<{
    title: string;
    description?: string;
    sections: Array<{
      title: string;
      type: string;
      content: any;
      hasRealContent: boolean; // Flag to indicate if this has user-created content
    }>;
  }>;
  otherSectionsInPage?: Array<{
    title: string;
    type: string;
    content: any;
    hasRealContent: boolean;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured. Set OPENAI_API_KEY to use section generation.',
        },
        { status: 503 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body: GenerateRequestBody = await req.json();
    const {
      projectTitle,
      projectDescription,
      pageTitle,
      pageDescription,
      sectionTitle,
      sectionType,
      existingContent,
      customInstructions,
      otherPagesContent,
      otherSectionsInPage
    } = body;

    // Build context-aware prompt based on section type
    const systemPrompt = getSystemPromptForSectionType(sectionType);
    const userPrompt = getUserPrompt({
      projectTitle,
      projectDescription,
      pageTitle,
      pageDescription,
      sectionTitle,
      sectionType,
      customInstructions,
      otherPagesContent,
      otherSectionsInPage
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-5.6-terra',
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 2000,
    });

    const generatedContent = response.choices[0].message.content;

    if (!generatedContent) {
      throw new Error('No content generated');
    }

    // Parse and format content based on section type
    const formattedContent = formatContentForSectionType(sectionType, generatedContent, existingContent);

    return NextResponse.json({
      success: true,
      content: formattedContent,
      rawContent: generatedContent
    });

  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate content'
      },
      { status: 500 }
    );
  }
}

function getSystemPromptForSectionType(sectionType: SectionType): string {
  const basePrompt = `You are an expert system design assistant helping users create comprehensive system design documentation. Your role is to generate high-quality, professional content for different sections of a system design document.`;

  const typeSpecificPrompts: Record<SectionType, string> = {
    'text-editor': `${basePrompt} Generate clear, well-structured markdown content with proper headings, bullet points, and formatting.`,
    'rich-document': `${basePrompt} Generate rich, detailed content suitable for a comprehensive document section.`,
    'qa-pairs': `${basePrompt} Generate relevant question-answer pairs that would be asked in a system design interview. Format as JSON array with "question" and "answer" fields.`,
    'bullet-list': `${basePrompt} Generate organized bullet points grouped by categories. Format as JSON with category keys containing arrays of items.`,
    'checklist': `${basePrompt} Generate actionable checklist items. Format as JSON array with "title", "description", and "category" fields.`,
    'requirements': `${basePrompt} Generate functional and non-functional requirements. Format as JSON with "functional" and "nonFunctional" arrays.`,
    'calculations': `${basePrompt} Generate back-of-envelope calculations for system scale estimation.

You MUST return a JSON array where each calculation has this EXACT structure:
{
  "title": "Storage Capacity Estimate",
  "formula": "Items × Size per Item × Replication Factor",
  "variables": {
    "Items": 1000000,
    "Size per Item": 5120,
    "Replication Factor": 3
  },
  "result": 15360000000,
  "unit": "bytes",
  "notes": "1M items × 5KB per item = 5GB raw data. With 3x replication for fault tolerance = 15GB total storage needed."
}

Include calculations for: storage, QPS/throughput, bandwidth, data volume, latency budgets, or cost estimates.
CRITICAL: Return ONLY the JSON array, no markdown formatting, no explanations outside the JSON.`,
    'code-editor': `${basePrompt} Generate well-commented code examples. Include language specification and best practices.`,
    'architecture': `${basePrompt} Generate system architecture components and their relationships. Format as JSON with components and connections.`,
    'table': `${basePrompt} Generate structured table data with the exact format:
{
  "headers": ["Column1", "Column2", "Column3"],
  "rows": [
    {
      "id": "row_1",
      "cells": {
        "Column1": "value1",
        "Column2": "value2",
        "Column3": "value3"
      }
    }
  ]
}
Each row MUST have an "id" field (use "row_1", "row_2", etc.) and a "cells" object where keys match the header names exactly.`,
    'whiteboard': `${basePrompt}

You are generating a system architecture diagram in TLDraw format. Create actual TLDraw shape objects (rectangles for components, arrows for connections).

CRITICAL: Return ONLY a valid JSON object with this EXACT structure:
{
  "shapes": {
    "shape:component1": {
      "id": "shape:component1",
      "type": "geo",
      "parentId": "page:page",
      "typeName": "shape",
      "index": "a1",
      "x": 100,
      "y": 100,
      "rotation": 0,
      "isLocked": false,
      "opacity": 1,
      "meta": {},
      "props": {
        "w": 150,
        "h": 80,
        "geo": "rectangle",
        "color": "blue",
        "labelColor": "black",
        "fill": "solid",
        "dash": "draw",
        "text": "Component Name",
        "font": "draw",
        "size": "m",
        "align": "middle",
        "verticalAlign": "middle",
        "growY": 0,
        "url": "",
        "scale": 1
      }
    }
  }
}

Layout guidelines:
- Clients/users: x: 50-100, y: 200
- API/Load Balancer: x: 300-400, y: 200
- Services: x: 550-700, y: 150-250
- Databases: x: 900-1000, y: 200
- Spacing: 150px between horizontal components
- Sizes: 150x80 for services, 120x60 for databases
- Arrows: x/y should connect centers, use start/end offsets

Colors: blue=clients, orange=APIs, green=databases, purple=cache, red=external`,
    'timeline': `${basePrompt} Generate project timeline with milestones. Format as JSON with events and milestones arrays.`,
    'metrics': `${basePrompt} Generate relevant system metrics and KPIs. Format as JSON array with metric objects.`,
    'links': `${basePrompt} Generate relevant external resources and references. Format as JSON array with link objects.`,
    'files': `${basePrompt} Suggest relevant files and documentation to include. Format as JSON array.`,
    'custom': `${basePrompt} Generate appropriate content based on the context provided.`
  };

  return typeSpecificPrompts[sectionType] || basePrompt;
}

function getUserPrompt(params: Omit<GenerateRequestBody, 'existingContent'>): string {
  const {
    projectTitle,
    projectDescription,
    pageTitle,
    pageDescription,
    sectionTitle,
    sectionType,
    customInstructions,
    otherPagesContent,
    otherSectionsInPage
  } = params;

  let prompt = `# SYSTEM DESIGN PROJECT CONTEXT\n\n`;
  prompt += `## Project Overview\n`;
  prompt += `**Title**: ${projectTitle}\n`;
  if (projectDescription) {
    prompt += `**Description**: ${projectDescription}\n\n`;
  }

  // Add template structure overview based on page descriptions
  if (otherPagesContent && otherPagesContent.length > 0) {
    prompt += `## Overall Project Structure (Follow This Workflow)\n`;
    prompt += `This project follows a structured approach with multiple stages:\n\n`;

    otherPagesContent.forEach((page, idx) => {
      prompt += `${idx + 1}. **${page.title}**`;
      if (page.description) {
        prompt += `: ${page.description}`;
      }
      prompt += `\n`;
    });
    prompt += `\n`;
  }

  // Add the current page context
  prompt += `## Current Page: "${pageTitle}"\n`;
  if (pageDescription) {
    prompt += `**Purpose**: ${pageDescription}\n\n`;
  }

  // Add section structure for the current page
  if (otherSectionsInPage && otherSectionsInPage.length > 0) {
    prompt += `### Sections in This Page (Complete Structure)\n`;
    prompt += `This page contains the following sections. Each has a specific purpose:\n\n`;

    otherSectionsInPage.forEach((section, idx) => {
      const isCurrentSection = section.title === sectionTitle;
      const marker = isCurrentSection ? '**→ YOU ARE GENERATING THIS**' : '';
      prompt += `${idx + 1}. **${section.title}** (${section.type}) ${marker}\n`;

      // Add purpose guidance for each section based on common patterns
      const purpose = getSectionPurpose(section.title, section.type, pageTitle);
      if (purpose) {
        prompt += `   Purpose: ${purpose}\n`;
      }

      // Show what content already exists
      if (section.hasRealContent) {
        const summary = extractContentSummary(section.content, section.type);
        prompt += `   Content: ${summary}\n`;
      } else if (!isCurrentSection) {
        prompt += `   Status: Not yet generated\n`;
      }
      prompt += `\n`;
    });
  }

  // Add context from other pages with real content
  if (otherPagesContent && otherPagesContent.length > 0) {
    const pagesWithContent = otherPagesContent.filter(page =>
      page.sections.some(s => s.hasRealContent)
    );

    if (pagesWithContent.length > 0) {
      prompt += `## Content from Previous Stages\n`;
      prompt += `Use this context to build upon what's already been defined:\n\n`;

      pagesWithContent.forEach(page => {
        prompt += `### ${page.title}\n`;
        const realSections = page.sections.filter(s => s.hasRealContent);
        realSections.forEach(section => {
          prompt += `- **${section.title}**: ${extractContentSummary(section.content, section.type)}\n`;
        });
        prompt += `\n`;
      });
    }
  }

  // The generation task
  prompt += `---\n\n`;
  prompt += `## YOUR TASK: Generate "${sectionTitle}"\n`;
  prompt += `**Type**: ${sectionType}\n\n`;

  // Add specific focus for this section
  const sectionFocus = getSectionFocus(sectionTitle, sectionType, pageTitle);
  if (sectionFocus) {
    prompt += `**Focus for This Section**:\n${sectionFocus}\n\n`;
  }

  if (customInstructions) {
    prompt += `**Additional Instructions**: ${customInstructions}\n\n`;
  }

  prompt += `**Requirements**:\n`;
  prompt += `1. Build upon the context from previous stages (don't duplicate information)\n`;
  prompt += `2. Stay focused on this section's specific purpose within "${pageTitle}"\n`;
  prompt += `3. Generate comprehensive, professional content appropriate for a system design interview\n`;
  prompt += `4. Ensure your content complements other sections in this page (don't overlap)\n\n`;

  // Add type-specific instructions
  const typeInstructions: Partial<Record<SectionType, string>> = {
    'qa-pairs': '5. Create 5-8 interview-style questions with detailed, technical answers\n6. Format as JSON: [{"question": "...", "answer": "..."}]',
    'bullet-list': '5. Organize items into logical categories (functional, non-functional, out-of-scope, etc.)\n6. Format as JSON with category keys containing arrays of items',
    'checklist': '5. Create 8-12 actionable items with clear descriptions\n6. Format as JSON: [{"title": "...", "description": "...", "category": "..."}]',
    'requirements': '5. Include both functional requirements (features) and non-functional requirements (performance, scalability, reliability, security)\n6. Format as JSON with "functional" and "nonFunctional" arrays',
    'calculations': `5. Generate 3-6 back-of-envelope calculations relevant to this system (e.g., Storage Size, QPS, Bandwidth, Latency, Data Volume, Cost Estimates)
6. Each calculation MUST have:
   - title: descriptive name (e.g., "Daily Active Users (DAU)")
   - formula: mathematical formula (e.g., "Total Users × Active Rate")
   - variables: object with variable names and values (e.g., {"Total Users": 1000000, "Active Rate": 0.2})
   - result: calculated number (e.g., 200000)
   - unit: measurement unit (e.g., "users", "GB", "QPS", "requests/day")
   - notes: step-by-step explanation showing your work
7. Format as JSON array: [{"title": "...", "formula": "...", "variables": {...}, "result": 123, "unit": "...", "notes": "..."}]
8. Base calculations on the scale and requirements mentioned in other sections`,
    'code-editor': '5. Provide well-commented, production-ready code examples\n6. Include error handling and best practices',
    'architecture': '5. Define key system components, their responsibilities, and how they interact\n6. Format as JSON with components and connections',
    'table': `5. Create a comparison table or data structure relevant to the section topic
6. Format as JSON with this EXACT structure:
   {
     "headers": ["Column1", "Column2", "Column3"],
     "rows": [
       {
         "id": "row_1",
         "cells": {
           "Column1": "value1",
           "Column2": "value2",
           "Column3": "value3"
         }
       }
     ]
   }
7. Each row MUST have:
   - An "id" field with unique identifier (row_1, row_2, etc.)
   - A "cells" object where keys EXACTLY match the header names
8. Do NOT use a simple 2D array - use this object structure`,
    'text-editor': '5. Use clear markdown formatting with headings, bullet points, and emphasis\n6. Be specific and technical where appropriate',
  };

  if (typeInstructions[sectionType]) {
    prompt += typeInstructions[sectionType];
  }

  return prompt;
}

// Helper to determine the purpose of a section based on its title and context
function getSectionPurpose(sectionTitle: string, sectionType: string, pageTitle: string): string {
  const title = sectionTitle.toLowerCase();

  // ML-specific sections
  if (title.includes('ml task') || title.includes('formulation')) {
    return 'Define the ML problem type (classification/regression/ranking/etc.) and frame it as a concrete ML task';
  }
  if (title.includes('success metric') || title.includes('ml evaluation')) {
    return 'Define how to measure model success (accuracy, precision, recall, F1, AUC, etc.) and business impact';
  }
  if (title.includes('data') && pageTitle.toLowerCase().includes('data')) {
    return 'Specify data sources, volume, features, labeling strategy, and data pipeline requirements';
  }
  if (title.includes('model') && title.includes('development')) {
    return 'Describe model architecture choices, training approach, hyperparameter tuning, and experimentation strategy';
  }

  // System design sections
  if (title.includes('clarifying') || title.includes('question')) {
    return 'Ask questions to narrow scope, understand requirements, and clarify ambiguities';
  }
  if (title.includes('requirement') && !title.includes('non-functional')) {
    return 'List core features the system must support and constraints';
  }
  if (title.includes('functional') && title.includes('non')) {
    return 'Define performance, scalability, reliability, and availability requirements (CAP, latency SLAs, throughput)';
  }
  if (title.includes('calculation') || title.includes('envelope')) {
    return 'Estimate scale: storage needs, bandwidth, QPS, throughput - use concrete numbers to drive architecture';
  }
  if (title.includes('api') || title.includes('interface')) {
    return 'Define the public API contracts: endpoints, request/response formats, protocols';
  }
  if (title.includes('data model') || title.includes('database')) {
    return 'Design database schema, indexing strategy, and data storage approach (SQL vs NoSQL)';
  }
  if (title.includes('architecture') || title.includes('high-level') || title.includes('component')) {
    return 'Draw the big picture: major components, how they connect, data flow, and why this architecture';
  }
  if (title.includes('deep dive')) {
    return 'Zoom into 1-2 critical components and explain algorithms, data structures, and trade-offs in detail';
  }
  if (title.includes('scale') || title.includes('bottleneck')) {
    return 'Identify bottlenecks, discuss horizontal/vertical scaling, caching, load balancing, and replication strategies';
  }
  if (title.includes('trade-off') || title.includes('alternative')) {
    return 'Compare design choices, justify decisions, discuss consistency vs availability, SQL vs NoSQL, etc.';
  }

  return '';
}

// Helper to provide specific focus guidance for the section being generated
function getSectionFocus(sectionTitle: string, sectionType: string, pageTitle: string): string {
  const title = sectionTitle.toLowerCase();

  if (title.includes('success metric')) {
    return `Focus on defining concrete, measurable metrics for both ML model performance (offline metrics like AUC, precision/recall) and business impact (online metrics like user engagement, revenue). Explain why these metrics matter for this specific problem. If there are trade-offs between metrics (e.g., precision vs recall), discuss them.`;
  }
  if (title.includes('ml task')) {
    return `Clearly state what ML task type this is (e.g., "binary classification to predict duplicate vs not-duplicate"). Define inputs (features) and outputs (labels). Explain why this formulation makes sense for the business problem.`;
  }
  if (title.includes('data')) {
    return `Specify concrete data requirements: sources, volume estimates, feature engineering needs, labeling strategy. Discuss data quality concerns specific to this problem (e.g., class imbalance, noisy labels).`;
  }
  if (title.includes('calculation') || title.includes('estimate') || title.includes('scale') || title.includes('envelope')) {
    return `Generate concrete back-of-envelope calculations with real numbers. For each calculation:
1. State assumptions explicitly (e.g., "Assume 1M daily active users")
2. Show the formula (e.g., "QPS = DAU × Actions per User / 86400")
3. Define all variables with realistic values
4. Calculate the result with proper units
5. Add notes explaining your reasoning and showing step-by-step work

Common calculations to include:
- Data Volume: How much data will be stored/processed?
- QPS/Throughput: Requests per second the system must handle
- Bandwidth: Network capacity needed (upload/download)
- Storage: Total storage capacity required (with replication)
- Latency Budget: Time allocation for each component
- Cost Estimates: Infrastructure costs at scale

Base your numbers on the requirements and context from other sections. These calculations should drive architectural decisions like "we need a distributed cache because QPS > 10K".`;
  }
  if (title.includes('architecture')) {
    return `Show how components work together to deliver the core functionality. Explain data flow, explain why this structure makes sense given the requirements. Don't just list components - explain their purpose and interactions.`;
  }

  return '';
}

// Helper function to extract meaningful content summaries
function extractContentSummary(content: any, type: string): string {
  try {
    switch (type) {
      case 'qa-pairs':
        if (content.pairs && Array.isArray(content.pairs)) {
          const questions = content.pairs.map((p: any) => p.question).slice(0, 3);
          return questions.length > 0 ? questions.join('; ') + (content.pairs.length > 3 ? '...' : '') : 'No content';
        }
        break;

      case 'text-editor':
      case 'rich-document':
        if (content.markdown) {
          const summary = content.markdown.replace(/#/g, '').trim().slice(0, 200);
          return summary || 'No content';
        }
        if (content.editorState) {
          return 'Rich content (Lexical editor)';
        }
        break;

      case 'checklist':
        if (content.items && Array.isArray(content.items)) {
          const items = content.items.map((i: any) => i.title).slice(0, 3);
          return items.length > 0 ? items.join('; ') + (content.items.length > 3 ? '...' : '') : 'No items';
        }
        break;

      case 'bullet-list':
        if (content.items) {
          const allItems: string[] = [];
          Object.values(content.items).forEach((categoryItems: any) => {
            if (Array.isArray(categoryItems)) {
              categoryItems.forEach((item: any) => allItems.push(item.title));
            }
          });
          const preview = allItems.slice(0, 3).join('; ');
          return preview + (allItems.length > 3 ? '...' : '');
        }
        break;

      case 'requirements':
        if (content.functional || content.nonFunctional) {
          const funcCount = content.functional?.length || 0;
          const nfCount = content.nonFunctional?.length || 0;
          return `${funcCount} functional, ${nfCount} non-functional requirements`;
        }
        break;

      case 'calculations':
        if (content.calculations && Array.isArray(content.calculations)) {
          const calcs = content.calculations.map((c: any) => c.title).slice(0, 2);
          return calcs.join('; ') + (content.calculations.length > 2 ? '...' : '');
        }
        break;

      case 'code-editor':
        if (content.code) {
          const preview = content.code.trim().split('\n')[0];
          return `${content.language || 'code'}: ${preview}...`;
        }
        break;

      case 'architecture':
        if (content.components) {
          const compNames = content.components.map((c: any) => c.name).slice(0, 3);
          return `Components: ${compNames.join(', ')}` + (content.components.length > 3 ? '...' : '');
        }
        break;

      case 'table':
        if (content.headers && content.rows) {
          return `Table with ${content.headers.length} columns, ${content.rows.length} rows`;
        }
        break;

      default:
        return 'Content available';
    }
  } catch (error) {
    console.error('Error extracting summary:', error);
  }

  return 'Content available';
}

function formatContentForSectionType(
  sectionType: SectionType,
  generatedContent: string,
  existingContent?: any
): any {
  try {
    // For types that expect JSON, try to parse it
    if (['qa-pairs', 'bullet-list', 'checklist', 'requirements', 'calculations', 'architecture', 'table', 'metrics', 'links', 'whiteboard'].includes(sectionType)) {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = generatedContent.match(/```(?:json)?\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : generatedContent;

      try {
        const parsed = JSON.parse(jsonContent);

        // Special handling for whiteboard - return TLDraw shapes directly
        if (sectionType === 'whiteboard') {
          return {
            type: 'whiteboard',
            snapshots: parsed.shapes || parsed, // Support both {shapes: {...}} and direct shape object
            diagramType: 'tldraw'
          };
        }

        return mergeWithExisting(sectionType, parsed, existingContent);
      } catch (parseError) {
        console.error('Failed to parse JSON, using raw content:', parseError);
        // Fallback to text-based content
        return {
          type: sectionType,
          markdown: generatedContent,
          format: 'markdown'
        };
      }
    }

    // For text-based sections, return as markdown
    return {
      type: sectionType,
      markdown: generatedContent,
      format: 'markdown'
    };
  } catch (error) {
    console.error('Error formatting content:', error);
    return {
      type: sectionType,
      markdown: generatedContent,
      format: 'markdown'
    };
  }
}

function mergeWithExisting(sectionType: SectionType, newContent: any, existingContent?: any): any {
  if (!existingContent) {
    return formatNewContent(sectionType, newContent);
  }

  // Merge logic based on section type
  switch (sectionType) {
    case 'qa-pairs':
      return {
        type: 'qa-pairs',
        pairs: [
          ...(existingContent.pairs || []),
          ...(Array.isArray(newContent) ? newContent.map((item: any, idx: number) => ({
            id: `qa_${Date.now()}_${idx}`,
            question: item.question,
            answer: item.answer,
            order: (existingContent.pairs?.length || 0) + idx
          })) : [])
        ],
        settings: existingContent.settings || {
          questionLabel: 'Question',
          answerLabel: 'Answer',
          sectionTitle: 'Q&A Section',
          allowReordering: true,
          maxPairs: 20
        }
      };

    case 'checklist':
      return {
        type: 'checklist',
        items: [
          ...(existingContent.items || []),
          ...(Array.isArray(newContent) ? newContent.map((item: any, idx: number) => ({
            id: `check_${Date.now()}_${idx}`,
            title: item.title,
            description: item.description,
            completed: false,
            category: item.category
          })) : [])
        ],
        categories: [...new Set([...(existingContent.categories || []), ...newContent.map((item: any) => item.category).filter(Boolean)])]
      };

    default:
      return formatNewContent(sectionType, newContent);
  }
}

function formatNewContent(sectionType: SectionType, content: any): any {
  switch (sectionType) {
    case 'qa-pairs':
      return {
        type: 'qa-pairs',
        pairs: Array.isArray(content) ? content.map((item: any, idx: number) => ({
          id: `qa_${Date.now()}_${idx}`,
          question: item.question,
          answer: item.answer,
          order: idx
        })) : [],
        settings: {
          questionLabel: 'Question',
          answerLabel: 'Answer',
          sectionTitle: 'Q&A Section',
          allowReordering: true,
          maxPairs: 20
        }
      };

    case 'checklist':
      return {
        type: 'checklist',
        items: Array.isArray(content) ? content.map((item: any, idx: number) => ({
          id: `check_${Date.now()}_${idx}`,
          title: item.title,
          description: item.description,
          completed: false,
          category: item.category
        })) : [],
        categories: Array.isArray(content) ? [...new Set(content.map((item: any) => item.category).filter(Boolean))] : []
      };

    case 'calculations':
      // Handle calculations - ensure it's an array of calculation objects
      const calculationsArray = Array.isArray(content) ? content : (content.calculations || []);
      return {
        type: 'calculations',
        calculations: calculationsArray.map((calc: any, idx: number) => ({
          id: calc.id || `calc_${Date.now()}_${idx}`,
          title: calc.title || 'Untitled Calculation',
          formula: calc.formula || '',
          variables: calc.variables || {},
          result: calc.result || 0,
          unit: calc.unit || '',
          notes: calc.notes || ''
        }))
      };

    default:
      // Always ensure type is set for all content
      return {
        type: sectionType,
        ...content
      };
  }
}
