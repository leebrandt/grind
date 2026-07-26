// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig } from "../utils/config.js";
import {
  pullWorkspace,
  getRemoteUrl,
  setRemoteUrl,
  hasUncommittedChanges,
  getDefaultBranch,
  formatShellError,
} from "../utils/git.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";

/**
 * Pull latest workspace state from remote.
 * Fetches all branches, merges main, and creates worktrees for new projects.
 * grind pull [-u <url>]
 */
export async function pullProjects(
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
      "Or pass:       grind pull -u <url>"
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
  const mainDirty = await hasUncommittedChanges(mainWorktree);
  if (mainDirty) {
    console.log("Warning: uncommitted changes in grind/ (main worktree).");
    console.log("  Run 'grind save grind' to commit before pulling.\n");
  }

  // 4. Pull all branches, merge main, create missing worktrees
  console.log("Fetching all branches from remote...");
  try {
    const result = await pullWorkspace(bareRepo, mainWorktree, workspaceRoot);

    if (result.updated.length > 0) {
      console.log(`  Fast-forwarded ${result.updated.length} branch(es): ${result.updated.join(", ")}`);
    }

    if (result.diverged.length > 0) {
      console.log(`  ${result.diverged.length} branch(es) diverged from remote (manual merge needed): ${result.diverged.join(", ")}`);
    }

    if (result.fastForwarded) {
      console.log(`  Main branch updated.`);
    } else if (!mainDirty) {
      console.log(`  Warning: main branch could not be updated (possible merge conflicts).`);
    }

    if (result.created > 0) {
      console.log(`  Created ${result.created} new worktree(s).`);
    }
    if (result.skipped > 0) {
      console.log(`  Skipped ${result.skipped} project(s) (already exist or are inactive).`);
    }
  } catch (e) {
    throw new GrindSystemError(`Failed to pull from remote. Check your connection and authentication: ${formatShellError(e)}`);
  }

  // 5. Summary
  console.log(`\n--> pull complete <--`);
  console.log(`Remote: ${remoteUrl}`);
}
