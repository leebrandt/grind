// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { mkdir, writeFile } from "node:fs/promises";
import type { GrindConfig } from "../types/index.js";
import { gitInit, gitInitialCommit, gitAddWorktree, gitCommit, getDefaultBranch } from "../utils/git.js";
import { fileExists } from "../utils/files.js";
import { GrindUserError } from "../utils/errors.js";
import {
  getBareRepoPath,
  getMainWorktreePath,
  getIdeasDirPath,
  getProjectsDirPath,
  getGrindConfigPath,
} from "../utils/paths.js";

/**
 * Default workspace configuration
 */
export const DEFAULT_GRIND_CONFIG: GrindConfig = {
  billing: {
    roundTo: "quarter-hour",
    defaultRate: 150,
  },
};

/**
 * Initialize a grind workspace
 * grind init
 *
 * Creates:
 * - .grind.repo.git/ (bare repository)
 * - grind/ (main worktree on "main" branch)
 *   - ideas/
 *   - .grind.json
 */
export async function init(): Promise<void> {
  const cwd = process.cwd();
  const bareRepoPath = getBareRepoPath(cwd);
  const mainWorktreePath = getMainWorktreePath(cwd);

  // Check if already initialized
  if (await fileExists(bareRepoPath)) {
    throw new GrindUserError("Grind workspace already initialized (.grind.repo.git exists)");
  }

  // 1. Create bare repo
  console.log("Creating bare repository...");
  await gitInit(bareRepoPath);

  // 2. Determine default branch name
  const defaultBranch = await getDefaultBranch(bareRepoPath);
  console.log(`Using branch '${defaultBranch}' as default...`);

  // 3. Create initial commit (required for worktrees)
  console.log("Creating initial commit...");
  await gitInitialCommit(bareRepoPath, defaultBranch);

  // 4. Add main worktree
  console.log("Creating main worktree (grind/)...");
  await gitAddWorktree(bareRepoPath, mainWorktreePath, defaultBranch);

  // 5. Create structure in main worktree
  console.log("Setting up workspace structure...");
  await mkdir(getIdeasDirPath(mainWorktreePath), { recursive: true });
  await mkdir(getProjectsDirPath(mainWorktreePath), { recursive: true });
  await writeFile(
    getGrindConfigPath(mainWorktreePath),
    JSON.stringify(DEFAULT_GRIND_CONFIG, null, 2),
    "utf-8"
  );

  // 6. Commit the structure
  console.log("Committing initial structure...");
  await gitCommit(mainWorktreePath, "Initialize grind workspace");

  console.log("\n--> grind workspace initialized <--");
  console.log(`\nWorkspace root: ${cwd}`);
  console.log(`Bare repo:      ${bareRepoPath}`);
  console.log(`Main worktree:  ${mainWorktreePath}`);
  console.log(`\nNext: cd grind && grind new idea "My first idea"`);
}
