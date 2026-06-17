// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileExists } from "../utils/files.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";
import { getBareRepoPath, getMainWorktreePath, getGrindConfigPath, getProjectWorktreePath } from "../utils/paths.js";

/**
 * Derive a directory name from a git URL
 * Mirrors git clone behavior: strip .git suffix, take last path segment
 */
function deriveDirectoryName(url: string): string {
  let name = url;
  // SSH URLs like git@github.com:user/repo.git
  if (name.includes(":") && !name.includes("://")) {
    name = name.split(":").pop()!;
  }
  name = name.replace(/\/+$/, "");
  name = name.split("/").pop()!;
  name = name.replace(/\.git$/, "");
  return name;
}

/**
 * Clone a remote repo as a grind workspace
 * grind clone <url> [directory]
 */
export async function clone(url: string, directory?: string): Promise<void> {
  const dirName = directory || deriveDirectoryName(url);
  const targetDir = path.resolve(dirName);

  if (await fileExists(targetDir)) {
    throw new GrindUserError(`Directory '${dirName}' already exists.`);
  }

  async function cleanup() {
    try { await $`rm -rf ${targetDir}`.quiet(); } catch {}
  }

  const bareRepoPath = getBareRepoPath(targetDir);
  const mainWorktreePath = getMainWorktreePath(targetDir);

  // 1. Create target directory
  console.log(`Creating workspace directory: ${dirName}/`);
  await mkdir(targetDir, { recursive: true });

  // 2. Clone bare repo
  console.log("Cloning bare repository...");
  try {
    await $`git clone --bare ${url} ${bareRepoPath}`.quiet();
  } catch {
    await cleanup();
    throw new GrindSystemError("Failed to clone repository. Check that the URL is correct and accessible.");
  }

  // 3. Fix remote fetch refspec (bare clones use wrong refspec that overwrites local branches)
  await $`git -C ${bareRepoPath} config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"`.quiet();

  // 3b. Fetch all branches to populate remote tracking refs
  await $`git -C ${bareRepoPath} fetch --all`.quiet();

  // 4. Verify main branch exists
  try {
    await $`git -C ${bareRepoPath} rev-parse --verify refs/heads/main`.quiet();
  } catch {
    await cleanup();
    throw new GrindUserError("Repository does not have a 'main' branch. Is this a grind workspace?");
  }

  // 5. Create main worktree (NOT git clone — must be a worktree of the bare repo)
  console.log("Creating main worktree (grind/)...");
  try {
    await $`git -C ${bareRepoPath} worktree add ${mainWorktreePath} main`.quiet();
  } catch {
    await cleanup();
    throw new GrindSystemError("Failed to create main worktree.");
  }

  // 6. Validate this is a grind workspace
  const configPath = getGrindConfigPath(mainWorktreePath);
  if (!(await fileExists(configPath))) {
    await cleanup();
    throw new GrindUserError("Repository does not appear to be a grind workspace (.grind.json not found).");
  }

  // 7. Restore project worktrees from branches
  const branchResult = await $`git -C ${bareRepoPath} branch --format="%(refname:short)"`.quiet();
  const branches = branchResult.stdout.toString().trim().split("\n").filter(b => b && b !== "main");

  if (branches.length > 0) {
    console.log(`\nRestoring ${branches.length} project worktree(s)...`);
    for (const branch of branches) {
      const worktreePath = getProjectWorktreePath(targetDir, branch);
      try {
        await $`git -C ${bareRepoPath} worktree add ${worktreePath} ${branch}`.quiet();
        console.log(`  - ${branch}/`);
      } catch {
        console.log(`  - ${branch}/ (skipped: could not create worktree)`);
      }
    }
  }

  // 8. Done
  console.log("\n--> grind workspace cloned <--");
  console.log(`\nWorkspace root: ${targetDir}`);
  console.log(`Bare repo:      ${bareRepoPath}`);
  console.log(`Main worktree:  ${mainWorktreePath}`);
  if (branches.length > 0) {
    console.log(`Projects:       ${branches.length} worktree(s) restored`);
  }
  console.log(`\nNext: cd ${dirName}/grind`);
}
