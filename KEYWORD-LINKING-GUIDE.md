# Dynamic Keyword Linking System

A sophisticated system that automatically identifies and links relevant keywords in your content using the content registry as the source of truth.

## Overview

The keyword linking system intelligently:
- 🔍 **Extracts keywords** from content registry (titles, tags, SEO keywords)
- 🎯 **Matches keywords** in text content with smart relevance scoring
- 🔗 **Creates contextual links** to related content across all sections
- 🎨 **Applies visual styling** based on content sections and relevance
- ⚖️ **Balances link density** to avoid overwhelming readers

## Core Components

### 1. Keyword Extraction Engine (`/lib/keyword-linking.ts`)

**Key Functions:**
- `buildKeywordIndex()` - Creates searchable keyword database from content registry
- `findLinkableKeywords()` - Finds relevant keywords in text with configurable options
- `getRelatedContent()` - Suggests related content based on current page
- `buildGlossary()` - Creates comprehensive keyword glossary

**Features:**
- Automatic keyword extraction from titles, tags, and SEO metadata
- Intelligent variant generation (plurals, abbreviations, compound words)
- Smart relevance scoring based on multiple factors
- Conflict resolution to avoid overlapping links

### 2. React Components (`/components/`)

**SmartContent Components:**
- `SmartContent` - Wrapper that processes all child content
- `SmartParagraph` - Paragraph with limited keyword linking
- `SmartSection` - Section with enhanced linking for educational content
- `InlineKeywords` - Lightweight component for short text snippets
- `KeywordBadge` - Visual keyword badges with section colors

**ContentWithKeywords:**
- `ContentWithKeywords` - Core component that processes raw text
- `useKeywordSuggestions` - Hook for getting keyword suggestions

### 3. Advanced Hooks (`/hooks/useKeywordLinking.ts`)

- `useKeywordLinking` - Main hook for keyword functionality
- `useContentSuggestions` - Content recommendations and groupings
- `useKeywordGlossary` - Keyword glossary with filtering
- `useContentAnalysis` - Text analysis with statistics and insights
- `useContentNavigation` - Smart navigation suggestions
- `useContentEnhancement` - Content improvement recommendations

## Usage Examples

### Basic Text Enhancement

```tsx
import { SmartContent } from '@/components/SmartContent';

export function MyArticle() {
  return (
    <SmartContent enableKeywordLinking={true}>
      <p>
        System design involves load balancing, database optimization, 
        and microservices architecture. Understanding caching strategies 
        is crucial for scalable systems.
      </p>
    </SmartContent>
  );
}
```

### Advanced Configuration

```tsx
import { SmartParagraph } from '@/components/SmartContent';

export function TechnicalContent() {
  return (
    <SmartParagraph 
      maxKeywords={3}
      minRelevance={0.8}
      className="bg-blue-50 p-4 rounded"
    >
      API design principles include REST architecture, GraphQL schemas,
      and proper HTTP status codes for robust communication.
    </SmartParagraph>
  );
}
```

### Inline Keywords for UI Elements

```tsx
import { InlineKeywords } from '@/components/ContentWithKeywords';

export function SearchResult({ description }: { description: string }) {
  return (
    <div className="search-result">
      <p>
        <InlineKeywords 
          text={description}
          maxLinks={2}
          className="text-gray-600"
        />
      </p>
    </div>
  );
}
```

### Content Analysis Hook

```tsx
import { useContentAnalysis } from '@/hooks/useKeywordLinking';

export function ContentEditor({ content }: { content: string }) {
  const analysis = useContentAnalysis(content);
  
  return (
    <div>
      <div className="stats">
        <p>Keywords: {analysis.stats.totalKeywords}</p>
        <p>Link Density: {(analysis.stats.linkDensity * 100).toFixed(1)}%</p>
        <p>Avg Relevance: {(analysis.stats.avgRelevance * 100).toFixed(1)}%</p>
      </div>
      
      {analysis.suggestions.needsMoreLinks && (
        <div className="suggestion">
          💡 Consider adding more internal links to improve connectivity
        </div>
      )}
    </div>
  );
}
```

## Configuration Options

### KeywordConfig Interface

