import { describe, expect, it } from 'vitest';
import { feedbackObjectPath, isSafeFeedbackFileName, teamFeedbackFileLink } from './private-files';

describe('feedback private files', () => {
  it('accepts the flat names the widget writes', () => {
    expect(isSafeFeedbackFileName('1789000000000-capture-0.jpg')).toBe(true);
    expect(feedbackObjectPath('1789000000000-voice.webm')).toBe('feedback/1789000000000-voice.webm');
  });

  it('rejects paths and traversal', () => {
    for (const bad of ['../secret', 'a/b.png', '', '.hidden', 'a..b', 42, null]) {
      expect(isSafeFeedbackFileName(bad)).toBe(false);
    }
    expect(() => feedbackObjectPath('../x')).toThrow();
  });

  it('links to the team-only viewer, never to storage', () => {
    const link = teamFeedbackFileLink('1789000000000-console-logs.txt', 'https://www.systemdesigner.net/');
    expect(link).toBe(
      'https://www.systemdesigner.net/admin/feedback/file?name=1789000000000-console-logs.txt'
    );
    expect(link).not.toMatch(/firebasestorage|googleapis|token=/);
  });
});
