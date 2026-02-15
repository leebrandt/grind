// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import path from "node:path";
import { rm } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import { gitCommit } from "../utils/git.js";

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
  const worktreePath = path.join(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    console.error(`Error: Project worktree '${projectName}' does not exist.`);
    process.exit(1);
  }

  // 3. Detect if user is inside the project worktree
  const cwd = process.cwd();
  if (cwd === worktreePath || cwd.startsWith(worktreePath + path.sep)) {
    console.error(`Error: You are inside this project's worktree.`);
    console.error(`Please cd to your workspace root first: cd ${workspaceRoot}`);
    process.exit(1);
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
    console.error(`Error: Could not remove worktree. It may have uncommitted changes.`);
    console.error(`Use --force to remove anyway.`);
    process.exit(1);
  }

  // 5. Delete the branch
  try {
    await $`git -C ${bareRepo} branch -D ${projectName}`.quiet();
    console.log(`  - Deleted branch: ${projectName}`);
  } catch {
    console.error(`Warning: Could not delete branch '${projectName}'.`);
  }

  // 6. Delete project config from main worktree
  const projectConfigDir = path.join(mainWorktree, "projects", projectName);
  if (await fileExists(projectConfigDir)) {
    await rm(projectConfigDir, { recursive: true });
    await gitCommit(mainWorktree, `Cancel project: ${projectName}`);
    console.log(`  - Removed project config: projects/${projectName}/`);
  }

  console.log(`\nProject '${projectName}' cancelled.`);
}
