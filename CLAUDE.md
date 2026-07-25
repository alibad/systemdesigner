# Claude Development Guidelines

> **Legacy implementation reference:** For current content authoring rules, use
> [`AGENTS.md`](./AGENTS.md) and [`docs/CONTENT_GUIDE.md`](./docs/CONTENT_GUIDE.md).
> Where this historical reference conflicts with either document, those current
> guides take precedence.

## Whiteboard & TLDraw Guidelines

### ⚠️ CRITICAL: NEVER Use `loadSnapshot()` on TLStore

**BANNED PATTERN:**
```typescript
// ❌ NEVER DO THIS - Will cause schema migration errors
const store = createTLStore();
store.loadSnapshot(snapshot); // BROKEN! Causes "Cannot convert undefined or null to object"
```

**CORRECT PATTERN:**
```typescript
// ✅ ALWAYS DO THIS - Pass snapshot directly to Tldraw component
<Tldraw snapshot={{ store: recordsMap }} />
```

**Why?**
- `store.loadSnapshot()` is deprecated and causes schema migration errors
- It tries to migrate undefined/null schema versions
- The `snapshot` prop on `<Tldraw>` handles initialization correctly
- Firestore records should be converted to object map: `{[id]: record}`

**PDF Export Pattern:**
```typescript
// Convert Firestore records array to object map
const recordsMap: Record<string, any> = {};
pageData.records.forEach((record: any) => {
  recordsMap[record.id] = record;
});

// Create sandboxed instance with snapshot prop
<Tldraw snapshot={{ store: recordsMap }} autoFocus={false}>
  <YourComponent />
</Tldraw>
```

## Educational Context Requirements

### Always Explain Before You Dive Deep

**CRITICAL PRINCIPLE**: Never assume users understand the concepts being discussed. Always provide context before explaining advanced details or trade-offs.

#### The "CAP Theorem Problem"
**❌ BAD EXAMPLE**: Starting with "CAP Theorem Trade-offs" and immediately showing Consistency/Availability/Partition tolerance without explaining what CAP theorem is.

**✅ GOOD EXAMPLE**:
1. **What is it?** - "CAP theorem states that distributed systems can only guarantee 2 out of 3 properties..."
2. **Why does it matter?** - "Since network partitions are inevitable, you must choose between consistency and availability"
3. **Then show the trade-offs** - Now users understand the context for the detailed comparisons

#### Mandatory Context Patterns

**For Every Technical Concept, ALWAYS Include:**

1. **Definition Section** - What is this concept?
```tsx
<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
  <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">What is [Concept]?</h3>
  <p className="text-amber-700 dark:text-amber-300 text-sm">
    Clear, concise explanation of the fundamental concept before diving into details.
  </p>
</div>
```

2. **Why It Matters** - Context for importance
3. **Core Principles** - The fundamental rules or constraints
4. **Then Deep Dive** - Detailed trade-offs, examples, implementations

#### Context Implementation Guidelines

**1. Start Every Major Section With Context**
```tsx
// GOOD: Every major concept gets an introduction
<section>
  <h2>Database Sharding</h2>

  {/* ALWAYS start with "What is it?" */}
  <div className="intro-card">
    <h3>What is Database Sharding?</h3>
    <p>Sharding horizontally partitions data across multiple database instances...</p>
  </div>

  {/* THEN dive into details */}
  <div className="sharding-strategies">...</div>
</section>
```

**2. Use Progressive Disclosure**
- Simple explanation first
- More technical details second
- Implementation examples last

**3. Link to Prerequisites**
```tsx
<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
  <p className="text-sm text-blue-700 dark:text-blue-300">
    <strong>💡 New to distributed systems?</strong> Start with our
    <a href="/fundamentals/distributed-systems-basics">Distributed Systems Basics</a> lesson first.
  </p>
</div>
```

#### Context Quality Standards

**MINIMUM REQUIREMENTS:**
- **15-30 seconds** of reading to understand the basic concept
- **No jargon** without explanation in the introduction
- **Clear examples** that relate to real-world scenarios
- **Visual hierarchy** that makes the introduction obvious

**QUALITY INDICATORS:**
- A complete beginner could understand the "What is it?" section
- The context explains WHY the concept matters before HOW it works
- Examples use familiar analogies (banking, social media, e-commerce)
- Technical terms are defined when first introduced

## Content Registry System

### Single Source of Truth
**LOCATION: `/lib/content-registry.ts`**

The content registry is the **authoritative source** for all content across the application. All navigation configs, layouts, sitemaps, and content relationships MUST be generated from this central registry.

