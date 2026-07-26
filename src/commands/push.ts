// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig } from "../utils/config.js";
import {
  gitPushAll,
  gitCommit,
  getRemoteUrl,
  setRemoteUrl,
  hasUncommittedChanges,
} from "../utils/git.js";
import { GrindUserError } from "../utils/errors.js";

/**
 * Push all workspace branches to remote.
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

  // 3. Auto-commit uncommitted main worktree changes
  if (await hasUncommittedChanges(mainWorktree)) {
    console.log("Auto-committing uncommitted changes in grind/...");
    const timestamp = new Date().toLocaleString();
    await gitCommit(mainWorktree, `Auto-commit before push: ${timestamp}`);
    console.log("  Committed.");
  }

  // 4. Push all branches and tags to origin
  console.log("Pushing all branches to remote...");
  const { pushed, forcePushed, failed } = await gitPushAll(bareRepo);

  if (pushed.length > 0) {
    console.log(`  Pushed ${pushed.length} branch(es).`);
  }
  if (forcePushed.length > 0) {
    console.log(`  Force-pushed ${forcePushed.length} branch(es) (diverged from remote): ${forcePushed.join(", ")}`);
  }
  if (failed.length > 0) {
    console.error(`\n  ${failed.length} branch(es) failed to push:`);
    for (const { branch, error } of failed) {
      console.error(`    ${branch}: ${error}`);
    }
  }

  // 5. Summary
  console.log(`\n--> push complete <--`);
  console.log(`Remote: ${remoteUrl}`);
  console.log(`All branches pushed.`);
}
