// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { readFile, mkdir, readdir } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { readProjectConfig, writeProjectConfig } from "../utils/config.js";
import { gitCommit, getActiveWorktrees, localBranchExists, showFile } from "../utils/git.js";
import { getProjectsDirPath, getProjectWorktreePath, getProjectDirInMainPath } from "../utils/paths.js";
import { fileExists } from "../utils/files.js";

/**
 * Migrate project configs from project worktrees to main.
 * One-time operation for workspaces that existed before the refactor
 * where .project.json lived in project worktrees instead of main.
 * grind migrate
 */
export async function migrate(): Promise<void> {
  const { workspaceRoot, mainWorktree, bareRepo } = await requireWorkspace();

  console.log("Migrating project configs to main worktree...\n");

  // Get list of project directories on main
  const projectsDir = getProjectsDirPath(mainWorktree);
  let projectNames: string[] = [];
  if (await fileExists(projectsDir)) {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    projectNames = entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  }

  // Also check for branches with worktrees that might have newer configs
  const activeWorktrees = await getActiveWorktrees(bareRepo, workspaceRoot);

  let migrated = 0;
  let skipped = 0;

  // Merge both lists (project names from main + active worktrees)
  const allProjects = new Set([...projectNames, ...activeWorktrees]);

  for (const name of allProjects) {
    const mainConfigPath = getProjectDirInMainPath(mainWorktree, name);
    const mainHasConfig = await fileExists(mainConfigPath);

    // Try to read config from the project worktree (the "old" location)
    const worktreePath = getProjectWorktreePath(workspaceRoot, name);
    let worktreeConfig = null;
    if (await fileExists(worktreePath)) {
      // readProjectConfig now reads from main, so we need to read directly from worktree
      // for the migration case
      const worktreeConfigPath = `${worktreePath}/projects/${name}/.project.json`;
      try {
        const content = await readFile(worktreeConfigPath, "utf-8");
        worktreeConfig = JSON.parse(content);
      } catch {
        worktreeConfig = null;
      }
    }

    // If worktree has config and main doesn't (or worktree is newer), migrate
    if (worktreeConfig) {
      if (!mainHasConfig) {
        // Create directory and write config to main
        await mkdir(mainConfigPath, { recursive: true });
        await writeProjectConfig(workspaceRoot, name, worktreeConfig);
        console.log(`  Migrated: ${name} (from worktree → main)`);
        migrated++;
      } else {
        console.log(`  Skipped: ${name} (already on main)`);
        skipped++;
      }
    } else if (!mainHasConfig) {
      // No worktree and no main config — try to read from branch
      if (await localBranchExists(bareRepo, name)) {
        const configPath = `projects/${name}/.project.json`;
        const content = await showFile(bareRepo, name, configPath);
        if (content) {
          const config = JSON.parse(content);
          await mkdir(mainConfigPath, { recursive: true });
          await writeProjectConfig(workspaceRoot, name, config);
          console.log(`  Migrated: ${name} (from branch → main)`);
          migrated++;
        } else {
          console.log(`  Skipped: ${name} (no config found anywhere)`);
          skipped++;
        }
      } else {
        console.log(`  Skipped: ${name} (no config found anywhere)`);
        skipped++;
      }
    } else {
      console.log(`  Skipped: ${name} (already on main)`);
      skipped++;
    }
  }

  // Commit all migrations to main
  if (migrated > 0) {
    await gitCommit(mainWorktree, `Migrate ${migrated} project config(s) to main`);
    console.log(`\nCommitted ${migrated} migration(s) to main.`);
  }

  console.log(`\n--> migrate complete <--`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped:  ${skipped}`);

  if (migrated > 0) {
    console.log(`\nNext: run 'grind push' to send migrated data to remote.`);
  }
}