#### What's in the Registry
- **291 content entries** across 8 sections: fundamentals, genai, ml-systems, technology, case-studies, practice, reference, tools
- **Complete metadata**: titles, durations, difficulty levels, prerequisites, related content, SEO data
- **Learning paths**: Automatic prerequisite chains and content sequencing
- **Deduplication handling**: Canonical URLs and duplicate content management
- **SEO optimization**: Meta descriptions, keywords, sitemap priorities

#### Core Functions
```typescript
// Essential functions for content management
getContentById(id: string): ContentNode | undefined
getContentBySection(section): ContentNode[]
getLearningPath(targetId: string): ContentNode[]
searchContent(query: string): ContentNode[]
validateContentRegistry(): ValidationResult
```

#### Usage Guidelines
1. **Always check the registry first** before creating navigation configs
2. **Never hardcode lesson sequences** - use `nextInSequence` from registry
3. **Add new content to registry** before creating page files
4. **Run validation** after any registry changes
5. **Update SEO data** when content changes

### Page Templates and Component Patterns

**CRITICAL**: All new lesson pages MUST follow established templates and component patterns:

#### Standard Lesson Page Template
**🎯 DEFAULT TEMPLATE: Use this wide layout for ALL lesson pages:**
- **ALL Fundamentals pages**
- **ALL GenAI pages**
- **ALL ML Systems pages**
- **ALL Technology pages**
```tsx
'use client';

import LessonHeader from '@/components/fundamentals/LessonHeader';
import { InteractiveQuiz } from '@/components/fundamentals/InteractiveLearning';
import { CodeBlock } from '@/components/shared/CodeBlock'; // Named import!

export default function MyLessonPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8"> {/* Standard wide layout for all lessons */}
      <LessonHeader
        title="Lesson Title"
        description="Brief description matching registry"
        duration="45 min"
        level="Intermediate"
        lessonSlug="lesson-slug"
        hasQuiz={true}
        category="genai" // or "ml-systems" or "technology"
      />

      <div className="space-y-8">
        {/* Use cards for sections */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Section Title</h2>
          {/* Content */}
        </section>

        {/* Code examples with external files */}
        <CodeBlock
          file="/api/content/genai/my-lesson/code/example.py"
          language="python"
          title="Example Implementation"
        />
      </div>

      {/* CRITICAL: Use Quiz Bank ID - All quizzes are centralized */}
      <div className="mt-12">
        <InteractiveQuiz
          title="Test Your Understanding"
          quizId="lesson-slug"  // Matches the lesson slug in quiz bank
        />
      </div>
    </div>
  );
}
```

#### Case Study Page Template
```tsx
import { InteractiveQuiz } from '@/components/fundamentals/InteractiveLearning';

export default function MyCaseStudyPage() {
  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6">
      <div className="space-y-8">
        {/* Case study content sections */}
      </div>

      {/* Use the same InteractiveQuiz component with quiz bank ID */}
      <div className="mt-12">
        <InteractiveQuiz
          title="Test Your Understanding"
          quizId="case-study-slug" // Loads from centralized quiz bank
        />
      </div>
    </main>
  );
}
```

#### Practice Problem Templates

**CRITICAL**: Practice problems follow three distinct formats based on the problem domain:

### **1. System Design Practice** (Traditional Distributed Systems)
```tsx
'use client';

import { useState } from 'react';

export default function SystemDesignPracticePage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('clarifying');

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      {/* Collapsible sections:
          1. Clarify Requirements
             • Functional: What the system must do (features, flows)
             • Non-functional: Scale, latency, throughput, reliability, consistency, security, cost
             • Scope: What's in vs out of scope; edge cases

          2. Define Scale & Constraints (Back-of-Envelope Calculations)
             • Estimate expected load: users, requests/sec, storage growth
             • Read vs write ratio, peak vs average
             • Latency and availability requirements
             • Cost or infrastructure constraints

          3. High-Level Architecture
             • Sketch main building blocks (client, API, services, DBs, cache, load balancers)
             • Show data flow through components
             • Identify synchronous vs asynchronous paths

          4. Data Model & Storage
             • Core entities and relationships
             • SQL vs NoSQL (and why)
             • Indexing, partitioning, sharding
             • Data growth and lifecycle

          5. Deep Dive on Key Components
             • Choose 1–2 critical pieces (e.g. cache, search, database, queue)
             • Explore design in detail: algorithms, APIs, storage choices
             • Trade-offs: performance vs consistency vs complexity

          6. Scalability & Reliability
             • Horizontal vs vertical scaling
             • Replication, partitioning
             • Fault tolerance, failover strategies
             • Graceful degradation, retries, fallback paths
             • Monitoring, logging, metrics, alerting

          7. Trade-offs & Alternatives
             • Compare possible designs
             • Justify choices based on requirements
             • Discuss cost, complexity, and operational burden

          8. Wrap-Up & Extensions
             • Summarise: how your design meets requirements
             • Call out unresolved risks or open questions
             • Suggest future improvements: new features, optimisations, or evolutions
      */}
    </div>
  );
}
```

