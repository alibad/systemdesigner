import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_REGISTRY } from './content-registry';
import { lessonFilePath, listLessons, loadLesson } from './lessons';

describe('content entries', () => {
  it('discovers directory-based Markdoc entries deterministically', () => {
    const entries = listLessons();

    for (const entry of CONTENT_REGISTRY.filter(
      (candidate) => candidate.status === 'active' && candidate.renderMode === 'mdoc'
    )) {
      expect(entries).toContainEqual({
        section: entry.section,
        slug: entry.path.split('/').pop(),
      });
    }
    expect(entries).toEqual([...entries].sort((a, b) =>
      a.section === b.section
        ? a.slug.localeCompare(b.slug)
        : a.section.localeCompare(b.section)
    ));
    expect(entries).toContainEqual({ section: 'genai', slug: 'model-context-protocol' });
  });

  it('resolves and validates every authored entry', () => {
    const failures: string[] = [];

    for (const { section, slug } of listLessons()) {
      expect(lessonFilePath(section, slug)).toContain(
        `/content/entries/${section}/${slug}/index.mdoc`
      );
      expect(fs.existsSync(lessonFilePath(section, slug))).toBe(true);
      try {
        expect(loadLesson(section, slug)).not.toBeNull();
      } catch (error) {
        failures.push(`${section}/${slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
