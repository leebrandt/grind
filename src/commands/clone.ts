// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileExists } from "../utils/files.js";

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
    console.error(`Error: Directory '${dirName}' already exists.`);
    process.exit(1);
  }

  async function cleanup() {
    try { await $`rm -rf ${targetDir}`.quiet(); } catch {}
  }

  const bareRepoPath = path.join(targetDir, ".grind.repo.git");
  const mainWorktreePath = path.join(targetDir, "grind");

  // 1. Create target directory
  console.log(`Creating workspace directory: ${dirName}/`);
  await mkdir(targetDir, { recursive: true });

  // 2. Clone bare repo
  console.log("Cloning bare repository...");
  try {
    await $`git clone --bare ${url} ${bareRepoPath}`.quiet();
  } catch {
    console.error("Error: Failed to clone repository. Check that the URL is correct and accessible.");
    await cleanup();
    process.exit(1);
  }

  // 3. Fix remote fetch refspec (bare clones use wrong refspec that overwrites local branches)
  await $`git -C ${bareRepoPath} config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"`.quiet();

  // 4. Verify main branch exists
  try {
    await $`git -C ${bareRepoPath} rev-parse --verify refs/heads/main`.quiet();
  } catch {
    console.error("Error: Repository does not have a 'main' branch. Is this a grind workspace?");
    await cleanup();
    process.exit(1);
  }

  // 5. Create main worktree (NOT git clone — must be a worktree of the bare repo)
  console.log("Creating main worktree (grind/)...");
  try {
    await $`git -C ${bareRepoPath} worktree add ${mainWorktreePath} main`.quiet();
  } catch {
    console.error("Error: Failed to create main worktree.");
    await cleanup();
    process.exit(1);
  }

  // 6. Validate this is a grind workspace
  const configPath = path.join(mainWorktreePath, ".grind.json");
  if (!(await fileExists(configPath))) {
    console.error("Error: Repository does not appear to be a grind workspace (.grind.json not found).");
    await cleanup();
    process.exit(1);
  }

  // 7. Restore project worktrees from branches
  const branchResult = await $`git -C ${bareRepoPath} branch --format="%(refname:short)"`.quiet();
  const branches = branchResult.stdout.toString().trim().split("\n").filter(b => b && b !== "main");

  if (branches.length > 0) {
    console.log(`\nRestoring ${branches.length} project worktree(s)...`);
    for (const branch of branches) {
      const worktreePath = path.join(targetDir, branch);
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