### **2. ML Systems Practice** (Traditional ML + Analytics)
```tsx
'use client';

import { useState } from 'react';

export default function MLSystemsPracticePage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('clarifying');

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      {/* Collapsible sections:
          1. Clarify Requirements (ML problem, features, business context)
          2. Back-of-the-Envelope Calculations (Data volume, compute, costs)
          3. Framing as ML Problem (Problem type, input/output, success metrics)
          4. High-Level Architecture (Data pipelines, training, serving)
          5. Deep Dive - Critical Components (Model selection, feature engineering)
          6. Evaluation & Quality Assurance (ML metrics, A/B testing, monitoring)
          7. Operations & Production Deployment (Deployment, monitoring, retraining)
          8. Trade-offs & Future Extensions (Accuracy vs latency, scaling)
      */}
    </div>
  );
}
```

### **3. GenAI Systems Practice** (LLMs, RAG, Content Generation)
```tsx
'use client';

import { useState } from 'react';

export default function GenAISystemsPracticePage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('clarifying');

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      {/* Collapsible sections:
          1. Clarify Use Case & Requirements (Generation type, safety, model boundaries)
          2. Estimate Scale, Token Budget & Throughput (Token economics, infrastructure)
          3. High-Level Architecture & System Sketch (Components, data flow, model tiering)
          4. Deep Dive - Critical Components (RAG/Vector DB, prompt engineering, safety)
          5. Evaluation & Quality Assurance (GenAI metrics, safety evaluation, A/B testing)
          6. Trade-offs, Cost Control & Governance (Model vs cost, token optimization, safety)
          7. Scaling, Reliability & Operations (Deployment, monitoring, failure modes)
          8. Wrap-Up & Future Extensions (Summary, multimodal, agents, improvements)
      */}
    </div>
  );
}
```

#### **Practice Problem Categories**
- **System Design Practice**: Traditional distributed systems (URL shortener, chat systems, etc.)
- **ML Systems Practice**: Traditional ML and analytics systems (recommendation, fraud detection, data dashboards)
- **GenAI Systems Practice**: LLM-based systems (RAG, conversational AI, content generation)

**Note**: Removed "Product Design Practice" category - those problems are now categorized as ML Systems Practice.

#### Layout Templates for Navigation & Completion

**Practice Section Layout:**
```tsx
// /app/practice/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import LessonCompletion from '@/components/LessonCompletion';
import { generateLessonsConfig } from '@/lib/nav-generators';

const PRACTICE_CONFIG = generateLessonsConfig('practice');

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const lessonSlug = pathname.split('/').pop();
  const isPracticePage = pathname !== '/practice' && lessonSlug;
  const currentProblem = PRACTICE_CONFIG.find(item => item.slug === lessonSlug);

  return (
    <>
      {isPracticePage && (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-4 pb-0">
          <Link href="/practice" className="inline-flex items-center text-indigo-600 hover:text-indigo-700">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Practice Hub
          </Link>
        </div>
      )}
      {children}
      {isPracticePage && currentProblem && (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-4 pt-8">
          <LessonCompletion 
            lessonSlug={currentProblem.slug}
            category="practice"
            nextLessonUrl={currentProblem.next ? `/practice/${currentProblem.next}` : undefined}
            nextLessonTitle={currentProblem.next ? PRACTICE_CONFIG.find(p => p.slug === currentProblem.next)?.title : undefined}
          />
        </div>
      )}
    </>
  );
}
```

**Case Studies Layout:** (Similar structure for case studies with navigation and completion tracking)

#### Technology Page Template (MySQL Pattern)
**CRITICAL**: All technology entries follow the canonical MySQL pattern at `content/entries/technology/mysql/index.mdoc`, with its calculator isolated under `components/content-blocks/entries/technology/`.

**KEY REQUIREMENTS for Technology Pages:**
1. **Generalized shell**: The dynamic technology route owns the header, article wrapper, width, completion, and navigation.
2. **No manual page header**: The body starts with instructional content, not an `<h1>` or duplicated title.
3. **Section structure**: Use shared `section-card` tags rather than handwritten layout classes.
4. **Focused interactivity**: Calculators are typed `interactive-block` islands; prose never lives inside them.
5. **Required MySQL Template Sections** (must have at least these):
   - **Introduction Card**: "What is [Technology]?" as first section with technology overview
   - **Interactive Calculator**: Performance metrics with sliders and real-time calculations
   - **Real-World Examples**: Specific company implementations with concrete metrics  
   - **Best Practices**: Do/Don't sections with green/red styling
   - **Quiz**: Standard `quiz` tag at the end when registry-backed quiz data exists
