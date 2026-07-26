// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig, readProjectConfig } from "../utils/config.js";
import {
  gitFetchBranch,
  getDefaultBranch,
  formatShellError,
  getRemoteUrl,
  setRemoteUrl,
  hasUncommittedChanges,
  gitAddWorktree,
  getActiveWorktrees,
} from "../utils/git.js";
import { confirm } from "../utils/prompts.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";
import { getProjectsDirPath, getProjectWorktreePath } from "../utils/paths.js";
import { fileExists } from "../utils/files.js";

/**
 * Pull latest workspace state from remote.
 * Fetches main branch only, then reconciles project worktrees from configs on main.
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

  // 4. Fetch main branch from remote
  const defaultBranch = await getDefaultBranch(bareRepo, config);
  console.log(`Fetching ${defaultBranch} from remote...`);
  try {
    await gitFetchBranch(bareRepo, defaultBranch);
    console.log("  Fetch completed.");
  } catch (e) {
    throw new GrindSystemError(`Failed to fetch from remote. Check your connection and authentication: ${formatShellError(e)}`);
  }

  // 5. Update main worktree
  if (!mainDirty) {
    console.log(`Updating grind/ (${defaultBranch})...`);
    try {
      await $`git -C ${mainWorktree} merge --ff-only origin/${defaultBranch}`.quiet();
      console.log(`  ${defaultBranch} fast-forwarded.`);
    } catch (e) {
      console.log(`  Warning: could not fast-forward ${defaultBranch}: ${formatShellError(e)}`);
    }
  }

  // 6. Read project configs from main and reconcile worktrees
  const projectsDir = getProjectsDirPath(mainWorktree);
  let projectNames: string[] = [];
  if (await fileExists(projectsDir)) {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    projectNames = entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  }

  const activeWorktrees = await getActiveWorktrees(bareRepo, workspaceRoot);
  const activeSet = new Set(activeWorktrees);

  let createdCount = 0;
  let skippedCount = 0;

  for (const name of projectNames) {
    const wtPath = getProjectWorktreePath(workspaceRoot, name);
    if (await fileExists(wtPath)) continue; // worktree already exists

    // Create worktree for this project from main
    if (activeSet.has(name)) continue; // branch exists with worktree (shouldn't happen if dir doesn't exist, but be safe)

    // Skip canceled or published projects
    const projectConfig = await readProjectConfig(workspaceRoot, name);
    if (projectConfig?.status === 'canceled' || projectConfig?.status === 'published') {
      console.log(`  Skipping '${name}' (${projectConfig.status})`);
      skippedCount++;
      continue;
    }

    console.log(`  Creating worktree for '${name}'...`);
    try {
      await gitAddWorktree(bareRepo, wtPath, name);
      console.log(`    - ${name}/ created.`);
      createdCount++;
    } catch {
      console.log(`    - ${name}/ (failed to create worktree)`);
      skippedCount++;
    }
  }

  // 7. Summary
  console.log(`\n--> pull complete <--`);
  console.log(`Remote: ${remoteUrl}`);
  console.log(`Branch updated: ${defaultBranch}`);
  if (createdCount > 0) {
    console.log(`New worktrees created: ${createdCount}`);
  }
  if (skippedCount > 0) {
    console.log(`Worktrees failed: ${skippedCount}`);
  }
}
