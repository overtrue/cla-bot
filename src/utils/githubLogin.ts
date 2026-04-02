export function normalizeGitHubLogin(login: string): string {
  return login.trim().toLocaleLowerCase('en-US');
}