6. **Additional Content**: Keep valuable existing content in addition to required sections
7. **Semantic emphasis**: Use shared callout tones instead of page-specific color systems
8. **Code Examples**: Use external files with the `code-block` tag

**Reference Implementation**: `content/entries/technology/mysql/index.mdoc`

#### Component Usage Rules
1. **Layout**: `GeneralizedContentPage` owns the section-specific shell and width.
2. **Lesson header**: The renderer supplies it from registry metadata; do not duplicate it in bodies.
3. **Quiz**: Use the universal `quiz` Markdoc tag with registry-backed data.
4. **Technology Entries**:
   - MUST follow MySQL template exactly
   - NO manual page headers or article wrapper (the renderer injects them)
   - MUST have "What is [Technology]?" introduction card as first section
5. **Practice Problems**: Use the shared accordion templates with requirements clarification and back-of-envelope calculations.
6. **Never** create custom quiz components; use the shared tag.
7. **Always** match the established content structure patterns

#### Literal Source Syntax
Put literal source syntax in inline code or fenced code blocks so Markdoc parses it as code rather than markup.

## External File Architecture System

### Overview
**CRITICAL**: All code examples and quizzes should be stored in external files rather than inline template literals to prevent JSX parsing issues and improve maintainability. Calculator components are shared React components in the `components/calculators/` directory.

### Directory Structure
Code, quiz, and data files are co-located with their canonical entry. Calculators are shared components or focused content blocks:

```
content/entries/
└── [section]/
    └── [lesson-slug]/
        ├── index.mdoc      # The lesson body
        └── code/           # Code examples (.py, .js, .yaml, .sql, etc.)
            ├── example1.py
            ├── config.yaml
            └── implementation.ts
        └── quiz/           # Quiz questions (.json)
            └── questions.json

components/
├── calculators/            # Reusable calculator components
└── content-blocks/entries/ # Route-specific focused islands
```

### Content Serving Architecture
**CRITICAL**: All co-located content files (code examples and quizzes) are served through the `/api/content/[...path]` API route. Calculator components are standard React components with direct imports.

- **API Route**: `/app/api/content/[...path]/route.ts`
- **Serves files from**: `content/entries/[section]/[lesson-slug]/code|quiz|data/`
- **Environment-aware caching**: Different cache settings for dev/staging/production
- **Content-Type detection**: Automatic MIME type detection for different file extensions
- **Calculator components**: Reused by typed content blocks and rendered with `interactive-block`

### API Route Implementation
**Location**: `/app/api/content/[...path]/route.ts`

The API route handles serving co-located content files with:
- **Path resolution**: Maps URL paths to canonical `content/entries/` files
- **MIME type detection**: Supports `.ts`, `.tsx`, `.py`, `.yaml`, `.xml`, `.json`, `.md` files
- **Environment-aware caching**:
  - **Development**: 5 minutes with `must-revalidate`
  - **Staging**: 1 hour with `must-revalidate` 
  - **Production**: 24 hours with `immutable`
- **Error handling**: Returns 404 for missing files with proper logging
- **Note**: Calculator components are NOT served via API route - use direct imports instead

**Example:**
```
content/entries/fundamentals/hybrid-multi-cloud-orchestration/
├── index.mdoc
└── code/
    ├── orchestration-engine.py
    └── service-mesh.yaml
```

### Why Co-located Structure?
1. **Better Organization**: Code files live next to their canonical lesson body
2. **TypeScript Exclusion**: Code files are excluded from compilation via tsconfig.json
3. **Maintainability**: Easier to find and update related files
4. **No Build Issues**: Prevents TypeScript compilation errors from content files

### TypeScript Configuration
**CRITICAL**: Code files in the `code/` directories are excluded from TypeScript compilation via `tsconfig.json`:

```json
{
  "exclude": [
    "node_modules",
    "content/entries/**/code/**/*"
  ]
}
```

This ensures that:
- Code examples don't cause TypeScript compilation errors
- Build process remains clean and fast
- Code files are treated as content, not executable code

### CodeBlock Usage (MANDATORY)

#### External file reference via API route:
```tsx
<CodeBlock
  file="/api/content/fundamentals/my-lesson/code/example.py"
  language="python"
  title="Example Implementation"
/>
```

**Note**: All code files are served through the `/api/content/` API route, which serves co-located files from `content/entries/` with environment-aware caching.

### CodeBlock Component Architecture

**Three specialized components for different use cases:**

