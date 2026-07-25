# Contextual AI Generation - How It Works

## Overview

The AI generation system doesn't just create content in isolation - it **reads and understands all existing work** in your project to generate contextual, complementary content that builds upon what you've already created.

## The Problem We Solved

### Before: Isolated Generation
```
User creates "Requirements" page with functional requirements
↓
User creates "Architecture" page
↓
Clicks "Generate" on Architecture section
↓
AI generates generic architecture (no awareness of requirements)
❌ Result: Disconnected content, possible misalignment
```

### After: Contextual Generation
```
User creates "Requirements" page with specific functional requirements
↓
User creates "Architecture" page
↓
Clicks "Generate" on Architecture section
↓
AI reads Requirements page, understands the specific features
↓
AI generates architecture that directly addresses those requirements
✅ Result: Coherent, connected documentation
```

## How It Works: Step by Step

### 1. Content Analysis Phase

When you click the AI button, the system:

1. **Scans all pages** in the project
2. **Identifies real content** vs template placeholders
3. **Extracts summaries** of each section's content
4. **Filters out noise** (sample data, default text)

```typescript
// Example: Detecting real vs template content
function hasRealContent(content: SectionContent, type: SectionType): boolean {
  if (type === 'qa-pairs') {
    // Check if Q&A pairs aren't the default samples
    return pairs.some(p =>
      p.question !== 'Sample question?' &&
      p.answer !== 'Sample answer...'
    );
  }
  // ... similar checks for other types
}
```

### 2. Summary Extraction Phase

The system creates concise summaries of existing work:

**Q&A Section Summary:**
```
"What database should we use?; How do we handle caching?; What's the replication strategy?..."
```

**Checklist Section Summary:**
```
"Set up Redis cluster; Configure load balancer; Implement rate limiting..."
```

**Requirements Section Summary:**
```
"5 functional, 8 non-functional requirements"
```

### 3. Context Injection Phase

The AI prompt includes:

```
Project: Design a URL Shortener
Project Description: Build a scalable URL shortening service

=== CONTEXT FROM OTHER PAGES ===

Page: Requirements
Description: Functional and non-functional requirements
  - Clarifying Questions (qa-pairs): What's the expected scale?; Do we need analytics?; ...
  - Functional Requirements (requirements): 5 functional, 3 non-functional requirements
  - Scale Estimation (calculations): Daily active users; Storage needs; Bandwidth

Page: Design
  - High-Level Architecture (architecture): Components: API Gateway, Service Layer, Database...

=== CONTEXT FROM OTHER SECTIONS IN THIS PAGE ===
  - Component Details (text-editor): Detailed explanation of service layer components

Section to Generate: Database Design
Section Type: architecture

Based on ALL the context provided above, generate comprehensive database architecture
that addresses the scale requirements and functional needs already defined.
```

### 4. Intelligent Generation

The AI now generates content that:
- ✅ References the scale numbers from Calculations
- ✅ Addresses the functional requirements defined
- ✅ Complements the high-level architecture
- ✅ Builds on component details already discussed

## Real-World Example

### Scenario: Building a Chat Application Design

**Step 1: User creates "Requirements" page**
- Section: "Clarifying Questions" (Q&A)
  - Q: How many concurrent users?
  - A: 1 million daily active users, 100K concurrent

**Step 2: User creates "Scale" page**
- Section: "Back-of-Envelope Calculations" (calculations)
  - Message volume: 1M users × 50 messages/day = 50M messages/day
  - Storage: 50M × 1KB = 50GB/day

**Step 3: User generates "Database Design" section**

**What the AI receives:**
```
=== CONTEXT FROM OTHER PAGES ===
Page: Requirements
  - Clarifying Questions: How many concurrent users? (1M DAU, 100K concurrent); ...

Page: Scale
  - Calculations: Message volume (50M/day); Storage needs (50GB/day); ...

Generate database design that handles this scale...
```

**What the AI generates:**
```markdown
# Database Design

## Requirements-Driven Architecture

Based on the scale requirements (1M DAU, 50M messages/day, 50GB/day growth):

### Message Storage
- **Cassandra** for message storage (handles 50M writes/day)
- Partitioning by user_id for even distribution
- TTL-based cleanup for old messages

### User Data
- **PostgreSQL** for user profiles and metadata
- Read replicas to handle 100K concurrent connections

### Caching Layer
- **Redis** for online user presence
- Message cache for recent conversations (last 100 messages)

## Scaling Strategy
- Horizontal sharding when reaching 100GB/day
- Archive old messages to S3 after 90 days
```

