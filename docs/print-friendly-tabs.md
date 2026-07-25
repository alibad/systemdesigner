# Print-Friendly Tabbed Content Implementation

## Problem
When users print pages with tabbed content, only the currently active tab gets printed. This means users miss important information from other tabs, which is particularly problematic for educational content where all tabs contain valuable information.

## Solution
We've implemented a dual-rendering approach that shows interactive tabs on screen but expands all tabs when printing.

## Implementation Pattern

### 1. Basic Structure
```tsx
function TabbedComponent({ tabs, selectedTab, setSelectedTab }) {
  return (
    <div className="container">
      {/* Interactive version for screen */}
      <div className="print:hidden">
        {/* Tab navigation */}
        <div className="tab-navigation">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setSelectedTab(index)}
              className={selectedTab === index ? 'active' : ''}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Active tab content */}
        <div className="tab-content">
          {tabs[selectedTab].content}
        </div>
      </div>

      {/* Print version - all tabs expanded */}
      <div className="hidden print:block space-y-6">
        {tabs.map((tab, index) => (
          <div
            key={index}
            className="border-t border-gray-300 pt-4 first:border-t-0 first:pt-0 page-break-inside-avoid"
          >
            <h3 className="text-lg font-semibold text-black mb-3">
              {index + 1}. {tab.title}
            </h3>
            <div className="text-gray-700">
              {tab.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. Using the Print Utility (Recommended)
```tsx
import { PrintFriendlyTabs } from '@/lib/print-utils';

function TabbedComponent({ tabs, selectedTab, setSelectedTab }) {
  return (
    <div className="container">
      {/* Tab navigation (hidden on print) */}
      <div className="print:hidden tab-navigation">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setSelectedTab(index)}
            className={selectedTab === index ? 'active' : ''}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <PrintFriendlyTabs
        items={tabs}
        activeIndex={selectedTab}
        renderTabContent={(tab, index) => (
          <div className="tab-content">
            {tab.content}
          </div>
        )}
        renderPrintContent={(tab, index) => (
          <>
            <h3 className="text-lg font-semibold text-black mb-3">
              {index + 1}. {tab.title}
            </h3>
            <div className="text-gray-700">
              {tab.content}
            </div>
          </>
        )}
      />
    </div>
  );
}
```

## Key CSS Classes

### Tailwind Classes for Print Control
- `print:hidden` - Hide element when printing
- `hidden print:block` - Show element only when printing
- `page-break-inside-avoid` - Prevent page breaks within element
- `break-inside-avoid` - Modern CSS equivalent
- `print:text-black` - Force black text for print
- `print:bg-white` - Force white background for print

### Print Section Separators
```css
.print-separator {
  @apply border-t border-gray-300 pt-4 first:border-t-0 first:pt-0;
}
```

## Real-World Example: ScenarioAnalysis Component

The `ScenarioAnalysis` component in `components/fundamentals/InteractiveLearning.tsx` demonstrates this pattern:

```tsx
export function ScenarioAnalysis({ title, description, scenarios }) {
  const [selectedScenario, setSelectedScenario] = useState(0);

  return (
    <div className="container">
      {/* Interactive version for screen */}
      <div className="print:hidden grid md:grid-cols-[1fr,2fr] gap-6">
        <div className="space-y-2">
          <h4>Scenarios</h4>
          {scenarios.map((scenario, index) => (
            <div
              key={index}
              onClick={() => setSelectedScenario(index)}
              className={selectedScenario === index ? 'active' : ''}
            >
              {scenario.name}
            </div>
          ))}
        </div>

        <div>
          {scenarios[selectedScenario] && (
            <ScenarioContent scenario={scenarios[selectedScenario]} />
          )}
        </div>
      </div>

      {/* Print version - all scenarios expanded */}
      <div className="hidden print:block">
        <div className="space-y-6">
          {scenarios.map((scenario, index) => (
            <div key={index} className="border-t border-gray-300 pt-4 first:border-t-0 first:pt-0">
              <h4 className="text-lg font-semibold text-black mb-3">
                {index + 1}. {scenario.name}
              </h4>
              <ScenarioContent scenario={scenario} printOptimized />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Print Optimization Best Practices

### 1. Typography
- Use black text (`text-black` or `print:text-black`)
- Avoid colored text that may not print well
- Use sufficient font sizes (12pt minimum)

### 2. Layout
- Remove shadows, gradients, and complex styling
- Use simple borders (`border-gray-300`)
- Ensure adequate spacing between sections
- Avoid page breaks in the middle of related content

### 3. Content Structure
- Number sections clearly (1., 2., 3...)
- Use descriptive headers for each tab/section
- Maintain logical content hierarchy
- Group related information together

### 4. Performance
- The print version renders all content, so be mindful of large datasets
- Consider lazy loading or pagination for very large tab sets
- Use `React.memo` for tab content if rendering is expensive

## Testing Print Layout

### Browser Testing
1. Open page in browser
2. Press `Ctrl+P` (Windows) or `Cmd+P` (Mac)
3. In print preview, verify:
   - All tabs are visible
   - Content is well-formatted
   - No UI elements are showing
   - Page breaks are appropriate

### Development Testing
```tsx
// Add temporary class to test print styles without printing
<div className="print">
  {/* Your component */}
</div>
```

```css
/* Add to CSS for testing */
.print {
  /* Apply all print: styles for visual testing */
}
```

## Compatibility

This approach works with:
- ✅ All modern browsers
- ✅ PDF generation tools
- ✅ Screen readers (maintains semantic structure)
- ✅ Mobile print functionality
- ✅ Server-side rendering

## Future Considerations

1. **Automatic Detection**: Could detect tabbed components automatically and apply print optimization
2. **Configuration**: Allow per-component print layout customization
3. **Content Summarization**: For very large tab sets, could offer summarized print views
4. **Print Stylesheets**: Extract print styles to separate CSS file for better performance

---

This implementation ensures users get complete information when printing while maintaining excellent interactive experience on screen.