#### 1. `CodeBlock` (Client-side Interactive)
- **File**: `components/shared/CodeBlock.tsx`
- **Usage**: Client components with full interactivity
- **Features**: Copy button, expand modal, Prism.js highlighting, hover effects
- **Content loading**: Fetches via `/api/content/` API route

#### 2. `SSRCodeBlock` (Server-side with Client Hydration)
- **File**: `components/shared/SSRCodeBlock.tsx`
- **Usage**: Server components or `getStaticProps` contexts
- **Features**: Pre-loads content server-side, then renders interactive `CodeBlock`
- **Content loading**: Uses `loadCodeContent()` server-side

#### 3. `ServerCodeBlock` (Pure Server-side Static)
- **File**: `components/shared/ServerCodeBlock.tsx`
- **Usage**: When you need static HTML without JavaScript
- **Features**: Plain HTML rendering, no client-side features
- **Content loading**: Uses `loadCodeContent()` server-side

**Selection Persistence**: The main `CodeBlock` component now preserves text selections during syntax highlighting.

### Quiz Bank Architecture (COMPLETED ✅)

**CRITICAL**: The application uses a centralized quiz bank system with 203 quizzes covering all topics.

#### Centralized Quiz Bank
**Location**: `/lib/quiz-bank/all-quizzes.json` - Single source of truth containing all 203 quizzes

#### Quiz Structure:
```json
{
  "topic-id": {
    "title": "Quiz Title",
    "section": "fundamentals",
    "difficulty": "intermediate",
    "duration": "10 min",
    "questions": [
      {
        "question": "What is the primary advantage?",
        "options": [
          "Option 1",
          "Option 2",
          "Option 3",
          "Option 4"
        ],
        "correctAnswer": 1,
        "explanation": "Detailed explanation here"
      }
    ]
  }
}
```

#### Usage Methods (In Order of Preference):

##### 1. Quiz Bank ID (RECOMMENDED - Use This!)
```tsx
<InteractiveQuiz
  title="Test Your Understanding"
  quizId="topic-id"  // Loads from centralized quiz bank
/>
```

##### 2. Co-located Quiz Files (Legacy Support)
```tsx
<InteractiveQuiz
  title="Test Your Understanding"
  questionsFile="/api/content/fundamentals/my-lesson/quiz/questions.json"
/>
```

##### 3. Inline Questions (Avoid - Only for Temporary Testing)
```tsx
<InteractiveQuiz
  title="Quick Test"
  questions={[...]}  // Direct array of questions
/>
```

**Status**: ✅ **100% Complete** - All 203 topics have quizzes in the centralized bank

### Calculator Architecture (Shared Components)

