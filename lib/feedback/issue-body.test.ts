import { describe, expect, it } from 'vitest';
import { buildIssueBody } from './issue-body';

describe('buildIssueBody', () => {
  it('never prints the reporter email, even when an old client sends it', () => {
    const body = buildIssueBody(
      {
        title: 'Broken diagram',
        description: 'The arrow points the wrong way.',
        category: 'bug',
        email: 'reader@example.com',
      },
      'Load balancing'
    );

    expect(body).not.toContain('reader@example.com');
    expect(body).not.toContain('notify-email');
    expect(body).toContain('Reporter asked to be told when this is resolved');
  });

  it('notes a requested reply without an address', () => {
    const body = buildIssueBody({ title: 'Typo', wantsReply: true }, 'Home');
    expect(body).toContain('Reporter asked to be told when this is resolved');
    expect(body).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
  });

  it('says nothing about a reply when none was asked for', () => {
    const body = buildIssueBody({ title: 'Typo', description: 'teh' }, 'Home');
    expect(body).not.toContain('Reporter asked');
    expect(body).toContain('## Description');
    expect(body).toContain('teh');
  });
});
