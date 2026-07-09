// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import path from "node:path";
import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig } from "../utils/config.js";
import {
  getActiveWorktrees,
  gitFetchAll,
  getRemoteUrl,
  setRemoteUrl,
  getRemoteBranchList,
  getDefaultBranch,
  getCurrentBranch,
  remoteBranchExists,
  fastForwardWorktree,
  localBranchExists,
  gitAddWorktree,
  hasUncommittedChanges,
} from "../utils/git.js";
import { confirm } from "../utils/prompts.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";
import { getMainWorktreePath, getProjectWorktreePath } from "../utils/paths.js";
import { fileExists } from "../utils/files.js";

/**
 * Pull latest workspace state from remote.
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

  // 3. Collect worktrees and check for uncommitted changes
  const allWorktrees = await getActiveWorktrees(bareRepo, workspaceRoot);
  const dirtyWorktrees: Set<string> = new Set();

  // Check main worktree
  const mainDirty = await hasUncommittedChanges(mainWorktree);
  if (mainDirty) {
    dirtyWorktrees.add("grind");
  }

  // Check project worktrees
  for (const projectName of allWorktrees) {
    const wtPath = getProjectWorktreePath(workspaceRoot, projectName);
    if (await hasUncommittedChanges(wtPath)) {
      dirtyWorktrees.add(projectName);
    }
  }

  if (dirtyWorktrees.size > 0) {
    console.log("Warning: uncommitted changes in:");
    for (const wt of dirtyWorktrees) {
      const label = wt === "grind" ? "grind/ (main worktree)" : `${wt}/`;
      console.log(`  - ${label} (will not update this worktree)`);
    }
    console.log("  Run 'grind save' on each project to commit before pulling.\n");
  }

  // 4. Fetch all from remote
  console.log("Fetching from remote...");
  try {
    await gitFetchAll(bareRepo);
    console.log("  Fetch completed.");
  } catch {
    throw new GrindSystemError("Failed to fetch from remote. Check your connection and authentication.");
  }

  const defaultBranch = await getDefaultBranch(bareRepo, config);

  // 5. Update main worktree
  const mainBranch = await getCurrentBranch(mainWorktree);
  const mainHasRemote = await remoteBranchExists(bareRepo, mainBranch);

  if (mainHasRemote && !dirtyWorktrees.has("grind")) {
    console.log(`Updating grind/ (${mainBranch})...`);
    try {
      await $`git -C ${mainWorktree} merge --ff-only origin/${mainBranch}`.quiet();
      console.log(`  ${mainBranch} fast-forwarded.`);
    } catch {
      console.log(`  Warning: could not fast-forward ${mainBranch}. It may have diverged.`);
    }
  } else if (!mainHasRemote) {
    console.log(`  No remote tracking branch for '${mainBranch}', skipping.`);
  }

  // 6. Update existing project worktrees
  for (const projectName of allWorktrees) {
    if (dirtyWorktrees.has(projectName)) {
      console.log(`  Skipping ${projectName}/ (uncommitted changes)`);
      continue;
    }

    const hasRemote = await remoteBranchExists(bareRepo, projectName);
    if (!hasRemote) {
      console.log(`  No remote tracking for '${projectName}', skipping.`);
      continue;
    }

    const wtPath = getProjectWorktreePath(workspaceRoot, projectName);
    const updated = await fastForwardWorktree(wtPath, projectName);
    if (updated) {
      console.log(`  ${projectName}/ fast-forwarded.`);
    } else {
      console.log(`  Warning: could not fast-forward ${projectName}/. May have diverged.`);
    }
  }

  // 7. Find remote branches that don't have local worktrees and prompt to restore
  const remoteBranches = await getRemoteBranchList(bareRepo);
  const remoteProjectBranches = remoteBranches
    .map(b => b.replace(/^origin\//, ""))
    .filter(b => b !== defaultBranch && b !== "main");

  const newBranches: string[] = [];
  for (const branch of remoteProjectBranches) {
    const wtPath = getProjectWorktreePath(workspaceRoot, branch);
    if (!(await fileExists(wtPath))) {
      newBranches.push(branch);
    }
  }

  let newWorktreeCount = 0;
  if (newBranches.length > 0) {
    console.log(`\n${newBranches.length} new remote branch(es) found:`);
    for (const branch of newBranches) {
      if (await confirm(`Create worktree for '${branch}'?`, false)) {
        const wtPath = getProjectWorktreePath(workspaceRoot, branch);
        try {
          await gitAddWorktree(bareRepo, wtPath, branch);
          console.log(`  - ${branch}/ created.`);
          newWorktreeCount++;
        } catch {
          console.log(`  - ${branch}/ (failed to create worktree)`);
        }
      } else {
        console.log(`  - ${branch}/ (skipped)`);
      }
    }
  }

  // 8. Summary
  const updatedCount = allWorktrees.filter(
    n => !dirtyWorktrees.has(n) && remoteBranches.includes(`origin/${n}`)
  ).length;
  const mainUpdated = mainHasRemote && !dirtyWorktrees.has("grind") ? 1 : 0;

  console.log(`\n--> pull complete <--`);
  console.log(`Remote: ${remoteUrl}`);
  console.log(`Worktrees updated: ${updatedCount + mainUpdated}`);
  if (newWorktreeCount > 0) {
    console.log(`New worktrees created: ${newWorktreeCount}`);
  }
  if (dirtyWorktrees.size > 0) {
    console.log(`Skipped (uncommitted): ${dirtyWorktrees.size}`);
  }
}