#### Calculator Component Structure:
```tsx
// components/calculators/PerformanceCalculator.tsx
'use client';

import { useState } from 'react';

export default function PerformanceCalculator() {
  const [dataSize, setDataSize] = useState(1000);
  const [processingTime, setProcessingTime] = useState(0);
  const [memoryCost, setMemoryCost] = useState(0);

  const calculateMetrics = (size: number) => {
    setProcessingTime(Math.round(size * 0.5));
    setMemoryCost(size * 2.5);
  };

  return (
    <div className="calculator-container bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-lg font-semibold mb-4">Performance Calculator</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Dataset Size: {dataSize} GB
          </label>
          <input
            type="range"
            min="1"
            max="10000"
            value={dataSize}
            onChange={(e) => {
              const newSize = parseInt(e.target.value);
              setDataSize(newSize);
              calculateMetrics(newSize);
            }}
            className="w-full"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-600 dark:text-gray-400">Processing Time</div>
            <div className="text-xl font-bold">{processingTime} minutes</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-600 dark:text-gray-400">Memory Cost</div>
            <div className="text-xl font-bold">${memoryCost.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### Usage in Content Entries

Reusable calculators stay in `components/calculators/`. Expose one through a focused
typed component in `components/content-blocks/entries/`, run
`pnpm generate:content-blocks`, then reference it from Markdoc:

```md
{% interactive-block id="fundamentals/performance-calculator" /%}
```

The generalized route owns the page shell; calculator components contain behavior only.

### Benefits of External File Architecture

1. **No JSX Parsing Issues**: Eliminates template literal problems with curly braces
2. **Better Maintainability**: Code examples can be syntax-checked independently
3. **Reusability**: 
   - Code examples can be referenced by multiple pages
   - Calculator components can be reused across lessons
4. **Version Control**: Easier to track changes to code examples and components
5. **IDE Support**: Full IDE support for external code files and TypeScript components
6. **Build Optimization**: 
   - Code examples served via API with caching
   - Calculator components bundled normally with full TypeScript support
7. **Clean Separation**: 
   - Content files (code, quizzes) co-located with lessons
   - Reusable components in shared directory

### Permanent Authoring Flow

1. **Add to content registry** first (`/lib/content-registry.ts`)
2. **Set `renderMode: 'mdoc'`** on the registry entry
3. **Create the body** at `content/entries/[section]/[lesson-slug]/index.mdoc`
4. **Create code directory** at `content/entries/[section]/[lesson-slug]/code/`
5. **Add code files** as needed for examples
6. **Reference code files** with `code-block file="/api/content/[section]/[lesson-slug]/code/filename.ext"`
7. **Never create** `app/[section]/[lesson-slug]/page.tsx`; section `[slug]` routes are shared.

#### File Naming Conventions:
- **Descriptive names**: `orchestration-engine.py` not `code1.py`
- **Proper extensions**: `.py`, `.js`, `.yaml`, `.sql`, `.json`, etc.
- **Kebab-case**: Use hyphens for multi-word files
- **Logical grouping**: Group related files by functionality

### Adding New Content

1. **Add to Registry First** (`/lib/content-registry.ts`)
   ```typescript
   {
     id: 'my-new-lesson',
     title: 'My New Lesson',
     path: '/fundamentals/my-new-lesson',
     section: 'fundamentals',
     level: 'intermediate',
     duration: '20 min',
     hasQuiz: true,
     prerequisites: ['prerequisite-lesson-id'],
     related: ['related-lesson-1', 'related-lesson-2'],
     nextInSequence: 'next-lesson-id',
     tags: ['tag1', 'tag2'],
     seo: {
       metaDescription: '150 char description...',
       keywords: ['keyword1', 'keyword2'],
       priority: 0.7,
       changeFreq: 'monthly',
       lastModified: new Date(),
     },
     status: 'active',
   }
   ```

2. **Create Page File** matching the registry path
3. **Update Layout** if needed (layouts should pull from registry)
4. **Validate** using `node scripts/validate-content-registry.cjs`

### Registry Validation

**Run validation before any commits:**
```bash
node scripts/validate-content-registry.cjs
```

**What validation checks:**
- Duplicate IDs and paths
- Invalid prerequisite references
- Invalid related content references
- Broken nextInSequence chains
- SEO description length (max 160 chars)
- Missing tags

### Quiz Bank Management

**Quiz Bank Location**: `/lib/quiz-bank/all-quizzes.json` (Single 357KB file with all 203 quizzes)

**Quiz API Route**: `/app/api/quiz-bank/[id]/route.ts`
- Serves quizzes from centralized bank
- Production-ready caching headers
- Automatic section discovery

**Quiz Hub**: `/app/quiz/page.tsx`
- Dynamic quiz discovery and search
- Inline quiz display without navigation
- Progress tracking and statistics

**Adding/Updating Quizzes**: Edit the centralized quiz bank file directly
```json
{
  "topic-id": {
    "title": "Quiz Title",
    "section": "fundamentals",
    "difficulty": "beginner|intermediate|advanced",
    "duration": "10 min",
    "questions": [...]
  }
}

### Section Organization

**Current Sections (Total: 203 entries with complete quiz coverage):**
- `fundamentals` (26 entries): Core system design concepts
- `genai` (32 entries): Generative AI and LLM topics
- `ml-systems` (28 entries): ML engineering and systems
- `technology` (67 entries): Specific tools and frameworks
- `case-studies` (10 entries): Real-world system examples
- `practice` (14 entries): Design exercises and problems with enhanced templates
- `reference` (14 entries): Quick reference and calculations
- `tools` (12 entries): Interactive calculators and tools

**Quiz Coverage**: ✅ 100% - All 203 topics have quizzes in `/lib/quiz-bank/all-quizzes.json`

**Enhanced Practice Problems:**
All practice problems follow structured interview approach:
1. **Clarifying Questions**: Realistic interviewer-candidate dialogue
2. **Back-of-Envelope**: Explicit calculations driving architecture decisions
3. **System Design**: High-level architecture, APIs, data models
4. **Deep Dive**: Critical component analysis with trade-offs
5. **Production Concerns**: Scaling, reliability, monitoring

**Navigation Requirements:**
Both `practice` and `case-studies` sections MUST include:
- Sub-navigation showing all problems/studies
- Completion tracking per item
- Progress indicators in hub pages
- Breadcrumb navigation back to hub
- Layout files similar to other learning modules

### Content Relationships

**Prerequisites**: Required knowledge before this content
**Related**: Complementary or related topics
**NextInSequence**: Next logical step in learning path
**CanonicalId**: Points to authoritative version (for duplicates)

### SEO Integration

The registry automatically generates:
- **Sitemap data** for search engines
- **Meta descriptions** and keywords
- **Canonical URLs** for duplicate content
- **Content statistics** and analytics

