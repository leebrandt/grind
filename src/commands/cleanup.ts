// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig } from "../utils/config.js";
import {
  getDefaultBranch,
  getRemoteBranchList,
  gitDeleteRemoteBranch,
  localBranchExists,
} from "../utils/git.js";
import { confirm } from "../utils/prompts.js";
import { getProjectDirInMainPath, getProjectWorktreePath } from "../utils/paths.js";
import { fileExists } from "../utils/files.js";

/**
 * Clean up stale remote and local branches.
 * Removes branches that have no corresponding project config on main.
 * grind cleanup [--dry-run] [-y]
 */
export async function cleanup(
  options?: { dryRun?: boolean; yes?: boolean }
): Promise<void> {
  const { workspaceRoot, mainWorktree, bareRepo } = await requireWorkspace();

  const config = await readGrindConfig(mainWorktree);
  const defaultBranch = await getDefaultBranch(bareRepo, config);

  // 1. Find stale remote branches
  const remoteBranches = await getRemoteBranchList(bareRepo);
  const staleRemote: string[] = [];

  for (const branch of remoteBranches) {
    const branchName = branch.replace(/^origin\//, "");
    if (branchName === defaultBranch || branchName === "HEAD") continue;

    const projectDir = getProjectDirInMainPath(mainWorktree, branchName);
    if (await fileExists(projectDir)) continue; // has config on main — not stale

    staleRemote.push(branchName);
  }

  // 2. Find orphaned local branches (no worktree, no config on main)
  const staleLocal: string[] = [];

  // Get all local branches
  const { $ } = await import("bun");
  try {
    const result = await $`git -C ${bareRepo} branch --format="%(refname:short)"`.quiet();
    const localBranches = result.stdout.toString().trim().split("\n").filter(b => b);

    for (const branch of localBranches) {
      if (branch === defaultBranch) continue;

      // Check if worktree exists
      const wtPath = getProjectWorktreePath(workspaceRoot, branch);
      if (await fileExists(wtPath)) continue; // has worktree — not orphaned

      // Check if config exists on main
      const projectDir = getProjectDirInMainPath(mainWorktree, branch);
      if (await fileExists(projectDir)) continue; // has config — not orphaned

      staleLocal.push(branch);
    }
  } catch {}

  if (staleRemote.length === 0 && staleLocal.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  // 3. Report findings
  if (staleRemote.length > 0) {
    console.log(`Stale remote branches (${staleRemote.length}):`);
    for (const branch of staleRemote) {
      const exists = await localBranchExists(bareRepo, branch);
      console.log(`  - origin/${branch}${exists ? " (local branch also exists)" : ""}`);
    }
  }

  if (staleLocal.length > 0) {
    console.log(`\nOrphaned local branches (${staleLocal.length}):`);
    for (const branch of staleLocal) {
      console.log(`  - ${branch}`);
    }
  }

  if (options?.dryRun) {
    console.log("\n(dry run — no changes made)");
    return;
  }

  // 4. Confirm
  const total = staleRemote.length + staleLocal.length;
  if (!options?.yes) {
    if (!(await confirm(`Delete ${total} stale branch(es)?`, false))) {
      console.log("Aborted.");
      return;
    }
  }

  // 5. Delete remote branches
  for (const branch of staleRemote) {
    if (await gitDeleteRemoteBranch(bareRepo, branch)) {
      console.log(`  Deleted remote: origin/${branch}`);
    } else {
      console.log(`  Failed to delete remote: origin/${branch}`);
    }
  }

  // 6. Delete orphaned local branches
  for (const branch of staleLocal) {
    try {
      await $`git -C ${bareRepo} branch -D ${branch}`.quiet();
      console.log(`  Deleted local: ${branch}`);
    } catch {
      console.log(`  Failed to delete local: ${branch}`);
    }
  }

  console.log(`\nCleaned up ${total} branch(es).`);
}
