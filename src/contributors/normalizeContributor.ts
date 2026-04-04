import type { Contributor } from '../core/types';
import { normalizeGitHubLogin } from '../utils/githubLogin';

export function createContributor(
  login: string,
  source: Contributor['source'],
  authorIsBot?: boolean,
): Contributor {
  const githubLogin = normalizeGitHubLogin(login);

  return {
    githubLogin,
    source,
    isBot: authorIsBot || githubLogin.endsWith('[bot]'),
  };
}
