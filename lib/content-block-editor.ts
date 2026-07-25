import Markdoc from '@markdoc/markdoc';

export interface EditableContentBlock {
  id: string;
  index: number;
  kind: string;
  label: string;
  start: number;
  end: number;
  startLine: number;
  source: string;
}

export interface ContentBlockTemplate {
  id: string;
  label: string;
  description: string;
  source: string;
}

export interface ParsedContentBlocks {
  prefix: string;
  blocks: EditableContentBlock[];
}

function bodyStartOffset(source: string): number {
  const frontmatter = source.match(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n)?/);
  return frontmatter?.[0].length ?? 0;
}

function lineOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') offsets.push(index + 1);
  }
  return offsets;
}

function stripMarkdocSyntax(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/\{[%#].*?[%#]\}/g, '')
    .replace(/[*_`]/g, '')
    .trim();
}

function describeNode(node: any, source: string): { kind: string; label: string } {
  if (node.type === 'tag') {
    const kind = String(node.tag || 'component');
    const title = node.attributes?.title || node.attributes?.label || node.attributes?.id;
    return {
      kind,
      label: title ? `${kind}: ${String(title)}` : kind,
    };
  }

  const firstMeaningfulLine = source
    .split('\n')
    .map(stripMarkdocSyntax)
    .find(Boolean);
  const kind = String(node.type || 'content');
  const fallback = kind.charAt(0).toUpperCase() + kind.slice(1);
  const label = firstMeaningfulLine
    ? firstMeaningfulLine.slice(0, 72)
    : fallback;
  return { kind, label };
}

function ensureSegmentBoundary(source: string): string {
  if (source.endsWith('\n\n')) return source;
  if (source.endsWith('\n')) return `${source}\n`;
  return `${source}\n\n`;
}

export function parseEditableContentBlocks(source: string): ParsedContentBlocks {
  const bodyOffset = bodyStartOffset(source);
  const body = source.slice(bodyOffset);
  const ast = Markdoc.parse(body) as any;
  const offsets = lineOffsets(body);
  const bodyLineOffset = source.slice(0, bodyOffset).split('\n').length - 1;
  const nodes = (Array.isArray(ast.children) ? ast.children : [])
    .map((node: any) => ({ node, startLine: node.lines?.[0] }))
    .filter((item: any) => Number.isInteger(item.startLine))
    .sort((left: any, right: any) => left.startLine - right.startLine);

  if (nodes.length === 0) return { prefix: source, blocks: [] };

  const starts = nodes.map((item: any) => offsets[item.startLine] ?? body.length);
  const prefixEnd = bodyOffset + starts[0];
  const blocks = nodes.map((item: any, index: number) => {
    const start = bodyOffset + starts[index];
    const end = index < nodes.length - 1 ? bodyOffset + starts[index + 1] : source.length;
    const blockSource = source.slice(start, end);
    const description = describeNode(item.node, blockSource);
    return {
      id: `block-${item.startLine}-${description.kind}-${index}`,
      index,
      kind: description.kind,
      label: description.label,
      start,
      end,
      startLine: bodyLineOffset + item.startLine + 1,
      source: blockSource,
    };
  });

  return { prefix: source.slice(0, prefixEnd), blocks };
}

function rebuildBlocks(parsed: ParsedContentBlocks, segments: string[]): string {
  return `${parsed.prefix}${segments.join('')}`;
}

export function replaceContentBlock(
  source: string,
  blockIndex: number,
  replacement: string,
): string {
  const parsed = parseEditableContentBlocks(source);
  if (!parsed.blocks[blockIndex]) return source;
  const segments = parsed.blocks.map((block) => block.source);
  segments[blockIndex] = ensureSegmentBoundary(replacement);
  return rebuildBlocks(parsed, segments);
}

export function moveContentBlock(
  source: string,
  blockIndex: number,
  direction: -1 | 1,
): string {
  const parsed = parseEditableContentBlocks(source);
  const destination = blockIndex + direction;
  if (!parsed.blocks[blockIndex] || !parsed.blocks[destination]) return source;
  const segments = parsed.blocks.map((block) => block.source);
  [segments[blockIndex], segments[destination]] = [segments[destination], segments[blockIndex]];
  return rebuildBlocks(parsed, segments);
}

export function duplicateContentBlock(source: string, blockIndex: number): string {
  const parsed = parseEditableContentBlocks(source);
  if (!parsed.blocks[blockIndex]) return source;
  const segments = parsed.blocks.map((block) => block.source);
  segments.splice(blockIndex + 1, 0, ensureSegmentBoundary(segments[blockIndex]));
  return rebuildBlocks(parsed, segments);
}

export function deleteContentBlock(source: string, blockIndex: number): string {
  const parsed = parseEditableContentBlocks(source);
  if (!parsed.blocks[blockIndex]) return source;
  const segments = parsed.blocks.map((block) => block.source);
  segments.splice(blockIndex, 1);
  return rebuildBlocks(parsed, segments);
}

export function insertContentBlock(
  source: string,
  afterBlockIndex: number,
  blockSource: string,
): string {
  const parsed = parseEditableContentBlocks(source);
  const segments = parsed.blocks.map((block) => block.source);
  const insertionIndex = Math.min(Math.max(afterBlockIndex + 1, 0), segments.length);
  segments.splice(insertionIndex, 0, ensureSegmentBoundary(blockSource));
  return rebuildBlocks(parsed, segments);
}

export function getContentBlockTemplates(): ContentBlockTemplate[] {
  return [
    {
      id: 'section',
      label: 'Section',
      description: 'A standard lesson section with a heading and explanatory copy.',
      source: `{% section-card %}\n## New section\n\nExplain the concept, why it matters, and the decision it helps the reader make.\n{% /section-card %}`,
    },
    {
      id: 'callout',
      label: 'Callout',
      description: 'Highlight an operational insight, warning, or memorable rule.',
      source: `{% callout variant="info" %}\nAdd the important takeaway here.\n{% /callout %}`,
    },
    {
      id: 'metrics',
      label: 'Metric strip',
      description: 'Compare a small set of quantitative facts.',
      source: `{% metric-strip %}\n{% metric value="10 ms" label="Latency" detail="Target at p95" tone="green" /%}\n{% metric value="99.9%" label="Availability" detail="Monthly objective" tone="blue" /%}\n{% /metric-strip %}`,
    },
    {
      id: 'process',
      label: 'Process flow',
      description: 'Explain a sequence of decisions or system stages.',
      source: `{% process-flow %}\n{% process-step number="1" title="First decision" %}\nExplain what happens and why.\n{% /process-step %}\n{% process-step number="2" title="Next decision" %}\nExplain the consequence.\n{% /process-step %}\n{% /process-flow %}`,
    },
  ];
}
