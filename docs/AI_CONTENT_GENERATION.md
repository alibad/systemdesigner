# AI Content Generation Feature

## Overview

The AI content generation feature helps users create comprehensive system design documentation by automatically generating content for different section types using GPT-4.

## How It Works

### User Flow

1. **Create a Project**: User starts with a project title and description
2. **Add Pages**: User creates pages within the project (e.g., "Requirements", "Architecture", "Design")
3. **Add Sections**: User adds sections to pages with different types (Q&A, Checklist, etc.)
4. **Generate Content**: User clicks the purple "AI" button with sparkles icon on any section
5. **Review & Edit**: AI-generated content appears in the section, automatically switching to edit mode
6. **Refine**: User can regenerate or manually edit the content

### Technical Architecture

#### API Endpoint: `/api/generate-section`

**Request Body**:
```typescript
{
  projectTitle: string;
  projectDescription: string;
  pageTitle: string;
  pageDescription?: string;
  sectionTitle: string;
  sectionType: SectionType;
  existingContent?: any;
  customInstructions?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  content: SectionContent; // Formatted for the specific section type
  rawContent: string; // Raw AI response
}
```

#### AI Prompting Strategy

The API route uses **context-aware prompting**:

1. **System Prompt**: Tailored to the section type
   - Q&A sections get instructions to generate interview-style questions
   - Checklists get instructions for actionable items
   - Requirements get instructions for functional/non-functional requirements

2. **User Prompt**: Includes full project context
   - Project title and description
   - Page title and description
   - Section title and type
   - Custom user instructions (optional)

3. **Content Formatting**: Parses AI output based on section type
   - JSON sections (Q&A, checklist) extract JSON from markdown code blocks
   - Text sections use markdown directly
   - Merges with existing content when appropriate

### Supported Section Types

Each section type has specialized generation logic:

#### Text-Based Sections
- **text-editor**: General markdown content with headings and formatting
- **rich-document**: Comprehensive detailed content

#### Structured Data Sections
- **qa-pairs**: Interview-style Q&A (5-8 pairs)
  - Generates: `{ question, answer }` pairs
  - Formats: Ordered array with IDs

- **checklist**: Actionable todo items (8-12 items)
  - Generates: `{ title, description, category }` items
  - Formats: Array with completion tracking

- **requirements**: Functional and non-functional requirements
  - Generates: Separate functional/non-functional arrays
  - Formats: Requirements with priority and acceptance criteria

- **calculations**: Back-of-envelope calculations
  - Generates: `{ title, formula, variables, result }` calculations
  - Formats: Array with calculation metadata

- **code-editor**: Well-commented code examples
  - Generates: Production-ready code
  - Formats: Code with language specification

- **architecture**: System components and relationships
  - Generates: Components, connections, layers
  - Formats: Structured architecture data

- **table**: Structured comparison tables
  - Generates: Headers and row data
  - Formats: Table schema with typed columns

- **metrics**: System KPIs and performance metrics
  - Generates: Metric definitions with targets
  - Formats: Metric objects with history

- **links**: External resources and references
  - Generates: Relevant documentation links
  - Formats: Link objects with metadata

#### Special Sections
- **whiteboard**: Generates description text for manual diagramming
- **timeline**: Project milestones and events
- **files**: Suggests relevant files to include

### UI Components

#### Generate Button
- **Location**: Section header toolbar
- **Icon**: Purple sparkles (✨) icon
- **States**:
  - Default: Purple sparkles + "AI" text
  - Loading: Spinning loader icon
  - Disabled: When project/page context is missing
- **Styling**: Purple accent color to indicate AI feature

#### Error Display
- **Location**: Above section content
- **Shows**: Error message with dismiss button
- **Styling**: Red background with error icon

### Content Merging

When generating content for sections with existing data:

1. **Appends New Items**: For Q&A pairs and checklists
2. **Preserves Settings**: Maintains user-configured section settings
3. **Generates Unique IDs**: Uses timestamp-based IDs for new items
4. **Maintains Order**: Adds new items after existing ones

### Best Practices

#### For Users
1. **Provide Context**: Better project/page descriptions = better AI output
2. **Review Generated Content**: Always review and edit AI-generated content
3. **Iterate**: Regenerate if content doesn't meet expectations
4. **Combine with Manual Editing**: Use AI as a starting point, refine manually

#### For Developers
1. **Keep Prompts Focused**: Each section type has specific prompt instructions
2. **Handle Errors Gracefully**: Show clear error messages
3. **Parse Robustly**: Handle both JSON and markdown output formats
4. **Preserve User Data**: Merge, don't replace, existing content
5. **Optimize Token Usage**: Use GPT-4 efficiently with focused prompts

### Environment Setup

Required environment variable:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### Future Enhancements

Potential improvements:
- [ ] Custom instructions input field
- [ ] Regenerate with modifications
- [ ] Generate entire pages at once
- [ ] Multi-step generation with refinement
- [ ] Support for other AI models (Claude, Gemini)
- [ ] Template-based generation
- [ ] Learning from user edits
- [ ] Batch generation for multiple sections

### Example Usage

```typescript
// In DynamicSectionRenderer component
const handleGenerateContent = async () => {
  setIsGenerating(true);

  const response = await fetch('/api/generate-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectTitle: 'Design a URL Shortener',
      projectDescription: 'Build a scalable URL shortening service like bit.ly',
      pageTitle: 'Requirements',
      pageDescription: 'Functional and non-functional requirements',
      sectionTitle: 'Clarifying Questions',
      sectionType: 'qa-pairs',
    }),
  });

  const data = await response.json();

  if (data.success) {
    handleContentUpdate(data.content);
    setIsEditing(true); // Allow user to review
  }

  setIsGenerating(false);
};
```

### Performance Considerations

- **API Call Duration**: 2-5 seconds for typical generation
- **Token Usage**: ~500-1000 tokens per section
- **Concurrent Requests**: Supported (each section independent)
- **Caching**: Not implemented (each generation is fresh)
- **Rate Limiting**: Uses OpenAI's built-in rate limits

### Error Handling

Common errors and solutions:

1. **Missing API Key**: Set `OPENAI_API_KEY` environment variable
2. **Context Missing**: Ensure project and page titles are provided
3. **JSON Parse Error**: API handles with fallback to markdown
4. **Rate Limit**: OpenAI automatically handles with exponential backoff
5. **Network Error**: Shows user-friendly error message with retry option

## Implementation Files

### Backend
- `/app/api/generate-section/route.ts` - Main API endpoint

### Frontend
- `/components/project/DynamicSectionRenderer.tsx` - Section component with AI button
- `/components/project/DynamicPageRenderer.tsx` - Page component passing context

### Types
- `/lib/project-data-model.ts` - Section type definitions

## Testing

Manual testing steps:
1. Create a new project
2. Add a page with description
3. Add a Q&A section
4. Click "AI" button
5. Verify content generated
6. Edit and save
7. Try regenerating
8. Test with different section types

---

**Last Updated**: 2025-01-05
**Feature Status**: ✅ Implemented and Ready for Testing
