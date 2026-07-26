// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import { gitCommit, removeProject, formatShellError } from "../utils/git.js";
import { confirmOrExit } from "../utils/prompts.js";
import { GrindUserError } from "../utils/errors.js";
import { getProjectWorktreePath } from "../utils/paths.js";
import { readProjectConfig, writeProjectConfig } from "../utils/config.js";

/**
 * Cancel (abandon) a project
 * grind cancel <name> [--force] [-y]
 */
export async function cancelProject(
  projectName: string,
  options?: { force?: boolean; yes?: boolean }
): Promise<void> {
  // 1. Find workspace root and main worktree
  const { workspaceRoot, mainWorktree, bareRepo } = await requireWorkspace();

  // 2. Verify project worktree exists
  const worktreePath = getProjectWorktreePath(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    throw new GrindUserError(`Project worktree '${projectName}' does not exist.`);
  }

  // 3. Detect if user is inside the project worktree
  const cwd = process.cwd();
  if (cwd === worktreePath || cwd.startsWith(worktreePath + path.sep)) {
    throw new GrindUserError(
      `You are inside this project's worktree.\n` +
      `Please cd to your workspace root first: cd ${workspaceRoot}`
    );
  }

  // 4. Confirm cancellation
  await confirmOrExit(
    `Cancel project '${projectName}'? This will permanently delete the worktree, branch, and project config.`,
    options?.yes ?? false,
  );

  // 5. Remove worktree, local branch, and remote branch (best-effort)
  console.log(`Cancelling project '${projectName}'...`);
  const result = await removeProject(bareRepo, worktreePath, projectName, {
    force: options?.force,
    deleteRemote: true,
  });

  if (result.worktreeRemoved) {
    console.log(`  - Removed worktree: ${projectName}/`);
  } else {
    throw new GrindUserError(
      "Could not remove worktree. It may have uncommitted changes.\n" +
      "Use --force to remove anyway."
    );
  }

  if (result.localDeleted) {
    console.log(`  - Deleted branch: ${projectName}`);
  }

  if (result.remoteDeleted) {
    console.log(`  - Deleted remote branch: ${projectName}`);
  }

  // 6. Mark project as canceled in config (keep config as record)
  const config = await readProjectConfig(workspaceRoot, projectName);
  if (config) {
    config.status = 'canceled';
    await writeProjectConfig(workspaceRoot, projectName, config);
    await gitCommit(mainWorktree, `Cancel project: ${projectName}`);
    console.log(`  - Marked project as canceled in config`);
  }

  console.log(`\nProject '${projectName}' cancelled.`);
}
