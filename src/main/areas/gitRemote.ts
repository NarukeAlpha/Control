import type { GitHubRemoteConnection } from "@shared/areas";

interface ParsedGitHubRemote {
  owner: string;
  repo: string;
  url: string;
}

export function parseGitHubRemoteUrl(remoteUrl: string): ParsedGitHubRemote | null {
  const trimmed = remoteUrl.trim();
  const withoutGitSuffix = (value: string): string => value.replace(/\.git$/i, "");

  const httpsMatch = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(trimmed);
  if (httpsMatch) {
    const [, owner, repo] = httpsMatch;
    return {
      owner,
      repo: withoutGitSuffix(repo),
      url: `https://github.com/${owner}/${withoutGitSuffix(repo)}`
    };
  }

  const scpMatch = /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(trimmed);
  if (scpMatch) {
    const [, owner, repo] = scpMatch;
    return {
      owner,
      repo: withoutGitSuffix(repo),
      url: `https://github.com/${owner}/${withoutGitSuffix(repo)}`
    };
  }

  const sshMatch = /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(trimmed);
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    return {
      owner,
      repo: withoutGitSuffix(repo),
      url: `https://github.com/${owner}/${withoutGitSuffix(repo)}`
    };
  }

  return null;
}

export function gitHubConnectionFromRemote(
  remoteName: string,
  remoteUrl: string,
  matchedGitHubAreaId: string | null
): GitHubRemoteConnection | null {
  const parsed = parseGitHubRemoteUrl(remoteUrl);
  if (!parsed) {
    return null;
  }

  return {
    owner: parsed.owner,
    repo: parsed.repo,
    nameWithOwner: `${parsed.owner}/${parsed.repo}`,
    remoteName,
    remoteUrl,
    url: parsed.url,
    matchedGitHubAreaId,
    status: matchedGitHubAreaId ? "connected" : "unmatched",
    lastCheckedAt: new Date().toISOString(),
    lastError: null
  };
}
