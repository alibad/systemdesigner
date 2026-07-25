import Markdoc from '@markdoc/markdoc';
import { describe, expect, it } from 'vitest';
import { config } from '@/markdoc/config';

describe('Markdoc content schema', () => {
  it('accepts the shared practice accordion structure', () => {
    const ast = Markdoc.parse(`
{% accordion defaultOpen="clarifying" %}
{% accordion-item id="clarifying" title="Clarifying requirements" %}
Define the problem before selecting components.
{% /accordion-item %}
{% /accordion %}
`);

    expect(Markdoc.validate(ast, config).filter((error) => error.error.level === 'error')).toEqual([]);
  });

  it('requires registered block references to provide an id syntactically', () => {
    const ast = Markdoc.parse('{% interactive-block /%}');
    const errors = Markdoc.validate(ast, config);

    expect(errors.some((error) => error.error.id === 'attribute-missing-required')).toBe(true);
  });

  it('accepts tabbed content with titled panels', () => {
    const ast = Markdoc.parse(`
{% tabs %}
{% tab title="First" %}First panel{% /tab %}
{% tab title="Second" %}Second panel{% /tab %}
{% /tabs %}
`);

    expect(Markdoc.validate(ast, config).filter((error) => error.error.level === 'error')).toEqual([]);
  });

  it('routes Markdown tables through the responsive table component', () => {
    const ast = Markdoc.parse(`
| Option | Throughput | Failure mode |
| --- | ---: | --- |
| Queue | 50K/s | Consumer lag |
`);
    const tree = Markdoc.transform(ast, config) as any;
    const names = new Set<string>();
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.name === 'string') names.add(node.name);
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);

    expect(names.has('ResponsiveTable')).toBe(true);
  });
});