## Development Workflow

### CRITICAL RESTRICTIONS
- **NO AUTOMATED EDITS**: Never use scripting, find/replace, or automated tools to make bulk changes to files. All edits must be done manually through individual Edit tool calls.
- **NEVER RUN BUILD COMMANDS**: NEVER EVER run `pnpm dev`, `pnpm build`, or any build/dev commands without explicit user permission. User will handle all builds.
- **MANUAL VERIFICATION**: Always manually verify each file change individually rather than using automated processes.

### Before Making Content Changes
1. Check the content registry at `/lib/content-registry.ts`
2. Understand existing relationships and prerequisites
3. Plan where new content fits in learning paths
4. **AUDIT CONTEXT**: Review any section that explains concepts without introduction
   - Look for sections that jump into trade-offs, comparisons, or technical details
   - Add "What is [Concept]?" explanations where missing
   - Ensure progressive disclosure from simple → complex

### If User Needs Content Suggestions
*Research trending topics first using WebSearch for current industry trends:
- Search for "trending system design topics" for traditional distributed systems
- Search for "trending ML systems design machine learning infrastructure" for ML systems  
- Search for "GenAI trends generative AI architecture agentic AI" for GenAI topics
- Identify gaps in our content vs. current industry focus
- Prioritize topics that are actively discussed in the community

### When Adding New Features
1. Add content entries to registry first
2. Create canonical Markdoc bodies matching registry paths
3. Update any section-specific configs if needed
4. Test navigation and completion flows
5. Validate registry after changes

### Before Committing
1. Run `node scripts/validate-content-registry.cjs`
2. Fix any validation issues
3. Test affected navigation flows
4. Update changelog if significant changes

## File Structure Standards

### Content Pages
```
/content/entries/[section]/[slug]/index.mdoc
```

### Navigation Configs  
Generated from registry (future state)

### Validation Scripts
```
/scripts/validate-content-registry.cjs
```

## Key Commands

```bash
# Validate content registry
node scripts/validate-content-registry.cjs

# Type check registry
npx tsc --noEmit lib/content-registry.ts

# Find content by section
# Use registry functions in your code
```

---
## Lessons Learned (2025-08-30)

- **Educational Context is Critical** (2025-01-13)
  - **ALWAYS explain concepts before showing trade-offs** - Users need "What is CAP theorem?" before seeing C/A/P trade-offs
  - **Add context even for "basic" concepts** - Assume zero knowledge and build up progressively
  - **Use the amber intro card pattern** for "What is [Concept]?" explanations
  - **Look for sections that jump into details** without establishing foundation knowledge first

- Standardize shared components
  - Use `@/components/shared/CodeBlock` everywhere; avoid legacy paths like `@/components/ui/CodeBlock` or `@/components/CodeBlock`.
  - Pass code as children to `CodeBlock` instead of a deprecated `code` prop. Keep using `language` and optional `title`.

- JSX safety and content
  - Escape raw `\<` and `\>` inside JSX text (e.g., option labels) using `&lt;` and `&gt;` to prevent parse errors.
  - Keep technology pages aligned with the MySQL template: Interactive Calculator, Real-World Examples, Best Practices, and Quiz. Use `CodeBlock` for examples.

- TypeScript indexing patterns
  - When indexing typed object maps with a string key from component state, narrow the key: `const item = map[key as keyof typeof map]` to avoid implicit any errors.

- Build hygiene
  - Run `pnpm build` after changes to surface module-not-found and type errors early; iterate until clean.
  - Prefer fixing root causes (imports, API drift, typings) over suppressions.

- **LAYOUT WIDTH REQUIREMENTS** (CRITICAL):
  - **✅ STANDARD WIDE LAYOUT**: `max-w-[1200px] mx-auto px-4 md:px-6 py-8` **FOR ALL LESSON PAGES**:
    - **ALL Fundamentals** pages
    - **ALL GenAI** pages
    - **ALL ML Systems** pages
    - **ALL Technology** pages
  - **✅ WIDE LAYOUT** (no py-8): `max-w-[1200px] mx-auto px-4 md:px-6` **FOR**:
    - **Case Studies, Practice** (layout handles vertical padding)

**🎯 DEFAULT: USE WIDE LAYOUT `max-w-[1200px]` FOR ALL CONTENT**

