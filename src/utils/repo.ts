// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export interface RepoInfo {
  platform: "github" | "gitlab";
  repo: string; // "owner/repo"
}

/**
 * Parse a git remote URL and extract the platform and owner/repo.
 * Supports SSH (git@github.com:owner/repo.git) and HTTPS (https://github.com/owner/repo) formats.
 * Returns null if the URL isn't a recognized GitHub/GitLab URL.
 */
export function parseRepoUrl(url: string): RepoInfo | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@(github\.com|gitlab\.com):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      platform: sshMatch[1] === "github.com" ? "github" : "gitlab",
      repo: sshMatch[2],
    };
  }

  // HTTPS format: https://github.com/owner/repo or https://github.com/owner/repo.git
  const httpsMatch = url.match(/^https?:\/\/(github\.com|gitlab\.com)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return {
      platform: httpsMatch[1] === "github.com" ? "github" : "gitlab",
      repo: httpsMatch[2],
    };
  }

  return null;
}
