import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getInput, info, warning, context, handleIssueComment, handlePullRequestTarget, createGitHubClient } =
  vi.hoisted(() => ({
    getInput: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    context: {
      eventName: '',
      payload: {},
      repo: {
        owner: 'app',
        repo: 'demo',
      },
    },
    handleIssueComment: vi.fn(),
    handlePullRequestTarget: vi.fn(),
    createGitHubClient: vi.fn(() => ({ mocked: true })),
  }));

vi.mock('@actions/core', () => ({
  getInput,
  info,
  warning,
}));

vi.mock('@actions/github', () => ({
  context,
}));

vi.mock('../../src/action/handleIssueComment', () => ({
  handleIssueComment,
}));

vi.mock('../../src/action/handlePullRequestTarget', () => ({
  handlePullRequestTarget,
}));

vi.mock('../../src/github/client', () => ({
  createGitHubClient,
}));

import { run } from '../../src/action/entrypoint';

describe('entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.eventName = '';
    context.repo.owner = 'app';
    context.repo.repo = 'demo';
    context.payload = {
      repository: {
        name: 'demo',
        owner: { login: 'app' },
      },
    };
    getInput.mockImplementation((name: string) => {
      if (name === 'github-token') {
        return 'github-token';
      }

      if (name === 'registry-token') {
        return 'registry-token';
      }

      return '';
    });
  });

  it('handles edited issue comments', async () => {
    context.eventName = 'issue_comment';
    context.payload = {
      action: 'edited',
      repository: {
        name: 'demo',
        owner: { login: 'app' },
      },
      issue: {
        number: 1,
        pull_request: {},
      },
      comment: {
        id: 100,
        body: 'I have read and agree to the CLA.',
        user: { login: 'alice' },
        created_at: '2026-04-02T10:00:00Z',
        updated_at: '2026-04-02T10:05:00Z',
      },
    };

    await run();

    expect(handleIssueComment).toHaveBeenCalledTimes(1);
    expect(handleIssueComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        owner: 'app',
        repo: 'demo',
        pullNumber: 1,
        hasExplicitRegistryToken: true,
        comment: expect.objectContaining({
          id: 100,
          body: 'I have read and agree to the CLA.',
          userLogin: 'alice',
          createdAt: '2026-04-02T10:00:00Z',
          updatedAt: '2026-04-02T10:05:00Z',
        }),
      }),
    );
  });
});