- Quick checklist for similar PRs
  - [ ] **EDUCATIONAL CONTEXT**: Every concept has "What is [Concept]?" explanation before trade-offs/details
  - [ ] **CORRECT LAYOUT WIDTH**: Use `max-w-[1200px]` for all content (this is critical!)
  - [ ] **QUIZ IMPLEMENTATION**: Use `quizId` prop with centralized quiz bank (NOT inline questions)
  - [ ] **QUIZ SPACING**: Wrap `InteractiveQuiz` in `<div className="mt-12">` for proper spacing
  - [ ] **JSX text escaping**: Use `&lt;` and `&gt;` instead of raw `<` and `>` in JSX text (CRITICAL FOR COMPILATION)
  - [ ] **CONTENT FILE LOCATION**: Code files in `content/entries/[section]/[lesson-slug]/code/` directories (NOT in `app/` or `public/`)
  - [ ] **CODEBLOCK PATHS**: Use `file="/api/content/[section]/[lesson-slug]/code/filename.ext"` for external files
  - [ ] **CALCULATOR COMPONENTS**: Use direct imports from `@/components/calculators/ComponentName` (NOT API routes)
  - [ ] All `CodeBlock` imports are from `@/components/shared/CodeBlock` using **named import**: `import { CodeBlock} from ...`
  - [ ] No usage of `code=` prop on `CodeBlock`; children API used
  - [ ] Object map indexing uses `keyof` narrowing where needed
  - [ ] **NO manual `<h1>` headers in technology pages** (layout injects them automatically)
  - [ ] **NO separate CaseStudyQuiz component** - use `InteractiveQuiz` with `quizId` for all pages
  - [ ] Technology pages start with article wrapper and introduction card
  - [ ] Build is green locally before commit

## Dynamic Keyword Linking System

### Overview
**LOCATION: `/lib/keyword-linking.ts`**

The dynamic keyword linking system automatically detects keywords in content and creates intelligent links to related pages using the content registry as the source of truth.

#### Key Features
- **Automatic keyword detection** from content registry (titles, tags, SEO keywords)
- **Smart relevance scoring** based on content relationships and metadata
- **Self-link prevention** - pages never link to themselves
- **Section-based visual styling** with 8 distinct color themes
- **Configurable linking density** for different content types

#### Layout Integration
The system is integrated at the layout level for automatic enhancement:

```tsx
// Fundamentals layout
<SmartContent 
  enableKeywordLinking={isLessonPage} 
  keywordConfig={{
    maxLinksPerPage: 5,
    minRelevanceScore: 0.7,
    prioritizeSections: ['fundamentals', 'technology']
  }}
>
  {children}
</SmartContent>

// Technology layout  
<SmartContent 
  enableKeywordLinking={isLessonPage} 
  keywordConfig={{
    maxLinksPerPage: 7,
    minRelevanceScore: 0.6,
    prioritizeSections: ['fundamentals', 'technology', 'reference']
  }}
>
  {children}
</SmartContent>
```

#### Core Components
- **`SmartContent`** - Layout-level wrapper for automatic enhancement
- **`ContentWithKeywords`** - Granular control for specific text
- **`InlineKeywords`** - Lightweight component for UI elements
- **`useKeywordLinking`** - Hook for analysis and suggestions

#### Visual Design System
Section-based color coding:
- 🔵 **Fundamentals**: Blue - core concepts
- 🟣 **GenAI**: Purple - AI/ML topics
- 🟢 **ML-Systems**: Green - engineering
- 🟠 **Technology**: Orange - tools/frameworks
- 🟦 **Case Studies**: Indigo - real-world examples
- 🩷 **Practice**: Pink - exercises
- ⚫ **Reference**: Gray - quick reference
- 🟦 **Tools**: Cyan - interactive tools

#### Configuration Guidelines

**Conservative (Beginner Content):**
```typescript
{
  maxLinksPerPage: 3,
  minRelevanceScore: 0.8,
  excludeSameSection: true,
  prioritizeSections: ['fundamentals']
}
```

**Aggressive (Reference Material):**
```typescript
{
  maxLinksPerPage: 15,
  minRelevanceScore: 0.4,
  excludeSameSection: false,
  prioritizeSections: ['technology', 'tools']
}
```

#### Content Structure Requirements
For optimal keyword linking:
1. **Content registry relationships** must be bidirectional
2. **Proper learning progression** - fundamentals → reference → technology
3. **Clear prerequisite chains** for contextual relevance
4. **Descriptive titles and tags** for keyword extraction

#### Performance Considerations
- Keyword index built once per page load
- Text processing cached with useMemo
- Component re-renders minimized
- Large text blocks processed efficiently

#### Monitoring
Use content analysis hooks to monitor linking quality:
```typescript
const analysis = useContentAnalysis(text);
// Returns: stats, suggestions, topKeywords, lowRelevanceKeywords
```

---
*Last Updated: 2025-09-19*
*This system provides single source of truth for all content management*
*Centralized quiz bank system with 100% topic coverage (203 quizzes)*
*Dynamic keyword linking system integrated at layout level*
