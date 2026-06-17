// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import path from "node:path";
import { rm } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import { gitCommit } from "../utils/git.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";
import { getProjectWorktreePath, getProjectConfigDirPath } from "../utils/paths.js";

/**
 * Cancel (abandon) a project
 * grind cancel <name> [--force]
 */
export async function cancelProject(
  projectName: string,
  options?: { force?: boolean }
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

  // 4. Remove the worktree
  console.log(`Cancelling project '${projectName}'...`);
  try {
    if (options?.force) {
      await $`git -C ${bareRepo} worktree remove --force ${worktreePath}`.quiet();
    } else {
      await $`git -C ${bareRepo} worktree remove ${worktreePath}`.quiet();
    }
    console.log(`  - Removed worktree: ${projectName}/`);
  } catch {
    throw new GrindSystemError(
      "Could not remove worktree. It may have uncommitted changes.\n" +
      "Use --force to remove anyway."
    );
  }

  // 5. Delete the branch
  try {
    await $`git -C ${bareRepo} branch -D ${projectName}`.quiet();
    console.log(`  - Deleted branch: ${projectName}`);
  } catch {
    console.error(`Warning: Could not delete branch '${projectName}'.`);
  }

  // 6. Delete project config from main worktree
  const projectConfigDir = getProjectConfigDirPath(mainWorktree, projectName);
  if (await fileExists(projectConfigDir)) {
    await rm(projectConfigDir, { recursive: true });
    await gitCommit(mainWorktree, `Cancel project: ${projectName}`);
    console.log(`  - Removed project config: projects/${projectName}/`);
  }

  console.log(`\nProject '${projectName}' cancelled.`);
}
