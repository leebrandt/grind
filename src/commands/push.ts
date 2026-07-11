// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig } from "../utils/config.js";
import {
  getActiveWorktrees,
  gitPushAll,
  getRemoteUrl,
  setRemoteUrl,
  hasUncommittedChanges,
} from "../utils/git.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";
import { getMainWorktreePath, getProjectWorktreePath } from "../utils/paths.js";

/**
 * Push all workspace changes to remote.
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
    // URL provided differs from origin — update it
    await setRemoteUrl(bareRepo, remoteUrl);
  }

  // 3. Collect worktrees and check for uncommitted changes
  const allWorktrees = await getActiveWorktrees(bareRepo, workspaceRoot);
  const dirtyWorktrees: string[] = [];

  // Check main worktree
  if (await hasUncommittedChanges(mainWorktree)) {
    dirtyWorktrees.push("grind/ (main worktree)");
  }

  // Check project worktrees
  for (const projectName of allWorktrees) {
    const wtPath = getProjectWorktreePath(workspaceRoot, projectName);
    if (await hasUncommittedChanges(wtPath)) {
      dirtyWorktrees.push(`${projectName}/`);
    }
  }

  // Warn about uncommitted changes
  if (dirtyWorktrees.length > 0) {
    console.log("Warning: uncommitted changes in:");
    for (const wt of dirtyWorktrees) {
      console.log(`  - ${wt} (skipping push for this worktree)`);
    }
    // We continue — the bare repo's committed state will still be pushed
    console.log("  Run 'grind save' on each project to commit, then push again.\n");
  }

  // 4. Push all branches and tags to origin
  console.log("Pushing all branches to remote...");
  try {
    await gitPushAll(bareRepo);
    console.log("  Branches pushed successfully.");
  } catch (e) {
    throw new GrindSystemError("Failed to push to remote. Check your connection and authentication.");
  }

  // 5. Summary
  console.log(`\n--> push complete <--`);
  console.log(`Remote: ${remoteUrl}`);
  console.log(`Branches pushed to origin: ${allWorktrees.length + 1}`);
  if (dirtyWorktrees.length > 0) {
    console.log(`Skipped (uncommitted): ${dirtyWorktrees.length}`);
  }
}