Notice how it:
- References the specific numbers (1M DAU, 50M messages/day, 50GB/day)
- Chooses technologies appropriate for the scale
- Addresses the concurrent user requirement (100K)
- Plans for growth based on calculated storage needs

## Content Type Detection

### What Counts as "Real Content"

✅ **Real Content (included in context):**
- User-edited text that differs from templates
- Q&A pairs with actual questions/answers
- Checklists with specific tasks
- Requirements with real functional/non-functional items
- Calculations with actual numbers
- Code with real implementation

❌ **Template Content (filtered out):**
- "# Section Title\n\nStart writing..."
- "Sample question?" / "Sample answer..."
- "Sample task" in checklists
- Default code: `console.log("Hello, world!");`
- Empty or placeholder data

## Summary Formats by Section Type

### Q&A Pairs
```
"What's the expected scale?; How do we handle failures?; What about data consistency?..."
(First 3 questions, with ellipsis if more exist)
```

### Checklists
```
"Set up Redis cluster; Configure load balancer; Implement rate limiting..."
(First 3 items, with ellipsis if more exist)
```

### Requirements
```
"5 functional, 8 non-functional requirements"
```

### Calculations
```
"Daily active users; Storage estimation..."
(First 2 calculation titles)
```

### Code
```
"python: class URLShortener:..."
(Language + first line of code)
```

### Architecture
```
"Components: API Gateway, Service Layer, Cache..."
(First 3 component names)
```

### Tables
```
"Table with 4 columns, 12 rows"
```

## Benefits of Contextual Generation

### 1. Coherent Documentation
- All sections reference the same numbers and decisions
- Architecture aligns with requirements
- Calculations inform design choices

### 2. No Duplication
- AI knows what's been covered in other pages
- Generates complementary, not redundant content
- Builds upon existing discussions

### 3. Progressive Building
- Start with high-level (Requirements)
- Add detail (Scale Calculations)
- Generate specifics (Database Design)
- Each step informs the next

### 4. Smarter Suggestions
- AI understands the full project context
- Generates relevant questions in Q&A
- Suggests appropriate checklists
- Creates realistic calculations

## API Structure

### Section Generation with Context

```typescript
POST /api/generate-section
{
  projectTitle: "Design a URL Shortener",
  projectDescription: "...",
  pageTitle: "Architecture",
  pageDescription: "...",
  sectionTitle: "Database Design",
  sectionType: "architecture",

  // Contextual data
  otherPagesContent: [
    {
      title: "Requirements",
      description: "...",
      sections: [
        {
          title: "Clarifying Questions",
          type: "qa-pairs",
          content: { pairs: [...] },
          hasRealContent: true
        }
      ]
    }
  ],
  otherSectionsInPage: [
    {
      title: "High-Level Design",
      type: "text-editor",
      content: { markdown: "..." },
      hasRealContent: true
    }
  ]
}
```

### Page-Level Suggestions

```typescript
POST /api/generate-page
{
  projectTitle: "Design a URL Shortener",
  projectDescription: "...",
  pageTitle: "Deep Dive",
  pageDescription: "Detailed component design",

  existingSections: [
    { title: "API Design", type: "text-editor" }
  ],

  otherPagesContent: [
    // Same format as above
  ]
}

// Returns suggested sections:
[
  {
    title: "Database Schema",
    type: "table",
    description: "Design the database tables for URL mappings",
    priority: "high"
  },
  {
    title: "Caching Strategy",
    type: "text-editor",
    description: "Redis caching implementation details",
    priority: "high"
  }
]
```

## Future Enhancements

### Multi-Page Generation Flow
1. Generate all requirements sections
2. Use requirements to generate scale calculations
3. Use scale to generate architecture
4. Use architecture to generate implementation details

### Learning from Edits
- Track what users change after generation
- Learn patterns of good content
- Improve future generations

### Template Awareness
- Detect project templates being used
- Know which sections are standard
- Focus context on user-customized content

---

**Status**: ✅ Backend fully implemented, frontend integration in progress
**Last Updated**: 2025-10-05
