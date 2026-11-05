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
    // Prefer GitHub's user.type === 'Bot' when available; fall back to the [bot] login suffix
    // used by Apps and by logins parsed from commit trailers (e.g. co-authors).
    isBot: Boolean(authorIsBot) || githubLogin.endsWith('[bot]'),
  };
}
