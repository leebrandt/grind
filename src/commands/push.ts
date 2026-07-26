// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig } from "../utils/config.js";
import {
  gitPushBranch,
  getRemoteUrl,
  setRemoteUrl,
  hasUncommittedChanges,
  getDefaultBranch,
  formatShellError,
} from "../utils/git.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";

/**
 * Push workspace changes to remote.
 * Only pushes the main branch (project worktrees are local-only).
 * grind push [-u <url>]
 */
export async function pushProjects(
  options?: { url?: string }
): Promise<void> {
  const { workspaceRoot, mainWorktree, bareRepo } = await requireWorkspace();

  // 1. Resolve remote URL
  const config = await readGrindConfig(mainWorktree);
  const remoteUrl = options?.url || config?.remote?.url || (await getRemoteUrl(bareRepo));

  if (!remoteUrl) {
    throw new GrindUserError(
      "No remote URL configured.\n" +
      "Set one with: grind config -g remote.url <url>\n" +
      "Or pass:       grind push -u <url>"
    );
  }

  // 2. Ensure origin is set on the bare repo
  const existingOrigin = await getRemoteUrl(bareRepo);
  if (!existingOrigin) {
    console.log("Setting remote origin...");
    await setRemoteUrl(bareRepo, remoteUrl);
  } else if (existingOrigin !== remoteUrl) {
    await setRemoteUrl(bareRepo, remoteUrl);
  }

  // 3. Check main worktree for uncommitted changes
  if (await hasUncommittedChanges(mainWorktree)) {
    console.log("Warning: uncommitted changes in grind/ (main worktree).");
    console.log("  Run 'grind save grind' to commit, then push again.\n");
  }

  // 4. Push main branch and tags to origin
  const defaultBranch = await getDefaultBranch(bareRepo, config);
  console.log(`Pushing ${defaultBranch} branch to remote...`);
  try {
    await gitPushBranch(bareRepo, defaultBranch);
    console.log("  Pushed successfully.");
  } catch (e) {
    throw new GrindSystemError(`Failed to push to remote. Check your connection and authentication: ${formatShellError(e)}`);
  }

  // 5. Summary
  console.log(`\n--> push complete <--`);
  console.log(`Remote: ${remoteUrl}`);
  console.log(`Branch pushed: ${defaultBranch}`);
}