```typescript
interface KeywordConfig {
  maxLinksPerPage?: number;      // Default: 10
  minRelevanceScore?: number;    // Default: 0.5 (50%)
  excludeSameSection?: boolean;  // Default: false
  prioritizeSections?: string[]; // Sections to prioritize
  excludeSections?: string[];    // Sections to exclude
  caseSensitive?: boolean;       // Default: false
}
```

### Content Types & Recommended Configs

**Beginner Content (Conservative Linking):**
```typescript
{
  maxLinksPerPage: 3,
  minRelevanceScore: 0.8,
  excludeSameSection: true,
  prioritizeSections: ['fundamentals']
}
```

**Reference Material (Aggressive Linking):**
```typescript
{
  maxLinksPerPage: 15,
  minRelevanceScore: 0.4,
  excludeSameSection: false,
  prioritizeSections: ['technology', 'tools']
}
```

**Educational Content (Balanced):**
```typescript
{
  maxLinksPerPage: 7,
  minRelevanceScore: 0.6,
  excludeSameSection: false,
  prioritizeSections: ['fundamentals', 'technology']
}
```

## Visual Design System

### Section-Based Color Coding

- 🔵 **Fundamentals**: Blue theme - core concepts
- 🟣 **GenAI**: Purple theme - AI/ML topics  
- 🟢 **ML-Systems**: Green theme - engineering
- 🟠 **Technology**: Orange theme - tools/frameworks
- 🟦 **Case Studies**: Indigo theme - real-world examples
- 🩷 **Practice**: Pink theme - exercises
- ⚫ **Reference**: Gray theme - quick reference
- 🟦 **Tools**: Cyan theme - interactive tools

### Relevance-Based Styling

- **High Relevance (>80%)**: Full opacity, prominent styling
- **Medium Relevance (60-80%)**: Slightly reduced opacity
- **Low Relevance (50-60%)**: More subdued appearance

## Integration with Content Registry

The system leverages your existing content registry (`/lib/content-registry.ts`) to:

1. **Extract keywords** from titles, tags, and SEO metadata
2. **Generate variants** including abbreviations and alternative forms
3. **Calculate relevance** based on content relationships
4. **Respect content structure** (sections, prerequisites, related items)
5. **Maintain consistency** with your content organization

## Best Practices

### Content Creation
- Use descriptive titles that include key concepts
- Add relevant tags to content entries
- Include SEO keywords for discoverability
- Maintain clear content relationships (prerequisites, related)

### Link Density Guidelines
- **Blog posts**: 2-4% link density (2-4 links per 100 words)
- **Technical docs**: 4-6% link density  
- **Reference pages**: 6-10% link density
- **Landing pages**: 1-2% link density

### Performance Considerations
- Keyword index is built once per page load
- Text processing happens during render (cached with useMemo)
- Large text blocks are processed efficiently
- Component re-renders are minimized

## Troubleshooting

### Common Issues

**No keywords detected:**
- Check if content registry has matching entries
- Verify minimum relevance score isn't too high
- Ensure text contains recognizable keywords

**Too many links:**
- Reduce `maxLinksPerPage` setting
- Increase `minRelevanceScore` threshold
- Use `excludeSameSection: true` for focused linking

**Links to wrong content:**
- Review content registry relationships
- Adjust section priorities in config
- Check keyword extraction accuracy

### Performance Optimization

**For large content:**
```typescript
// Use lazy loading for heavy text processing
const { findKeywords } = useKeywordLinking({
  maxLinksPerPage: 5,  // Limit processing
  minRelevanceScore: 0.7  // Higher threshold
});
```

**For real-time editing:**
```typescript
// Debounce keyword analysis
const debouncedAnalysis = useMemo(() => 
  debounce(() => useContentAnalysis(content), 300), 
  [content]
);
```

## Future Enhancements

- **Machine learning relevance scoring** based on user interactions
- **A/B testing framework** for optimal link density
- **Analytics integration** to track link performance  
- **Content gap analysis** to identify missing connections
- **Automated content tagging** suggestions
- **Multi-language keyword support**

---

*This system provides intelligent content enhancement while maintaining full control over linking behavior and visual presentation.*