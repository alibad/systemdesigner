// Example of how to use SSR CodeBlock in a page component
import { CodeBlock } from '@/components/shared/CodeBlock';
import { loadCodeContent } from '@/lib/code-loader';
import { GetStaticProps } from 'next';

interface PageProps {
  codeContent: {
    orchestrator: { content: string; error?: string };
    dashboard: { content: string; error?: string };
  };
}

export default function ExamplePage({ codeContent }: PageProps) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
      <h1>Red Team Architecture Example</h1>

      {/* SSR CodeBlock with pre-loaded content */}
      <CodeBlock
        language="python"
        title="Red Team Orchestrator (Python)"
        file="/fundamentals/red-teaming-fundamentals/code/red_team_orchestrator.py"
        ssrContent={codeContent.orchestrator.content}
      />

      <CodeBlock
        language="typescript"
        title="Red Team Dashboard (TypeScript)"
        file="/fundamentals/red-teaming-fundamentals/code/red_team_dashboard.ts"
        ssrContent={codeContent.dashboard.content}
      />
    </div>
  );
}

// Server-side code loading
export const getStaticProps: GetStaticProps<PageProps> = async () => {
  // Load all code files at build time
  const codeFiles = {
    orchestrator: loadCodeContent('/fundamentals/red-teaming-fundamentals/code/red_team_orchestrator.py'),
    dashboard: loadCodeContent('/fundamentals/red-teaming-fundamentals/code/red_team_dashboard.ts'),
  };

  return {
    props: {
      codeContent: codeFiles,
    },
    // Regenerate the page at most once per hour
    revalidate: 3600,
  };
};

/*
 * BENEFITS OF THIS APPROACH:
 *
 * 1. ✅ CODE IS IN HTML: Code content is server-rendered into the HTML
 * 2. ✅ PERSISTENT HIGHLIGHTING: Browser can maintain text selections across refreshes
 * 3. ✅ BETTER SEO: Search engines can index the code content
 * 4. ✅ FASTER LOADING: No client-side fetch delays
 * 5. ✅ GRACEFUL FALLBACK: Still works if JavaScript is disabled
 * 6. ✅ SAME API: Existing CodeBlock usage mostly unchanged
 *
 * MIGRATION STEPS:
 *
 * 1. Add getStaticProps to pages with CodeBlock components
 * 2. Load code content server-side using loadCodeContent()
 * 3. Pass ssrContent prop to CodeBlock components
 * 4. Remove client-side file fetching (automatic fallback)
 */