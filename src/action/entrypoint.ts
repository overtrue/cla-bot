import * as core from '@actions/core';
import * as github from '@actions/github';

import { handleIssueComment } from './handleIssueComment';
import { handlePullRequestTarget } from './handlePullRequestTarget';
import { createGitHubClient } from '../github/client';

function getRepositoryOwner(): string {
  const repository = github.context.payload.repository;

  if (repository?.owner?.login) {
    return repository.owner.login;
  }

  const [owner] = github.context.repo.owner ? [github.context.repo.owner] : (repository?.full_name ?? '').split('/');

  if (!owner) {
    throw new Error('Unable to resolve repository owner from GitHub context');
  }

  return owner;
}

export async function run(): Promise<void> {
  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('github-token input is required');
  }

  const explicitRegistryToken = core.getInput('registry-token') || process.env.REGISTRY_GITHUB_TOKEN;
  const registryToken = explicitRegistryToken || token;
  const hasExplicitRegistryToken = Boolean(explicitRegistryToken);
  const client = createGitHubClient(token);
  const registryClient = createGitHubClient(registryToken);
  const owner = getRepositoryOwner();
  const repo = github.context.payload.repository?.name ?? github.context.repo.repo;

  switch (github.context.eventName) {
    case 'pull_request_target': {
      const action = github.context.payload.action;
      const pullRequest = github.context.payload.pull_request;

      if (!pullRequest || !['opened', 'reopened', 'synchronize'].includes(action ?? '')) {
        return;
      }

      await handlePullRequestTarget(client, registryClient, {
        owner,
        repo,
        pullNumber: pullRequest.number,
        hasExplicitRegistryToken,
      });
      return;
    }

    case 'issue_comment': {
      if (github.context.payload.action !== 'created') {
        return;
      }

      const issue = github.context.payload.issue;
      const comment = github.context.payload.comment;

      if (!issue?.pull_request || !comment) {
        return;
      }

      await handleIssueComment(client, registryClient, {
        owner,
        repo,
        pullNumber: issue.number,
        hasExplicitRegistryToken,
        comment: {
          id: comment.id,
          body: comment.body ?? '',
          userLogin: comment.user?.login ?? null,
          ...(comment.created_at ? { createdAt: comment.created_at } : {}),
        },
      });
      return;
    }

    default:
      core.info(`Ignoring unsupported event: ${github.context.eventName}`);
  }
}
