// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import {
  getDefaultBranch,
  hasUncommittedChanges,
  formatShellError,
  stageFiles,
  commitOnly,
  switchBranch,
  mergeBranch,
  removeWorktree,
  deleteLocalBranch,
  gitDeleteRemoteBranch,
} from "../utils/git.js";
import { readGrindConfig, readProjectConfig, writeProjectConfig } from "../utils/config.js";
import { getCurrentTimestamp } from "../utils/time.js";
import { confirmOrExit } from "../utils/prompts.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";
import { getProjectWorktreePath } from "../utils/paths.js";

/**
 * Publish a project by merging to main
 * grind publish project <name> [-d] [-D] [-u <url>] [-y]
 */
export async function publishProject(
  projectName: string,
  options?: { deleteWorktree?: boolean; deleteBranch?: boolean; url?: string; yes?: boolean }
): Promise<void> {
  // 1. Find workspace root and main worktree
  const { workspaceRoot, mainWorktree, bareRepo } = await requireWorkspace();

  // 2. Verify project worktree exists
  const worktreePath = getProjectWorktreePath(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    throw new GrindUserError(`Project worktree '${projectName}' does not exist.`);
  }

  // 3. Check for uncommitted changes in both worktrees
  if (await hasUncommittedChanges(mainWorktree)) {
    throw new GrindUserError("Main worktree has uncommitted changes. Please commit or stash them first.");
  }
  if (await hasUncommittedChanges(worktreePath)) {
    throw new GrindUserError(`Project '${projectName}' has uncommitted changes. Please commit or stash them first.`);
  }

  // 4. Record publication and mark as published (single commit)
  const configRelPath = path.join("projects", projectName, ".project.json");
  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    throw new GrindUserError(`Could not read .project.json for project '${projectName}'.`);
  }

  if (options?.url) {
    config.publications = config.publications ?? [];
    config.publications.push({ url: options.url, publishedAt: getCurrentTimestamp() });
    console.log(`  - Recorded publication: ${options.url}`);
  }

  config.status = 'published';
  await writeProjectConfig(workspaceRoot, projectName, config);

  await stageFiles(mainWorktree, [configRelPath]);
  const commitMsg = options?.url
    ? `Publish project: ${projectName} (${options.url})`
    : `Mark project as published: ${projectName}`;
  await commitOnly(mainWorktree, commitMsg);
  console.log(`  - Marked project as published in config`);

  // 5. Determine default branch name
  const grindConfig = await readGrindConfig(mainWorktree);
  const defaultBranch = await getDefaultBranch(bareRepo, grindConfig);

  // 6. Switch to default branch in grind/ worktree
  try {
    await switchBranch(mainWorktree, defaultBranch);
  } catch (e) {
    throw new GrindSystemError(`Could not switch to ${defaultBranch} branch. Is it checked out in another worktree?: ${formatShellError(e)}`);
  }

  // 7. Merge project branch into default branch
  console.log(`Publishing project '${projectName}'...`);
  console.log(`Merging branch '${projectName}' into ${defaultBranch}...`);

  try {
    await mergeBranch(mainWorktree, projectName);
    console.log("Merge completed successfully.");
  } catch (e) {
    throw new GrindSystemError(`Merge failed. Please resolve conflicts manually in ${mainWorktree}: ${formatShellError(e)}`);
  }

  // 8. If -d or -D flag: remove worktree (and optionally branch)
  if (options?.deleteWorktree || options?.deleteBranch) {
    console.log("\nCleaning up worktree...");

    let deletePrompt = `Delete worktree for '${projectName}'?`;
    if (options?.deleteBranch) {
      deletePrompt += " This will also delete the branch.";
    }
    await confirmOrExit(deletePrompt, options?.yes ?? false);

    await removeWorktree(bareRepo, worktreePath);
    console.log(`  - Removed worktree: ${worktreePath}`);

    if (options?.deleteBranch) {
      const localDeleted = await deleteLocalBranch(bareRepo, projectName);
      if (localDeleted) {
        console.log(`  - Deleted branch: ${projectName}`);
      }

      // Also delete from remote (best-effort)
      if (await gitDeleteRemoteBranch(bareRepo, projectName)) {
        console.log(`  - Deleted remote branch: ${projectName}`);
      }
    }

    console.log(`\nProject '${projectName}' published and archived.`);
  } else {
    console.log(`\nProject '${projectName}' published to ${defaultBranch} branch.`);
    console.log("Worktree and branch preserved for future work.");
  }
}
